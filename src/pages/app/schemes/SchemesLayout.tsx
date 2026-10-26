import { NavLink, Outlet } from 'react-router-dom'

import { useAuth } from '@/lib/auth'
import { cn } from '@/lib/utils'

const TABS = [
  { to: '/app/schemes', label: 'All Schemes', key: 'schemes.all', end: true },
  { to: '/app/schemes/groups', label: 'Groups', key: 'schemes.groups' },
  { to: '/app/schemes/enroll', label: 'Enrol', key: 'schemes.enroll' },
  { to: '/app/schemes/bulk-enroll', label: 'Bulk Enrol', key: 'schemes.enroll' },
  { to: '/app/schemes/members', label: 'Members', key: 'schemes.all' },
  { to: '/app/schemes/dues', label: 'Dues', key: 'schemes.due_list' },
  { to: '/app/schemes/transactions', label: 'Transactions', key: 'schemes.transactions' },
  { to: '/app/schemes/day-book', label: 'Day Book', key: 'schemes.daybook' },
  { to: '/app/schemes/anjuman', label: 'Anjuman', key: 'schemes.anjuman' },
]

export function SchemesLayout() {
  const { can } = useAuth()
  const tabs = TABS.filter((t) => can(t.key, 'view'))
  return (
    <div className="space-y-6">
      <header>
        <h1>Saving schemes</h1>
        <p className="mt-1 text-sm text-muted-foreground">Recurring EMI savings plans, enrolments, dues and the scheme day-book.</p>
      </header>
      <nav className="flex flex-wrap gap-1 border-b">
        {tabs.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => cn('border-b-2 px-3 py-2 text-sm font-medium', isActive ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}>
            {t.label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  )
}
