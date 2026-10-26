import { NavLink, Outlet } from 'react-router-dom'

import { useAuth } from '@/lib/auth'
import { cn } from '@/lib/utils'

const TABS = [
  { to: '/app/orders/new', label: 'New Order', key: 'orders.create' },
  { to: '/app/orders', label: 'Orders', key: 'orders.list', end: true },
  { to: '/app/orders/karigar', label: 'Karigar', key: 'orders.karigar_list' },
]

export function OrdersLayout() {
  const { can } = useAuth()
  const tabs = TABS.filter((t) => can(t.key, 'view'))
  return (
    <div className="space-y-6">
      <header>
        <h1>Orders</h1>
        <p className="mt-1 text-sm text-muted-foreground">Take custom jobs, track them through making and hand over finished pieces.</p>
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
