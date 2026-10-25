import { NavLink, Outlet } from 'react-router-dom'

import { useAuth } from '@/lib/auth'
import { cn } from '@/lib/utils'

const TABS = [
  { to: '/app/buy_sell/new', label: 'New Buy/Sell', key: 'buy_sell.entry' },
  { to: '/app/buy_sell', label: 'Trades', key: 'buy_sell.list', end: true },
  { to: '/app/buy_sell/bhav', label: 'Bhav Booking', key: 'buy_sell.bhav_booking' },
]

export function BuySellLayout() {
  const { can } = useAuth()
  const tabs = TABS.filter((t) => can(t.key, 'view'))
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Buy / Sell (bullion)</h1>
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
