import { NavLink, Outlet } from 'react-router-dom'

import { useAuth } from '@/lib/auth'
import { SAMPLES_PERM } from '@/lib/samplesQueries'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'

// `key` = permission key; `tk` = i18n key for the label (translated at render).
const TABS = [
  { to: '/app/inventory', tk: 'dash.title', key: 'inventory.dashboard', end: true },
  { to: '/app/inventory/masters', tk: 'inv.tab.masters', key: 'inventory.item_masters' },
  { to: '/app/inventory/new', tk: 'inv.tab.new_stock', key: 'inventory.new_stock' },
  { to: '/app/inventory/stock', tk: 'inv.tab.stock', key: 'inventory.all_stock' },
  { to: '/app/inventory/groups', tk: 'inv.tab.groups', key: 'inventory.all_stock' },
  { to: '/app/inventory/summary', tk: 'inv.tab.summary', key: 'inventory.all_stock' },
  { to: '/app/inventory/import', tk: 'inv.import.import', key: 'inventory.import_stock' },
  { to: '/app/inventory/shortage', tk: 'inv.shortage.st_shortage', key: 'inventory.all_stock' },
  { to: '/app/inventory/samples', tk: 'samples.tab', key: SAMPLES_PERM },
  { to: '/app/inventory/transfers', tk: 'inv.tab.transfer', key: 'inventory.stock_transfer', needsBranches: true },
  { to: '/app/inventory/tags', tk: 'inv.tab.tags', key: 'inventory.tag_print' },
  { to: '/app/inventory/scan', tk: 'inv.tab.scan', key: 'inventory.scan_match' },
  { to: '/app/inventory/printer', tk: 'inv.printer.title', key: 'inventory.printer_setting' },
  { to: '/app/inventory/tag-editor', tk: 'inv.editor.title', key: 'inventory.printer_setting' },
]

export function InventoryLayout() {
  const t = useT()
  const { can, me } = useAuth()
  const multiBranch = (me?.accessibleBranches.length ?? 0) >= 2
  const tabs = TABS.filter((tab) => can(tab.key, 'view') && (!tab.needsBranches || multiBranch))
  return (
    <div className="space-y-6">
      <header>
        <h1>{t('inv.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('inv.subtitle')}</p>
      </header>
      <nav className="flex flex-wrap gap-1 border-b">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              cn('border-b-2 px-3 py-2 text-sm font-medium', isActive ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')
            }
          >
            {t(tab.tk)}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  )
}
