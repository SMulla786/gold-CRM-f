import { Outlet } from 'react-router-dom'

import { PageTabs } from '@/components/PageTabs'
import { useAuth } from '@/lib/auth'

const TABS = [
  { to: '/app/girvi/new', label: 'New Loan', key: 'girvi.entry' },
  { to: '/app/girvi', label: 'Loans', key: 'girvi.ledger', end: true },
]

export function GirviLayout() {
  const { can } = useAuth()
  const tabs = TABS.filter((t) => can(t.key, 'view'))
  return (
    <div className="space-y-6">
      <header className="print:hidden">
        <h1>Girvi</h1>
        <p className="mt-1 text-sm text-muted-foreground">Gold-loan pledges — issue new loans, track interest and close them out.</p>
      </header>
      <PageTabs tabs={tabs} />
      <Outlet />
    </div>
  )
}
