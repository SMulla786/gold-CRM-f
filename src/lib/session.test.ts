import { QueryClient } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { abortPending, api, blockSession, getAccessToken, getIdentity, setAccessToken, setOnAuthLost, setOnSessionChanged } from './api'
import { announce, cookieOwner, reactTo, refreshChange, tokenIdentity, type AuthEvent } from './session'
import { dropUserState } from './userState'

// ISS-19 cross-tab session safety. "Tabs" share one refresh cookie: the mocked /auth/refresh returns whatever
// session the cookie holds now. Tokens are fake JWTs (only the payload is read client-side).
const tok = (sub: number, imp?: number, n = 0) => `h.${btoa(JSON.stringify({ sub, sid: `s${n}`, ...(imp ? { imp } : {}) }))}.sig`
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const expired = () => json(401, { error: { code: 'UNAUTHENTICATED', message: 'expired' } })

let cookie: string // the session the shared refresh cookie currently holds
let calls: { path: string; auth: string | undefined }[]
let routes: Record<string, (init: RequestInit) => Promise<Response> | Response>
const changed = vi.fn()
const lost = vi.fn()

beforeEach(() => {
  calls = []
  routes = {}
  changed.mockReset()
  lost.mockReset()
  setAccessToken(tok(0)) // adopting a token clears a previous test's blocked state (module-level, like a fresh tab)
  setAccessToken(null)
  setOnSessionChanged(changed)
  setOnAuthLost(lost)
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
    const path = url.replace(/^\/api/, '')
    calls.push({ path, auth: (init.headers as Record<string, string>).Authorization })
    if (path === '/auth/refresh') return json(200, { accessToken: cookie })
    return routes[path]!(init)
  }))
})
afterEach(() => {
  vi.unstubAllGlobals()
  setOnSessionChanged(null)
  setOnAuthLost(null)
})

describe('identity helpers', () => {
  it('reads sub / imp from a token, never trusts an unreadable one', () => {
    expect([tokenIdentity(tok(7)), tokenIdentity(tok(7, 1)), tokenIdentity('garbage'), tokenIdentity('a.b.c')]).toEqual(['7:', '7:1', null, null])
    expect([cookieOwner('7:'), cookieOwner('7:1')]).toEqual(['7', '1'])
    expect([refreshChange('7:1', '1:'), refreshChange('7:1', '9:'), refreshChange('7:', '9:'), refreshChange('7:', null)]).toEqual(['impersonation-ended', 'other-user', 'other-user', 'other-user'])
  })
})

describe('1 · two tabs, two users', () => {
  it("tab A's expired token never turns into B's session: no retry as B, A's state stops, the app is told why", async () => {
    setAccessToken(tok(1)) // tab A = user 1
    cookie = tok(2) // tab B logged in as user 2: the shared cookie is now B's
    routes['/stock'] = () => expired()
    await expect(api.get('/stock')).rejects.toMatchObject({ status: 401 })
    expect(calls.map((c) => c.path)).toEqual(['/stock', '/auth/refresh']) // never retried
    expect(calls.some((c) => c.auth === `Bearer ${tok(2)}`)).toBe(false)
    expect([changed.mock.calls, lost.mock.calls.length, getAccessToken(), getIdentity()]).toEqual([[['other-user']], 0, null, null])
  })

  it('broadcast: a login of another account stops this tab; the same account logging in again does not', () => {
    expect(reactTo({ type: 'login', who: '2' }, '1:')).toBe('other-user')
    expect(reactTo({ type: 'login', who: '1' }, '1:')).toBeNull()
    expect(reactTo({ type: 'login', who: '2' }, null)).toBeNull() // a logged-out tab has nothing to protect
  })

  it('events cross tabs with ids only (no token in the message)', async () => {
    const other = new BroadcastChannel('ju-auth') // "another tab"
    const got = new Promise<AuthEvent>((r) => other.addEventListener('message', (m) => r((m as MessageEvent<AuthEvent>).data), { once: true }))
    announce({ type: 'login', who: '2' })
    expect(await got).toEqual({ type: 'login', who: '2' })
    other.close()
  })
})

describe('2 · logout in another tab', () => {
  it('the same account signed out elsewhere → signed-out; another account signing out is not ours', () => {
    expect(reactTo({ type: 'logout', who: '1' }, '1:')).toBe('signed-out')
    expect(reactTo({ type: 'logout', who: '2' }, '1:')).toBeNull()
  })

  it('without the broadcast: the next refresh fails → the plain session-lost path, still no other identity', async () => {
    setAccessToken(tok(1))
    vi.mocked(fetch).mockImplementation(async (url) => (String(url).endsWith('/auth/refresh') ? json(401, { error: { code: 'UNAUTHENTICATED' } }) : expired()))
    await expect(api.get('/stock')).rejects.toMatchObject({ status: 401 })
    expect([lost.mock.calls.length, changed.mock.calls.length, getAccessToken()]).toEqual([1, 0, null])
  })
})

