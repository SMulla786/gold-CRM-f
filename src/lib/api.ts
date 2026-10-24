import { HEADERS, type ApiError } from '@/shared'
import { ApiException } from '@/lib/errors'
import { mockHandle, mockSupports } from '@/mocks/api'

// Mock is on unless explicitly disabled (flip VITE_USE_MOCK=false once backend auth lands).
const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false'

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

export interface RequestOpts {
  mpin?: string
  signal?: AbortSignal
}

async function raw<T>(method: string, path: string, body?: unknown, opts: RequestOpts = {}): Promise<T> {
  if (USE_MOCK && mockSupports(path)) return mockHandle<T>(method, path, body)

  const headers: Record<string, string> = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`
  if (activeBranch) headers[HEADERS.BRANCH] = activeBranch
  if (opts.mpin) headers[HEADERS.MPIN] = opts.mpin

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    credentials: 'include',
    body: body === undefined ? undefined : JSON.stringify(body),
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

// Refresh the access token using the cookie, retrying the failed request once.
let refreshing: Promise<boolean> | null = null
async function tryRefresh(): Promise<boolean> {
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
      if (await tryRefresh()) return raw<T>(method, path, body, opts)
    }
    throw err
  }
}

export const api = {
  get: <T>(path: string, opts?: RequestOpts) => request<T>('GET', path, undefined, opts),
  post: <T>(path: string, body?: unknown, opts?: RequestOpts) => request<T>('POST', path, body, opts),
  patch: <T>(path: string, body?: unknown, opts?: RequestOpts) => request<T>('PATCH', path, body, opts),
  put: <T>(path: string, body?: unknown, opts?: RequestOpts) => request<T>('PUT', path, body, opts),
  del: <T>(path: string, opts?: RequestOpts) => request<T>('DELETE', path, undefined, opts),
}
