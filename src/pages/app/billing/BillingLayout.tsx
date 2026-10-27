import { Outlet } from 'react-router-dom'

import { PageTabs } from '@/components/PageTabs'
import { useAuth } from '@/lib/auth'
import { useT } from '@/lib/i18n'

// `key` = permission key; `tk` = i18n key for the label (translated at render).
const TABS = [
  { to: '/app/billing', label: 'Sell Bill', tk: 'billing.tab_sell', key: 'billing.sell_bill', end: true },
  { to: '/app/billing/purchase', label: 'Purchase Bill', tk: 'billing.tab_purchase', key: 'billing.purchase_bill' },
  { to: '/app/billing/just', label: 'Just Bill', tk: 'billing.tab_just', key: 'billing.just_bill', end: true },
  { to: '/app/billing/list', label: 'Bills', tk: 'billing.tab_bills', key: 'billing.sell_bill' },
  // TASK-98: dedicated purchase-bill list (BillList follows ?kind= as it changes)
  { to: '/app/billing/list?kind=PURCHASE', label: 'Purchase bills', tk: 'bill98.tab_purchase_bills', key: 'billing.purchase_bill' },
  { to: '/app/billing/just/list', label: 'Just Bills', tk: 'billing.tab_just_bills', key: 'billing.just_bill' },
  { to: '/app/billing/drafts', label: 'Drafts', tk: 'billing.tab_drafts', key: 'billing.showroom_drafts' },
  { to: '/app/billing/approvals', label: 'Approvals', tk: 'billing.tab_approvals', key: 'billing.draft_approvals' },
  { to: '/app/billing/gst', label: 'GST Reports', tk: 'billing.tab_gst', key: 'billing.gst_report' },
  // the invoice layout lives under Settings; linked here like the original's billing settings page
  { to: '/app/settings/invoice', label: 'Invoice settings', tk: 'billing.tab_invoice_settings', key: 'settings.misc' },
]

export function BillingLayout() {
  const t = useT()
  const { can } = useAuth()
  const tabs = TABS.filter((tab) => can(tab.key, 'view')).map((tab) => ({ ...tab, label: t(tab.tk) }))
  return (
    <div className="space-y-6">
      <header className="print:hidden">
        <h1>{t('billing.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('billing.subtitle')}</p>
      </header>
      <PageTabs tabs={tabs} />
      <Outlet />
    </div>
  )
}
