import { Outlet } from 'react-router-dom'

import { PageTabs } from '@/components/PageTabs'
import { useAuth } from '@/lib/auth'
import { useT } from '@/lib/i18n'

// labelKey is translated at render time (no hooks at module level)
const TABS = [
  { to: '/app/udhari', labelKey: 'udhari.tab_new', key: 'udhari.entry', end: true },
  { to: '/app/udhari/ledger', labelKey: 'udhari.tab_ledger', key: 'udhari.ledger' },
  { to: '/app/udhari/list', labelKey: 'udhari.tab_list', key: 'udhari.ledger' },
  { to: '/app/udhari/pending', labelKey: 'udhari.tab_pending', key: 'udhari.ledger' },
]

export function UdhariLayout() {
  const t = useT()
  const { can } = useAuth()
  const tabs = TABS.filter((tab) => can(tab.key, 'view')).map((tab) => ({ ...tab, label: t(tab.labelKey) }))
  return (
    <div className="space-y-6">
      <header className="print:hidden">
        <h1>{t('udhari.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('udhari.subtitle')}</p>
      </header>
      <PageTabs tabs={tabs} />
      <Outlet />
    </div>
  )
}
