import { NavLink, Outlet } from 'react-router-dom'

import { useAuth } from '@/lib/auth'
import { cn } from '@/lib/utils'

const TABS = [
  { to: '/app/udhari', label: 'New Udhar', key: 'udhari.entry', end: true },
  { to: '/app/udhari/ledger', label: 'Udhar Ledger', key: 'udhari.ledger' },
  { to: '/app/udhari/list', label: 'Udhar List', key: 'udhari.ledger' },
  { to: '/app/udhari/pending', label: 'Pending Bills', key: 'udhari.ledger' },
]

export function UdhariLayout() {
  const { can } = useAuth()
  const tabs = TABS.filter((t) => can(t.key, 'view'))
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Udhari</h1>
      <nav className="flex flex-wrap gap-1 border-b">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) =>
              cn('border-b-2 px-3 py-2 text-sm font-medium', isActive ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')
            }
          >
            {t.label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  )
}
