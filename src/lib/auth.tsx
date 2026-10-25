import { useQueryClient } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

import { api, refreshAccessToken, setAccessToken, setActiveBranch, setOnAuthLost } from '@/lib/api'
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
    setOnAuthLost(() => apply(null))
    return () => setOnAuthLost(null)
  }, [apply])

  const setBranch = useCallback((b: string) => {
    setActiveBranchState(b)
    setActiveBranch(b)
  }, [])

  const login = useCallback(
    async (loginId: string, password: string) => {
      const res = await api.post<LoginResponse>('/auth/login', { login: loginId, password })
      setAccessToken(res.accessToken)
      apply(res.user)
      return res.user
    },
    [apply],
  )

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout')
    } finally {
      setAccessToken(null)
      apply(null)
      queryClient.clear() // drop cached data so the next user on this terminal can't see it
    }
  }, [apply, queryClient])

  const impersonate = useCallback(
    async (businessId: number, reason: string) => {
      const res = await api.post<LoginResponse>(`/platform/businesses/${businessId}/impersonate`, { reason })
      setAccessToken(res.accessToken)
      queryClient.clear() // never let one business's cached data bleed into another
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
    queryClient.clear()
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

  return <AuthContext value={value}>{children}</AuthContext>
}

export function useAuth() {
  const v = useContext(AuthContext)
  if (!v) throw new Error('useAuth must be used within AuthProvider')
  return v
}
