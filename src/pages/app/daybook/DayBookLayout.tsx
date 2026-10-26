import { Outlet } from 'react-router-dom'

import { PageTabs } from '@/components/PageTabs'
import { useAuth } from '@/lib/auth'

const TABS = [
  { to: '/app/daybook', label: 'Summary', key: 'daybook.all_in_one', end: true },
  { to: '/app/daybook/all-in-one', label: 'All-in-One', key: 'daybook.all_in_one' },
  { to: '/app/daybook/money', label: 'Money', key: 'daybook.money' },
  { to: '/app/daybook/gold', label: 'Gold', key: 'daybook.gold' },
  { to: '/app/daybook/silver', label: 'Silver', key: 'daybook.silver' },
  { to: '/app/daybook/stone', label: 'Stone', key: 'daybook.stone' },
  { to: '/app/daybook/artificial', label: 'Artificial', key: 'daybook.artificial' },
  { to: '/app/daybook/franchise', label: 'Franchise', key: 'daybook.franchise' },
  { to: '/app/daybook/old-metal', label: 'Old Metal', key: 'daybook.gold' },
]

export function DayBookLayout() {
  const { can } = useAuth()
  const tabs = TABS.filter((t) => can(t.key, 'view'))
  return (
    <div className="space-y-6">
      <header className="print:hidden">
        <h1>Day-Book &amp; Ledgers</h1>
        <p className="mt-1 text-sm text-muted-foreground">Every rupee and gram moved in or out of the shop, day by day.</p>
      </header>
      <PageTabs tabs={tabs} />
      <Outlet />
    </div>
  )
}
