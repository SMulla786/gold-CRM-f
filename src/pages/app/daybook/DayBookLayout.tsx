import { NavLink, Outlet } from 'react-router-dom'

import { useAuth } from '@/lib/auth'
import { cn } from '@/lib/utils'

const TABS = [
  { to: '/app/daybook', label: 'Summary', key: 'daybook.all_in_one', end: true },
  { to: '/app/daybook/all-in-one', label: 'All-in-One', key: 'daybook.all_in_one' },
  { to: '/app/daybook/money', label: 'Money', key: 'daybook.money' },
  { to: '/app/daybook/gold', label: 'Gold', key: 'daybook.gold' },
  { to: '/app/daybook/silver', label: 'Silver', key: 'daybook.silver' },
  { to: '/app/daybook/stone', label: 'Stone', key: 'daybook.stone' },
  { to: '/app/daybook/artificial', label: 'Artificial', key: 'daybook.artificial' },
  { to: '/app/daybook/franchise', label: 'Franchise', key: 'daybook.franchise' },
]

export function DayBookLayout() {
  const { can } = useAuth()
  const tabs = TABS.filter((t) => can(t.key, 'view'))
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Day-Book &amp; Ledgers</h1>
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
