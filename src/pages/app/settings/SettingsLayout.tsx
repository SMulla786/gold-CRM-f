import { NavLink, Outlet } from 'react-router-dom'

import { cn } from '@/lib/utils'

const TABS = [
  { to: '/app/settings/parties', label: 'Parties' },
  { to: '/app/settings/bank-accounts', label: 'Bank Accounts' },
  { to: '/app/settings/hsn', label: 'HSN' },
  { to: '/app/settings/general', label: 'General' },
  { to: '/app/settings/rates', label: 'Rates' },
]

export function SettingsLayout() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <nav className="flex gap-1 border-b">
        {TABS.map((t) => (
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
