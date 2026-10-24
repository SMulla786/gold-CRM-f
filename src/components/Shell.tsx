import { LogOut } from 'lucide-react'
import { Suspense } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'

import { BranchSwitcher } from '@/components/BranchSwitcher'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth'
import type { NavItem } from '@/lib/nav'
import { cn } from '@/lib/utils'

interface ShellProps {
  area: string
  nav: NavItem[]
  /** Show the branch switcher (admin consoles + store app). */
  showBranch?: boolean
}

export function Shell({ area, nav, showBranch }: ShellProps) {
  const { me, logout, readOnly, endImpersonation } = useAuth()
  const navigate = useNavigate()

  const onEndImpersonation = async () => {
    await endImpersonation()
    navigate('/platform', { replace: true })
  }

  return (
    <div className="flex min-h-screen flex-col">
      {me?.impersonatedBy && (
        <div className="flex items-center justify-center gap-3 bg-amber-500 px-4 py-1.5 text-center text-sm font-medium text-black">
          Viewing as {me.name}
          {me.business ? ` · ${me.business.name}` : ''} — support session by {me.impersonatedBy.name}
          <Button variant="outline" size="sm" className="h-6 border-black/30 bg-transparent text-black hover:bg-black/10" onClick={() => void onEndImpersonation()}>
            End
          </Button>
        </div>
      )}

      <header className="flex h-14 shrink-0 items-center gap-4 border-b bg-card px-4">
        <span className="font-semibold">Just Udhari</span>
        <span className="rounded bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">{area}</span>
        <div className="ml-auto flex items-center gap-3">
          {showBranch && <BranchSwitcher />}
          <span className="text-sm text-muted-foreground">{me?.name}</span>
          <Button variant="ghost" size="icon" onClick={() => void logout()} aria-label="Log out">
            <LogOut />
          </Button>
        </div>
      </header>

      {readOnly && (
        <div className="bg-destructive px-4 py-1.5 text-center text-sm font-medium text-destructive-foreground">
          READ-ONLY MODE · subscription inactive — viewing allowed, changes blocked
        </div>
      )}

      <div className="flex flex-1">
        <nav className="w-56 shrink-0 border-r bg-card p-2">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to.split('/').length <= 2}
              className={({ isActive }) =>
                cn(
                  'block rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <main className="flex-1 p-6">
          <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  )
}
