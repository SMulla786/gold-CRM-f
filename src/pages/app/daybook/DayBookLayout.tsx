import { Outlet } from 'react-router-dom'

import { PageTabs } from '@/components/PageTabs'
import { useAuth } from '@/lib/auth'
import { useT } from '@/lib/i18n'

// `tk` = i18n key for the tab label (translated at render); `key` = permission key.
const TABS = [
  { to: '/app/daybook', tk: 'dash.col_summary', key: 'daybook.all_in_one', end: true },
  { to: '/app/daybook/all-in-one', tk: 'daybook.tab_all_in_one', key: 'daybook.all_in_one' },
  { to: '/app/daybook/money', tk: 'daybook.tab_money', key: 'daybook.money' },
  { to: '/app/daybook/gold', tk: 'class.GOLD', key: 'daybook.gold' },
  { to: '/app/daybook/silver', tk: 'class.SILVER', key: 'daybook.silver' },
  { to: '/app/daybook/stone', tk: 'class.STONE', key: 'daybook.stone' },
  { to: '/app/daybook/artificial', tk: 'class.ARTIFICIAL', key: 'daybook.artificial' },
  { to: '/app/daybook/franchise', tk: 'class.FRANCHISE', key: 'daybook.franchise' },
  { to: '/app/daybook/old-metal', tk: 'daybook.tab_old_metal', key: 'daybook.gold' },
]

export function DayBookLayout() {
  const { can } = useAuth()
  const t = useT()
  const tabs = TABS.filter((tab) => can(tab.key, 'view')).map((tab) => ({ ...tab, label: t(tab.tk) }))
  return (
    <div className="space-y-6">
      <header className="print:hidden">
        <h1>{t('daybook.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('daybook.subtitle')}</p>
      </header>
      <PageTabs tabs={tabs} />
      <Outlet />
    </div>
  )
}
