import { NavLink, Outlet } from 'react-router-dom'

import { useAuth } from '@/lib/auth'
import { cn } from '@/lib/utils'

const TABS = [
  { to: '/app/exchange/new', label: 'New Exchange', key: 'exchange.entry' },
  { to: '/app/exchange', label: 'Exchanges', key: 'exchange.list', end: true },
  { to: '/app/exchange/kacha', label: 'Kacha / Melting', key: 'exchange.entry' },
]

export function ExchangeLayout() {
  const { can } = useAuth()
  const tabs = TABS.filter((t) => can(t.key, 'view'))
  return (
    <div className="space-y-6">
      <header>
        <h1>Old Jewellery Exchange</h1>
        <p className="mt-1 text-sm text-muted-foreground">Buy and sell old gold and silver, and track the scrap pool.</p>
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
