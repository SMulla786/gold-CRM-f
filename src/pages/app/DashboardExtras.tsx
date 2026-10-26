import { Activity, CalendarClock, Gem, HandCoins, Settings2, Users } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { KpiTile } from '@/components/KpiTile'
import { SectionCard } from '@/components/SectionCard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useAuth } from '@/lib/auth'
import { useSchemeDayBook, useSchemeDues, useSchemes } from '@/lib/schemesQueries'
import { businessDayISO, type DashboardDto } from '@/shared'

// TASK-97 dashboard gaps. New strings are English-only until the next i18n pass.
const inr = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

// ───── Display settings (show/hide blocks), per user in this browser ─────

export const DASHBOARD_BLOCKS = [
  { key: 'kpis', label: 'Sales & purchase tiles' },
  { key: 'secondary', label: 'Udhari, cash & party tiles' },
  { key: 'today', label: "Today's activity" },
  { key: 'chart', label: 'Monthly chart' },
  { key: 'rates', label: "Today's rates" },
  { key: 'stock', label: 'Stock on hand' },
  { key: 'schemes', label: 'Schemes overview' },
  { key: 'branches', label: 'By branch' },
  { key: 'occasions', label: 'Upcoming occasions' },
  { key: 'activity', label: 'Recent activity' },
] as const
export type DashboardBlock = (typeof DASHBOARD_BLOCKS)[number]['key']

// shortcut: prefs live in localStorage (this browser only); move to a server setting if owners want them on every device.
export function useDashboardPrefs() {
  const { me } = useAuth()
  const storageKey = `dashboard.hidden.${me?.id ?? 'anon'}`
  const [hidden, setHidden] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(storageKey) ?? '[]') as string[]
    } catch {
      return []
    }
  })
  const save = (next: string[]) => {
    setHidden(next)
    try {
      localStorage.setItem(storageKey, JSON.stringify(next))
    } catch {
      /* storage blocked: keep the in-memory choice */
    }
  }
  return {
    show: (k: DashboardBlock) => !hidden.includes(k),
    toggle: (k: DashboardBlock) => save(hidden.includes(k) ? hidden.filter((x) => x !== k) : [...hidden, k]),
    reset: () => save([]),
  }
}

export function DisplaySettings({ prefs }: { prefs: ReturnType<typeof useDashboardPrefs> }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Settings2 className="size-4" aria-hidden /> Display settings
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dashboard display settings</DialogTitle>
            <DialogDescription>Choose which blocks appear on your dashboard (saved for you on this device).</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 sm:grid-cols-2">
            {DASHBOARD_BLOCKS.map((b) => (
              <label key={b.key} className="flex items-center gap-2 text-sm">
                <Checkbox checked={prefs.show(b.key)} onCheckedChange={() => prefs.toggle(b.key)} />
                {b.label}
              </label>
            ))}
          </div>
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" onClick={prefs.reset}>Show all</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ───── Today's activity counters (DashboardDto.activityToday) ─────

export function TodayActivity({ counts }: { counts: DashboardDto['activityToday'] }) {
  const entries = Object.entries(counts) as [string, number][]
  const total = entries.reduce((s, [, n]) => s + n, 0)
  const label = (a: string) => a.charAt(0) + a.slice(1).toLowerCase()
  return (
    <SectionCard title="Today's activity" bodyClassName="flex flex-wrap gap-3 p-6" actions={<Link to="/app/daybook" className="text-xs font-medium text-brand hover:underline">View Day Book</Link>}>
      <div className="min-w-28 rounded-2xl bg-brand/10 px-4 py-3">
        <div className="text-xs font-semibold text-muted-foreground">Total</div>
        <div className="text-2xl font-extrabold">{total}</div>
      </div>
      {entries.map(([action, n]) => (
        <div key={action} className="min-w-28 rounded-2xl bg-muted px-4 py-3">
          <div className="text-xs font-semibold text-muted-foreground">{label(action)}</div>
          <div className="text-2xl font-extrabold">{n}</div>
        </div>
      ))}
    </SectionCard>
  )
}

// ───── Schemes overview (from the scheme APIs; each figure only if the user may read it) ─────

function DueNow() {
  const { data } = useSchemeDues({})
  const amount = (data ?? []).reduce((s, r) => s + Number(r.dueAmount), 0)
  return <KpiTile size="sm" icon={CalendarClock} tone="slate" label="Due now" value={data ? inr(amount) : '—'} sub={data ? `${data.length} member(s) with unpaid EMIs` : undefined} />
}

function CollectedToday() {
  const day = businessDayISO()
  const { data } = useSchemeDayBook({ from: day, to: day })
  return <KpiTile size="sm" icon={HandCoins} label="Collected today" value={data ? inr(Number(data.moneyIn)) : '—'} sub={data ? `${data.rows.length} payment(s)` : undefined} />
}

export function SchemesOverview() {
  const { can } = useAuth()
  // shortcut: first 100 active schemes; Active-schemes/members undercount past that (no count endpoint).
  const { data } = useSchemes({ active: 'true', pageSize: 100 })
  const schemes = data?.items ?? []
  const members = schemes.reduce((s, x) => s + x.memberCount, 0)
  return (
    <SectionCard
      title="Schemes overview"
      actions={can('schemes.add_money', 'edit') && can('schemes.all', 'view') ? (
        <Button asChild size="sm" variant="outline"><Link to="/app/schemes/members">Collect payment</Link></Button>
      ) : undefined}
      bodyClassName="space-y-4 p-6"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <KpiTile size="sm" icon={Gem} label="Active schemes" value={data ? String(data.total) : '—'} />
        <KpiTile size="sm" icon={Users} tone="slate" label="Enrolled members" value={data ? String(members) : '—'} />
        {can('schemes.due_list', 'view') && <DueNow />}
        {can('schemes.daybook', 'view') && <CollectedToday />}
      </div>
      {schemes.length > 0 && (
        <ul className="divide-y text-sm">
          {schemes.slice(0, 5).map((s) => (
            <li key={s.id} className="flex items-center gap-2 py-2">
              <Link to={`/app/schemes/members?schemeId=${s.id}${s.kind === 'ANJUMAN' ? '&kind=ANJUMAN' : ''}`} className="font-medium hover:underline">{s.name}</Link>
              {s.kind === 'ANJUMAN' && <Badge variant="secondary">Anjuman</Badge>}
              <span className="ml-auto text-muted-foreground">{s.memberCount} members · {inr(Number(s.emiAmount))}/EMI</span>
            </li>
          ))}
          {schemes.length > 5 && (
            <li className="py-2 text-xs"><Link to="/app/schemes" className="text-brand hover:underline">All {schemes.length} schemes</Link></li>
          )}
        </ul>
      )}
      {data && !schemes.length && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Activity className="size-4" aria-hidden /> No active schemes yet.</p>}
    </SectionCard>
  )
}
