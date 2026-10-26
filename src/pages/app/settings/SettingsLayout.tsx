import { NavLink, Outlet } from 'react-router-dom'

import { useAuth } from '@/lib/auth'
import { cn } from '@/lib/utils'

// Parties page is gated by settings.parties; the rest by settings.misc.
const TABS = [
  { to: '/app/settings/parties', label: 'Parties', key: 'settings.parties' },
  { to: '/app/settings/bank-accounts', label: 'Bank Accounts', key: 'settings.misc' },
  { to: '/app/settings/hsn', label: 'HSN', key: 'settings.misc' },
  { to: '/app/settings/general', label: 'General', key: 'settings.misc' },
  { to: '/app/settings/invoice', label: 'Invoice', key: 'settings.misc' },
  { to: '/app/settings/rates', label: 'Rates', key: 'settings.misc' },
  { to: '/app/settings/opening', label: 'Opening', key: 'settings.misc' },
  { to: '/app/settings/girvi', label: 'Girvi', key: 'settings.misc' },
]

export function SettingsLayout() {
  const { can } = useAuth()
  const tabs = TABS.filter((t) => can(t.key, 'view'))
  return (
    <div className="space-y-6">
      <header>
        <h1>Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Business masters and defaults: parties, banks, HSN codes, invoice layout, rates and opening balances.</p>
      </header>
      <nav className="flex gap-1 border-b">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            className={({ isActive }) =>
              cn('border-b-2 px-3 py-2 text-sm font-medium', isActive ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')
            }
          >
            {t.label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  )
}
