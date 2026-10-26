import { Outlet } from 'react-router-dom'

import { PageTabs } from '@/components/PageTabs'
import { useAuth } from '@/lib/auth'

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
      <header className="print:hidden">
        <h1>Billing</h1>
        <p className="mt-1 text-sm text-muted-foreground">Raise and review bills, approve showroom discounts and pull GST reports.</p>
      </header>
      <PageTabs tabs={tabs} />
      <Outlet />
    </div>
  )
}
