import { NavLink, Outlet } from 'react-router-dom'

import { useAuth } from '@/lib/auth'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'

// `key` = permission key; `tk` = i18n key for the label (translated at render).
const TABS = [
  { to: '/app/exchange/new', tk: 'trade.tab_new_ex', key: 'exchange.entry' },
  { to: '/app/exchange', tk: 'trade.tab_exchanges', key: 'exchange.list', end: true },
  { to: '/app/exchange/kacha', tk: 'trade.tab_kacha', key: 'exchange.entry' },
]

export function ExchangeLayout() {
  const t = useT()
  const { can } = useAuth()
  const tabs = TABS.filter((tab) => can(tab.key, 'view'))
  return (
    <div className="space-y-6">
      <header>
        <h1>{t('trade.ex_title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('trade.ex_subtitle')}</p>
      </header>
      <nav className="flex flex-wrap gap-1 border-b">
        {tabs.map((tab) => (
          <NavLink key={tab.to} to={tab.to} end={tab.end} className={({ isActive }) => cn('border-b-2 px-3 py-2 text-sm font-medium', isActive ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}>
            {t(tab.tk)}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  )
}
