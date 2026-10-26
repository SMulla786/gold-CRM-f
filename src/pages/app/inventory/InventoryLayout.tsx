import { NavLink, Outlet } from 'react-router-dom'

import { useAuth } from '@/lib/auth'
import { cn } from '@/lib/utils'

const TABS = [
  { to: '/app/inventory', label: 'Dashboard', key: 'inventory.dashboard', end: true },
  { to: '/app/inventory/masters', label: 'Item Masters', key: 'inventory.item_masters' },
  { to: '/app/inventory/new', label: 'New Stock', key: 'inventory.new_stock' },
  { to: '/app/inventory/stock', label: 'Stock', key: 'inventory.all_stock' },
  { to: '/app/inventory/groups', label: 'Group-wise', key: 'inventory.all_stock' },
  { to: '/app/inventory/summary', label: 'All Stock Summary', key: 'inventory.all_stock' },
  { to: '/app/inventory/import', label: 'Import', key: 'inventory.import_stock' },
  { to: '/app/inventory/shortage', label: 'Shortage', key: 'inventory.all_stock' },
  { to: '/app/inventory/transfers', label: 'Transfer', key: 'inventory.stock_transfer', needsBranches: true },
  { to: '/app/inventory/tags', label: 'Tags', key: 'inventory.tag_print' },
  { to: '/app/inventory/scan', label: 'Scan/Match', key: 'inventory.scan_match' },
  { to: '/app/inventory/printer', label: 'Printer settings', key: 'inventory.printer_setting' },
  { to: '/app/inventory/tag-editor', label: 'Tag editor', key: 'inventory.printer_setting' },
]

export function InventoryLayout() {
  const { can, me } = useAuth()
  const multiBranch = (me?.accessibleBranches.length ?? 0) >= 2
  const tabs = TABS.filter((t) => can(t.key, 'view') && (!t.needsBranches || multiBranch))
  return (
    <div className="space-y-6">
      <header>
        <h1>Inventory</h1>
        <p className="mt-1 text-sm text-muted-foreground">Stock on hand, tagging and movement of pieces between branches.</p>
      </header>
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