describe('3 · refresh-token rotation', () => {
  it('the same user rotating (any tab) is adopted and the request retried once; parallel 401s share one refresh', async () => {
    setAccessToken(tok(1, undefined, 1))
    cookie = tok(1, undefined, 2)
    let first = true
    routes['/stock'] = () => (first ? ((first = false), expired()) : json(200, { ok: 1 }))
    routes['/parties'] = () => json(200, { ok: 2 })
    expect(await api.get('/stock')).toEqual({ ok: 1 })
    expect(getAccessToken()).toBe(cookie)
    expect(calls.at(-1)).toEqual({ path: '/stock', auth: `Bearer ${cookie}` })
    expect(changed).not.toHaveBeenCalled()

    calls = []
    setAccessToken(tok(1, undefined, 3))
    let n = 0
    routes['/a'] = () => (n++ < 2 ? expired() : json(200, {}))
    routes['/b'] = routes['/a']
    await Promise.all([api.get('/a'), api.get('/b')])
    expect(calls.filter((c) => c.path === '/auth/refresh')).toHaveLength(1)
  })

  it('cross-tab: the refresh runs under a Web Lock so two tabs never present one cookie at the same time', async () => {
    const request = vi.fn((_name: string, fn: () => Promise<unknown>) => fn())
    vi.stubGlobal('navigator', { locks: { request } })
    setAccessToken(tok(1))
    cookie = tok(1, undefined, 9)
    let first = true
    routes['/stock'] = () => (first ? ((first = false), expired()) : json(200, {}))
    await api.get('/stock')
    expect(request).toHaveBeenCalledWith('ju-auth-refresh', expect.any(Function))
  })
})

describe('4 · impersonation start / end', () => {
  it('impersonation token expiring → the cookie gives back the Super Admin: never adopted, reported as impersonation ended', async () => {
    setAccessToken(tok(5, 1)) // owner 5 impersonated by Super Admin 1 (token in memory only)
    cookie = tok(1) // the cookie is still the Super Admin's own session
    routes['/app/stock'] = () => expired()
    await expect(api.get('/app/stock')).rejects.toBeTruthy()
    expect([changed.mock.calls, getAccessToken()]).toEqual([[['impersonation-ended']], null])
  })

  it('ending it on purpose drops the impersonated identity first, so restoring adopts the Super Admin session', async () => {
    setAccessToken(tok(5, 1))
    dropUserState(new QueryClient()) // what endImpersonation does before restore()
    cookie = tok(1)
    routes['/auth/me'] = () => json(200, { id: 1 })
    const { refreshAccessToken } = await import('./api')
    expect(await refreshAccessToken()).toBe(true)
    expect([getIdentity(), changed.mock.calls.length]).toEqual(['1:', 0])
  })

  it('a Super Admin signing out elsewhere also stops the tab impersonating through that session', () => {
    expect(reactTo({ type: 'logout', who: '1' }, '5:1')).toBe('signed-out')
    expect(reactTo({ type: 'login', who: '3' }, '5:1')).toBe('other-user')
  })
})

describe('5 · stale React Query data', () => {
  it("dropping a user's state empties every cached query and forgets the token", () => {
    const qc = new QueryClient()
    qc.setQueryData(['parties', { page: 1 }], { items: [{ name: 'A customer' }] })
    qc.setQueryData(['me'], { id: 1 })
    setAccessToken(tok(1))
    dropUserState(qc)
    expect([qc.getQueryCache().getAll().length, getAccessToken(), getIdentity()]).toEqual([0, null, null])
  })
})

describe('6 · pending requests during an identity change', () => {
  const hanging = (init: RequestInit) =>
    new Promise<Response>((_, reject) => init.signal!.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))))

  it('abortPending stops in-flight requests; new requests still work', async () => {
    routes['/slow'] = hanging
    const p = api.get('/slow')
    abortPending()
    await expect(p).rejects.toMatchObject({ name: 'AbortError' })
    routes['/ok'] = () => json(200, { ok: true })
    expect(await api.get('/ok')).toEqual({ ok: true })
  })

  it('a refresh that meets another account aborts every other request still in flight', async () => {
    setAccessToken(tok(1))
    cookie = tok(2)
    routes['/slow'] = hanging
    routes['/stock'] = () => expired()
    const slow = api.get('/slow')
    await expect(api.get('/stock')).rejects.toBeTruthy()
    await expect(slow).rejects.toMatchObject({ name: 'AbortError' })
  })
})

describe('7 · permission isolation between accounts', () => {
  it("after a change nothing is sent with either account's token: the server decides from scratch", async () => {
    setAccessToken(tok(1))
    cookie = tok(2)
    routes['/stock'] = () => expired()
    await expect(api.get('/stock')).rejects.toBeTruthy()
    routes['/admin/users'] = () => json(401, { error: { code: 'UNAUTHENTICATED' } })
    await expect(api.get('/admin/users')).rejects.toBeTruthy()
    expect(calls.filter((c) => c.path === '/admin/users').map((c) => c.auth)).toEqual([undefined])
    expect(calls.filter((c) => c.path === '/auth/refresh')).toHaveLength(1) // only the one that detected the change
  })

  it('a block from another tab (broadcast) also refuses any later refresh until a new login', async () => {
    setAccessToken(tok(1))
    blockSession() // what AuthProvider does on reactTo(...) = 'signed-out' / 'other-user'
    cookie = tok(2)
    routes['/stock'] = () => expired()
    await expect(api.get('/stock')).rejects.toBeTruthy()
    expect([calls.map((c) => c.path), getIdentity(), lost.mock.calls.length]).toEqual([['/stock'], null, 0])
    setAccessToken(tok(2)) // an explicit login in this tab
    expect(getIdentity()).toBe('2:')
  })
})
