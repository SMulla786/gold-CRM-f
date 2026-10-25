import { NavLink, Outlet } from 'react-router-dom'

import { useAuth } from '@/lib/auth'
import { cn } from '@/lib/utils'

const TABS = [
  { to: '/app/billing', label: 'Sell Bill', key: 'billing.sell_bill', end: true },
  { to: '/app/billing/purchase', label: 'Purchase Bill', key: 'billing.purchase_bill' },
  { to: '/app/billing/just', label: 'Just Bill', key: 'billing.just_bill', end: true },
  { to: '/app/billing/list', label: 'Bills', key: 'billing.sell_bill' },
  { to: '/app/billing/just/list', label: 'Just Bills', key: 'billing.just_bill' },
  { to: '/app/billing/drafts', label: 'Drafts', key: 'billing.showroom_drafts' },
  { to: '/app/billing/approvals', label: 'Approvals', key: 'billing.draft_approvals' },
  { to: '/app/billing/gst', label: 'GST Reports', key: 'billing.gst_report' },
]

export function BillingLayout() {
  const { can } = useAuth()
  const tabs = TABS.filter((t) => can(t.key, 'view'))
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Billing</h1>
      <nav className="flex flex-wrap gap-1 border-b print:hidden">
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
