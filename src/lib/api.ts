import { HEADERS, type ApiError } from '@/shared'
import { ApiException } from '@/lib/errors'
import { mockHandle, mockSupports } from '@/mocks/api'

// Mock is OPT-IN: set VITE_USE_MOCK=true (e.g. .env.local) to run the UI without a backend.
// Any real build (no var) talks to the real API, so we never ship the mock demo app by accident.
const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

export { ApiException }

// Access token lives in memory only; refresh token is the httpOnly ju_rt cookie.
let accessToken: string | null = null
export const setAccessToken = (t: string | null) => {
  accessToken = t
}
export const getAccessToken = () => accessToken

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
    signal: opts.signal,
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
let refreshing: Promise<boolean> | null = null
export function refreshAccessToken(): Promise<boolean> {
  refreshing ??= raw<{ accessToken: string }>('POST', '/auth/refresh')
    .then((r) => {
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
      onAuthLost?.() // refresh failed → session is gone; kick to login instead of looping 401s
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
    return fetch(`/api${path}`, { headers, credentials: 'include' })
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
