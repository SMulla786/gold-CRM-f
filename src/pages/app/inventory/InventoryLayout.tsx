import { NavLink, Outlet } from 'react-router-dom'

import { cn } from '@/lib/utils'

const TABS = [
  { to: '/app/inventory', label: 'Dashboard', end: true },
  { to: '/app/inventory/masters', label: 'Item Masters' },
  { to: '/app/inventory/new', label: 'New Stock' },
  { to: '/app/inventory/stock', label: 'Stock' },
  { to: '/app/inventory/groups', label: 'Group-wise' },
  { to: '/app/inventory/import', label: 'Import' },
  { to: '/app/inventory/shortage', label: 'Shortage' },
]

export function InventoryLayout() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Inventory</h1>
      <nav className="flex flex-wrap gap-1 border-b">
        {TABS.map((t) => (
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
