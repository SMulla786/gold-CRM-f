import { Navigate, Outlet } from 'react-router-dom'

import { useAuth } from '@/lib/auth'
import type { UserLevel } from '@/shared'

export const homeForLevel = (level: UserLevel): string =>
  level === 'SUPER_ADMIN' ? '/platform' : level === 'ADMIN' ? '/admin' : '/app'

function Loading() {
  return <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">Loading…</div>
}

/** Gate for any authenticated area. */
export function RequireAuth() {
  const { me, loading } = useAuth()
  if (loading) return <Loading />
  if (!me) return <Navigate to="/login" replace />
  return <Outlet />
}

/** Gate by user level; sends the wrong level back to its own home. */
export function RequireLevel({ levels }: { levels: UserLevel[] }) {
  const { me } = useAuth()
  if (!me) return <Navigate to="/login" replace />
  if (!levels.includes(me.level)) return <Navigate to={homeForLevel(me.level)} replace />
  return <Outlet />
}
