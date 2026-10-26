import { Outlet } from 'react-router-dom'

import { PageTabs } from '@/components/PageTabs'
import { useAuth } from '@/lib/auth'
import { useT } from '@/lib/i18n'

// labelKey is translated at render time (no hooks at module level)
const TABS = [
  { to: '/app/girvi/new', labelKey: 'girvi.tab_new', key: 'girvi.entry' },
  { to: '/app/girvi', labelKey: 'girvi.tab_loans', key: 'girvi.ledger', end: true },
  { to: '/app/girvi/transfers', labelKey: 'girvi.tab_transfers', key: 'girvi.transfer' },
  { to: '/app/girvi/import', labelKey: 'girvi.tab_import', key: 'girvi.entry' },
]

export function GirviLayout() {
  const t = useT()
  const { can } = useAuth()
  const tabs = TABS.filter((tab) => can(tab.key, 'view')).map((tab) => ({ ...tab, label: t(tab.labelKey) }))
  return (
    <div className="space-y-6">
      <header className="print:hidden">
        <h1>{t('girvi.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('girvi.subtitle')}</p>
      </header>
      <PageTabs tabs={tabs} />
      <Outlet />
    </div>
  )
}
