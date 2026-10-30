import { HEADERS, type ApiError } from '@/shared'
import { ApiException } from '@/lib/errors'
import { refreshChange, tokenIdentity, type SessionChange } from '@/lib/session'
import { mockHandle, mockSupports } from '@/mocks/api'

// Mock is OPT-IN: set VITE_USE_MOCK=true (e.g. .env.local) to run the UI without a backend.
// Any real build (no var) talks to the real API, so we never ship the mock demo app by accident.
const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

export { ApiException }

// Access token lives in memory only; refresh token is the httpOnly ju_rt cookie (shared by every tab).
// `identity` = whose token this tab holds (lib/session); a refresh for anyone else is never adopted.
let accessToken: string | null = null
let identity: string | null = null
let changed = false // session changed under this tab: no refresh is adopted until a new login sets a token
export const setAccessToken = (t: string | null) => {
  accessToken = t
  identity = t ? tokenIdentity(t) : null
  if (t) changed = false
}
export const getAccessToken = () => accessToken
export const getIdentity = () => identity

// Called when a refresh returns another account's session (another tab logged in / out, impersonation expired).
let onSessionChanged: ((why: SessionChange) => void) | null = null
export const setOnSessionChanged = (fn: ((why: SessionChange) => void) | null) => {
  onSessionChanged = fn
}

// Every request carries this signal; an identity change aborts whatever is still in flight.
let live = new AbortController()
export function abortPending() {
  live.abort()
  live = new AbortController()
}

/** Stop this tab's session after a change (refresh mismatch or another tab's login / logout). */
export function blockSession() {
  setAccessToken(null)
  changed = true
  abortPending()
}

// Active branch context for admins (id in subtree, or 'all'); set by the auth layer.
let activeBranch: string | null = null
export const setActiveBranch = (b: string | null) => {
  activeBranch = b
}

// Called when a token refresh fails mid-session (session gone) so the UI can log the user out.
let onAuthLost: (() => void) | null = null
export const setOnAuthLost = (fn: (() => void) | null) => {
  onAuthLost = fn
}

export interface RequestOpts {
  mpin?: string
  signal?: AbortSignal
}

async function raw<T>(method: string, path: string, body?: unknown, opts: RequestOpts = {}): Promise<T> {
  if (USE_MOCK && mockSupports(path)) return mockHandle<T>(method, path, body)

  // FormData (file uploads, CSV import): let the browser set the multipart Content-Type + boundary.
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData
  const headers: Record<string, string> = {}
  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json'
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`
  if (activeBranch) headers[HEADERS.BRANCH] = activeBranch
  if (opts.mpin) headers[HEADERS.MPIN] = opts.mpin

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    credentials: 'include',
    body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
    // AbortSignal.any is 2024+ (Chrome 116 / Safari 17.4); older browsers keep the caller's own signal
    signal: !opts.signal ? live.signal : typeof AbortSignal.any === 'function' ? AbortSignal.any([opts.signal, live.signal]) : opts.signal,
  })
  if (res.status === 204) return undefined as T
  const data = res.status === 0 ? null : await res.json().catch(() => null)
  if (!res.ok) {
    const e = (data as ApiError | null)?.error
    throw new ApiException(res.status, e?.code ?? 'INTERNAL', e?.message ?? res.statusText, e?.details)
  }
  return data as T
}

// Single-flight refresh of the access token using the cookie. Shared by request-retry AND
// the initial session restore, so StrictMode's double-invoke can't fire two /auth/refresh calls
// (which the backend's reuse detection would treat as a stolen token and revoke all sessions).
// Across tabs a Web Lock serialises refreshes: two tabs presenting the same cookie at once would look like token reuse
// (the backend then revokes every session); the second tab waits and sends the rotated cookie.
let refreshing: Promise<boolean> | null = null
export function refreshAccessToken(): Promise<boolean> {
  if (changed) return Promise.resolve(false) // a stray request must not quietly pick up the new cookie's session
  const post = () => raw<{ accessToken: string }>('POST', '/auth/refresh')
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined
  refreshing ??= (locks ? locks.request('ju-auth-refresh', post) : post())
    .then((r) => {
      const mine = identity
      const next = tokenIdentity(r.accessToken)
      if (mine && next !== mine) {
        // the cookie now belongs to another session: never adopt it, stop everything in flight
        blockSession()
        onSessionChanged?.(refreshChange(mine, next))
        return false
      }
      setAccessToken(r.accessToken)
      return true
    })
    .catch(() => {
      setAccessToken(null)
      return false
    })
    .finally(() => {
      refreshing = null
    })
  return refreshing
}

export async function request<T>(method: string, path: string, body?: unknown, opts?: RequestOpts): Promise<T> {
  try {
    return await raw<T>(method, path, body, opts)
  } catch (err) {
    // One silent refresh+retry on an expired access token (not on the refresh call itself).
    if (err instanceof ApiException && err.status === 401 && err.code === 'UNAUTHENTICATED' && !path.startsWith('/auth/refresh')) {
      if (await refreshAccessToken()) return raw<T>(method, path, body, opts)
      if (!changed) onAuthLost?.() // refresh failed → session is gone; kick to login instead of looping 401s
    }
    throw err
  }
}

// Authed binary GET (e.g. stock/party photos served behind requirePermission) → Blob for an object URL.
// Browser <img> can't send the bearer token, so fetch it here with one silent refresh+retry on 401.
export async function fetchBlob(path: string): Promise<Blob> {
  const once = () => {
    const headers: Record<string, string> = {}
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`
    if (activeBranch) headers[HEADERS.BRANCH] = activeBranch
    return fetch(`/api${path}`, { headers, credentials: 'include', signal: live.signal })
  }
  let res = await once()
  if (res.status === 401 && (await refreshAccessToken())) res = await once()
  if (!res.ok) throw new ApiException(res.status, 'INTERNAL', res.statusText)
  return res.blob()
}

export const api = {
  get: <T>(path: string, opts?: RequestOpts) => request<T>('GET', path, undefined, opts),
  blob: fetchBlob,
  post: <T>(path: string, body?: unknown, opts?: RequestOpts) => request<T>('POST', path, body, opts),
  patch: <T>(path: string, body?: unknown, opts?: RequestOpts) => request<T>('PATCH', path, body, opts),
  put: <T>(path: string, body?: unknown, opts?: RequestOpts) => request<T>('PUT', path, body, opts),
  del: <T>(path: string, opts?: RequestOpts) => request<T>('DELETE', path, undefined, opts),
}
