import { PageTabs } from '@/components/PageTabs'

// Both views read the same repair.entry data (the API enforces the permission), so no per-tab filter.
const TABS = [
  { to: '/app/repair', label: 'Board', end: true },
  { to: '/app/repair/ledger', label: 'Ledger' },
  { to: '/app/repair/consumables', label: 'Consumables' },
]

export function RepairTabs() {
  return <PageTabs tabs={TABS} />
}
