import { Outlet } from 'react-router-dom'

import { PageTabs } from '@/components/PageTabs'
import { useAuth } from '@/lib/auth'

const TABS = [
  { to: '/app/udhari', label: 'New Udhar', key: 'udhari.entry', end: true },
  { to: '/app/udhari/ledger', label: 'Udhar Ledger', key: 'udhari.ledger' },
  { to: '/app/udhari/list', label: 'Udhar List', key: 'udhari.ledger' },
  { to: '/app/udhari/pending', label: 'Pending Bills', key: 'udhari.ledger' },
]

export function UdhariLayout() {
  const { can } = useAuth()
  const tabs = TABS.filter((t) => can(t.key, 'view'))
  return (
    <div className="space-y-6">
      <header className="print:hidden">
        <h1>Udhari</h1>
        <p className="mt-1 text-sm text-muted-foreground">Credit given and taken — party ledgers, running balances and open bills.</p>
      </header>
      <PageTabs tabs={tabs} />
      <Outlet />
    </div>
  )
}
