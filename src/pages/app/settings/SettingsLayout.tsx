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
]

export function SettingsLayout() {
  const { can } = useAuth()
  const tabs = TABS.filter((t) => can(t.key, 'view'))
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>
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
