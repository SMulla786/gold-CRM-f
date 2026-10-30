import { useQueryClient } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

import { SessionChanged } from '@/components/SessionChanged'
import { clearAdState } from '@/lib/ads'
import { api, blockSession, getIdentity, refreshAccessToken, setAccessToken, setActiveBranch, setOnAuthLost, setOnSessionChanged } from '@/lib/api'
import { announce, cookieOwner, onAnnounce, reactTo, type SessionChange } from '@/lib/session'
import { dropUserState } from '@/lib/userState'
import type { LoginResponse, MeDto, PermissionAction } from '@/shared'

interface AuthValue {
  me: MeDto | null
  loading: boolean
  /** Active branch context for admins: a branch id (string) or 'all'. */
  activeBranch: string
  setBranch: (b: string) => void
  login: (login: string, password: string) => Promise<MeDto>
  logout: () => Promise<void>
  /** Super Admin: act as a business's owner (sets impersonated session). */
  impersonate: (businessId: number, reason: string) => Promise<void>
  endImpersonation: () => Promise<void>
  can: (pageKey: string, action?: PermissionAction) => boolean
  hasModule: (moduleKey: string, core?: boolean) => boolean
  readOnly: boolean
}

const AuthContext = createContext<AuthValue | null>(null)

const defaultBranch = (me: MeDto): string =>
  me.level === 'ADMIN' ? 'all' : me.branch ? String(me.branch.id) : 'all'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<MeDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeBranch, setActiveBranchState] = useState('all')
  const [changed, setChanged] = useState<SessionChange | null>(null)
  const queryClient = useQueryClient()

  const apply = useCallback((user: MeDto | null) => {
    setMe(user)
    const b = user ? defaultBranch(user) : 'all'
    setActiveBranchState(b)
    setActiveBranch(user ? b : null)
  }, [])

  // Refresh the access token from the cookie (single-flight, shared with request-retry), then load /me.
  const restore = useCallback(async () => {
    if (await refreshAccessToken()) apply(await api.get<MeDto>('/auth/me'))
    else apply(null)
  }, [apply])

  useEffect(() => {
    let alive = true
    restore().finally(() => {
      if (alive) setLoading(false)
    })
    return () => {
      alive = false
    }
  }, [restore])

  // A mid-session refresh failure (api.ts) means the session is gone — drop to logged-out so guards redirect.
  useEffect(() => {
    setOnAuthLost(() => {
      apply(null)
      queryClient.clear() // the next user signing in here must not see this one's cached data
      clearAdState('/login')
    })
    return () => setOnAuthLost(null)
  }, [apply, queryClient])

  // ISS-19: the session changed under this tab (another tab's login / logout, impersonation expired). Never carry on
  // as the new account: stop requests, clear this user's state and block the app until a reload re-verifies identity.
  const endSession = useCallback(
    (why: SessionChange) => {
      blockSession() // pending requests, token, and no refresh until a reload / new login
      queryClient.clear()
      apply(null)
      setChanged(why)
    },
    [apply, queryClient],
  )
  useEffect(() => {
    setOnSessionChanged(endSession)
    const off = onAnnounce((e) => {
      const why = reactTo(e, getIdentity())
      if (why) endSession(why)
    })
    return () => {
      setOnSessionChanged(null)
      off()
    }
  }, [endSession])

  const setBranch = useCallback((b: string) => {
    setActiveBranchState(b)
    setActiveBranch(b)
  }, [])

  const login = useCallback(
    async (loginId: string, password: string) => {
      const res = await api.post<LoginResponse>('/auth/login', { login: loginId, password })
      queryClient.clear() // nothing cached for a previous user survives a login
      setAccessToken(res.accessToken)
      apply(res.user)
      const mine = getIdentity()
      if (mine) announce({ type: 'login', who: cookieOwner(mine) }) // ids only: other tabs of another account stop
      return res.user
    },
    [apply, queryClient],
  )

  const logout = useCallback(async () => {
    const mine = getIdentity()
    try {
      await api.post('/auth/logout')
    } finally {
      dropUserState(queryClient) // pending requests, token and cached data, so the next user can't see them
      apply(null)
      if (mine) announce({ type: 'logout', who: cookieOwner(mine) })
      clearAdState('/login') // an AdSense script that ran for this user must not follow the next one
    }
  }, [apply, queryClient])

  const impersonate = useCallback(
    async (businessId: number, reason: string) => {
      // before the session switch: a Super Admin never loads ads, so this only fires if a script leaked into this tab
      if (clearAdState('/platform')) return
      const res = await api.post<LoginResponse>(`/platform/businesses/${businessId}/impersonate`, { reason })
      dropUserState(queryClient) // never let one business's cached data (or a pending request) bleed into another
      setAccessToken(res.accessToken)
      apply(res.user)
    },
    [apply, queryClient],
  )

  // End impersonation by restoring the real (super admin) session from the cookie.
  const endImpersonation = useCallback(async () => {
    try {
      await api.post('/platform/impersonation/end')
    } catch {
      // ignore — restore is what matters
    }
    dropUserState(queryClient) // also forgets the impersonated identity, so restore() adopts the Super Admin's own session
    if (clearAdState('/platform')) return
    await restore()
  }, [restore, queryClient])

  const value = useMemo<AuthValue>(
    () => ({
      me,
      loading,
      activeBranch,
      setBranch,
      login,
      logout,
      impersonate,
      endImpersonation,
      readOnly: Boolean(me && (me.subscription?.readOnly || me.business?.status === 'SUSPENDED')),
      can: (pageKey, action = 'view') => {
        if (!me) return false
        if (me.level === 'SUPER_ADMIN' || me.level === 'ADMIN') return true
        return !!me.permissions[pageKey]?.[action]
      },
      hasModule: (moduleKey, core = false) =>
        !!me && (core || me.level === 'SUPER_ADMIN' || me.modules.includes(moduleKey)),
    }),
    [me, loading, activeBranch, setBranch, login, logout, impersonate, endImpersonation],
  )

  return <AuthContext value={value}>{changed ? <SessionChanged why={changed} /> : children}</AuthContext>
}

export function useAuth() {
  const v = useContext(AuthContext)
  if (!v) throw new Error('useAuth must be used within AuthProvider')
  return v
}
