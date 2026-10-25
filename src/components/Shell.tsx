import {
  ArrowLeftRight, BadgeIndianRupee, BarChart3, BookOpen, Boxes, Building2, ClipboardList,
  CreditCard, Gem, GitBranch, HandCoins, LayoutDashboard, LogOut, NotebookTabs, Package,
  PiggyBank, ReceiptText, Settings, ShieldCheck, Store, UserPlus, Users, Wrench,
} from 'lucide-react'
import { Suspense, useState, type ComponentType } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'

import { BranchSwitcher } from '@/components/BranchSwitcher'
import { CommandPalette } from '@/components/CommandPalette'
import { NewPartyDialog } from '@/components/NewPartyDialog'
import { QuickBilling } from '@/components/QuickBilling'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth'
import { LOCALES, useLocale, useT } from '@/lib/i18n'
import type { NavItem } from '@/lib/nav'
import { cn } from '@/lib/utils'

function LanguageSwitch() {
  const { locale, setLocale } = useLocale()
  const t = useT()
  return (
    <div className="flex items-center gap-0.5 rounded-md border p-0.5" role="group" aria-label={t('shell.language')}>
      {LOCALES.map((l) => (
        <button key={l.code} type="button" aria-pressed={locale === l.code} onClick={() => setLocale(l.code)}
          className={cn('rounded px-1.5 py-0.5 text-xs font-medium', locale === l.code ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground')}>
          {l.label}
        </button>
      ))}
    </div>
  )
}

/** One icon per menu entry, keyed by the last path segment; falls back to a gem for anything new. */
const NAV_ICON: Record<string, ComponentType<{ className?: string }>> = {
  platform: LayoutDashboard, admin: LayoutDashboard, dashboard: LayoutDashboard,
  signups: UserPlus, businesses: Building2, plans: Package, payments: CreditCard,
  branches: GitBranch, users: Users, roles: ShieldCheck, business: Store, subscription: BadgeIndianRupee,
  inventory: Boxes, billing: ReceiptText, gst: ReceiptText, udhari: NotebookTabs, daybook: BookOpen,
  orders: ClipboardList, repair: Wrench, girvi: HandCoins, exchange: ArrowLeftRight, buy_sell: ArrowLeftRight,
  schemes: PiggyBank, settings: Settings, parties: Users, reports: BarChart3,
}
const navIcon = (to: string) => NAV_ICON[to.split('/').filter(Boolean).pop() ?? ''] ?? Gem

interface ShellProps {
  area: string
  nav: NavItem[]
  /** Show the branch switcher (admin consoles + store app). */
  showBranch?: boolean
}

export function Shell({ area, nav, showBranch }: ShellProps) {
  const { me, can, logout, readOnly, endImpersonation } = useAuth()
  const t = useT()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [newParty, setNewParty] = useState(false)
  const isStore = area === 'Store'
  const canBill = can('billing.sell_bill', 'view') || can('billing.purchase_bill', 'view')
  const canAddParty = can('settings.parties', 'edit')

  const onEndImpersonation = async () => {
    await endImpersonation()
    navigate('/platform', { replace: true })
  }

  return (
    <div className="flex min-h-dvh flex-col">
      {me?.impersonatedBy && (
        <div className="flex items-center justify-center gap-3 bg-amber-500 px-4 py-1.5 text-center text-sm font-medium text-black">
          {t('shell.viewing_as', { name: me.name })}
          {me.business ? ` · ${me.business.name}` : ''} — support session by {me.impersonatedBy.name}
          <Button variant="outline" size="sm" className="h-6 border-black/30 bg-transparent text-black hover:bg-black/10" onClick={() => void onEndImpersonation()}>
            {t('shell.end')}
          </Button>
        </div>
      )}

      <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-4 border-b bg-card/85 px-4 backdrop-blur supports-[backdrop-filter]:bg-card/70">
        <span className="flex items-center gap-2">
          <Gem className="size-5 text-brand" aria-hidden />
          <span className="wordmark font-serif text-lg font-semibold tracking-tight">Just Udhari</span>
        </span>
        <span className="rounded-full border border-brand/25 bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">{area}</span>
        <div className="ml-auto flex items-center gap-3">
          {area !== 'Platform' && <CommandPalette nav={nav} />}
          {isStore && canBill && <QuickBilling />}
          {isStore && canAddParty && <Button variant="outline" size="sm" onClick={() => setNewParty(true)}>{t('shell.new_party')}</Button>}
          {showBranch && <BranchSwitcher />}
          <LanguageSwitch />
          <span className="text-sm text-muted-foreground">{me?.name}</span>
          <Button variant="ghost" size="icon" onClick={() => void logout()} aria-label={t('shell.logout')}>
            <LogOut />
          </Button>
        </div>
      </header>

      {newParty && <NewPartyDialog open onClose={() => setNewParty(false)} onSaved={() => setNewParty(false)} />}

      {readOnly && (
        <div className="bg-destructive px-4 py-1.5 text-center text-sm font-medium text-destructive-foreground">
          {t('shell.readonly')}
        </div>
      )}

      <div className="flex flex-1">
        <nav className="w-60 shrink-0 space-y-0.5 border-r bg-card p-3">
          {nav.map((item) => {
            const Icon = navIcon(item.to)
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to.split('/').length <= 2}
                className={({ isActive }) =>
                  cn(
                    'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isActive ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      aria-hidden
                      className={cn(
                        'absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-brand transition-opacity',
                        isActive ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                    <Icon className={cn('size-4 shrink-0', isActive ? 'text-brand' : 'text-muted-foreground/70 group-hover:text-foreground')} />
                    {item.label}
                  </>
                )}
              </NavLink>
            )
          })}
        </nav>
        <main className="flex-1 p-6">
          <Suspense fallback={<p className="text-sm text-muted-foreground">{t('common.loading')}</p>}>
            <div key={pathname} className="animate-page-in">
              <Outlet />
            </div>
          </Suspense>
        </main>
      </div>
    </div>
  )
}
