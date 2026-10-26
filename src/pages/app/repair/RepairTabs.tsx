import { PageTabs } from '@/components/PageTabs'

// Both views read the same repair.entry data (the API enforces the permission), so no per-tab filter.
const TABS = [
  { to: '/app/repair', label: 'Board', end: true },
  { to: '/app/repair/ledger', label: 'Ledger' },
]

export function RepairTabs() {
  return <PageTabs tabs={TABS} />
}
