import { BadgeIndianRupee, Building2, CalendarClock, Store, UserPlus, Users, type LucideIcon } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { usePlatformDashboard } from '@/lib/queries'

const inr = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

const tile = (label: string, value: string | number, sub?: string, Icon: LucideIcon = Building2) => (
  <Card className="gap-2 hover:-translate-y-1">
    <CardHeader className="flex flex-row items-center justify-between pb-1">
      <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</CardTitle>
      <span className="icon-chip"><Icon className="size-5" aria-hidden /></span>
    </CardHeader>
    <CardContent>
      <div className="text-3xl font-extrabold tracking-tight tabular-nums">{value}</div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </CardContent>
  </Card>
)

export function PlatformDashboard() {
  const { data, isLoading } = usePlatformDashboard()
  if (isLoading || !data) return <p className="text-sm text-muted-foreground">Loading…</p>
  const b = data.businesses

  const headline = [
    {
      label: 'Active shops',
      value: String(b.active),
      note: `of ${b.total} total`,
      pct: (b.active / (b.total || 1)) * 100,
      bar: 'from-brand-strong to-brand',
    },
    {
      label: "This month's revenue",
      value: inr(data.revenue.thisMonth),
      note: `of ${inr(data.revenue.thisYear)} this year`,
      pct: (data.revenue.thisMonth / (data.revenue.thisYear || 1)) * 100,
      bar: 'from-brand-strong to-brand',
    },
  ]

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1>Platform Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Subscriptions, sign-ups, revenue and usage across every shop.</p>
        </div>
      </header>

      <div className="hero-card space-y-6 p-6">
        <h2 className="text-xl">Platform at a glance</h2>
        <div className="grid gap-6 sm:grid-cols-2">
          {headline.map((m) => (
            <div key={m.label} className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-white/60">{m.label}</p>
              <p className="text-3xl font-extrabold tabular-nums">{m.value}</p>
              <div className="h-3 rounded-full bg-white/10 shadow-[inset_0_2px_4px_rgb(0_0_0/0.3)]">
                <div className={`bar-grow h-3 rounded-full bg-gradient-to-r ${m.bar} shadow-[0_0_10px_rgb(212_175_55/0.5)]`} style={{ width: `${Math.min(100, Math.max(4, m.pct))}%` }} />
              </div>
              <p className="text-sm text-white/70">{m.note}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tile('Businesses', b.total, `${b.active} active · ${b.suspended} suspended`, Building2)}
        {tile('Expiring ≤15 days', b.expiringIn15Days, `${b.expired} expired`, CalendarClock)}
        {tile('Pending sign-ups', data.pendingSignups, undefined, UserPlus)}
        {tile('Revenue this month', inr(data.revenue.thisMonth), `${inr(data.revenue.thisYear)} this year`, BadgeIndianRupee)}
        {tile('Total branches', data.branches, undefined, Store)}
        {tile('Total users', data.users, undefined, Users)}
      </div>
    </div>
  )
}
