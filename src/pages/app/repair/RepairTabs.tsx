import { PageTabs } from '@/components/PageTabs'
import { useT } from '@/lib/i18n'

// Both views read the same repair.entry data (the API enforces the permission), so no per-tab filter.
// tk = i18n key for the label (translated at render).
const TABS = [
  { to: '/app/repair', tk: 'repair.tab_board', end: true },
  { to: '/app/repair/ledger', tk: 'repair.tab_ledger' },
  { to: '/app/repair/consumables', tk: 'repair.tab_consumables' },
]

export function RepairTabs() {
  const t = useT()
  return <PageTabs tabs={TABS.map((tab) => ({ ...tab, label: t(tab.tk) }))} />
}
