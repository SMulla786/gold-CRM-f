import { Activity, ArrowDownRight, ArrowUpRight, CalendarClock, CirclePlus, Gem, HandCoins, ListChecks, Pencil, Settings2, Trash2, Undo2, Users, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { KpiTile } from '@/components/KpiTile'
import { SectionCard } from '@/components/SectionCard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useAuth } from '@/lib/auth'
import { useT } from '@/lib/i18n'
import { useSchemeDayBook, useSchemeDues, useSchemes } from '@/lib/schemesQueries'
import { businessDayISO, type DashboardDto } from '@/shared'

// TASK-97 dashboard gaps.
const inr = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

// ───── Display settings (show/hide blocks), per user in this browser ─────

// label = i18n key, translated at render.
// Website order. Old keys keep their saved show/hide choice ('kpis' = Billing & Sales, 'secondary' = purchases + cash tiles).
export const DASHBOARD_BLOCKS = [
  { key: 'rates', label: 'rates.today' },
  { key: 'parties', label: 'dash.block_parties' },
  { key: 'stock', label: 'dash.inventory_stock' },
  { key: 'kpis', label: 'dash.billing_sales' },
  { key: 'udhari', label: 'dash.udhari_overview' },
  { key: 'schemes', label: 'dash.schemes_overview' },
  { key: 'today', label: 'dash.today_activity' },
  { key: 'activity', label: 'dash.recent_activity' },
  { key: 'chart', label: 'dash.monthly_earnings' },
  { key: 'secondary', label: 'dash.block_extras' },
  { key: 'branches', label: 'dash.by_branch' },
  { key: 'overdue', label: 'Udhar overdue' }, // plain English until an i18n key is added (t() echoes unknown keys)
  { key: 'occasions', label: 'dash.occasions' },
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
  const t = useT()
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Settings2 className="size-4" aria-hidden /> {t('dash.display_settings')}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('dash.display_title')}</DialogTitle>
            <DialogDescription>{t('dash.display_desc')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 sm:grid-cols-2">
            {DASHBOARD_BLOCKS.map((b) => (
              <label key={b.key} className="flex items-center gap-2 text-sm">
                <Checkbox checked={prefs.show(b.key)} onCheckedChange={() => prefs.toggle(b.key)} />
                {t(b.label)}
              </label>
            ))}
          </div>
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" onClick={prefs.reset}>{t('dash.show_all')}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ───── Today's activity counters (DashboardDto.activityToday) ─────

const ACTION_ICON: Record<string, LucideIcon> = { CREATED: CirclePlus, EDITED: Pencil, DELETED: Trash2, REVERSED: Undo2 }

/** Website: a row of counter tiles (Today's total, Created, Edited, Deleted …) right above Recent System Activity. */
export function TodayActivity({ counts }: { counts: DashboardDto['activityToday'] }) {
  const t = useT()
  const entries = Object.entries(counts) as [string, number][]
  const total = entries.reduce((s, [, n]) => s + n, 0)
  const label = (a: string) => a.charAt(0) + a.slice(1).toLowerCase()
  return (
    <div className="stagger grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" aria-label={t('dash.today_activity')} role="group">
      <KpiTile size="sm" icon={ListChecks} label={t('dash.todays_total')} value={String(total)} />
      {entries.map(([action, n]) => <KpiTile key={action} size="sm" icon={ACTION_ICON[action] ?? Activity} tone="slate" label={label(action)} value={String(n)} />)}
    </div>
  )
}

/** Thin line under a section's tiles (website: "This month ₹… / This year ₹…"). */
export const SectionFooter = ({ children }: { children: React.ReactNode }) => (
  <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2 border-t px-6 py-3 text-sm text-muted-foreground">{children}</div>
)

// ───── Schemes overview (from the scheme APIs; each figure only if the user may read it) ─────

function DueNow() {
  const t = useT()
  const { data } = useSchemeDues({})
  const amount = (data ?? []).reduce((s, r) => s + Number(r.dueAmount), 0)
  return <KpiTile size="sm" icon={CalendarClock} tone="slate" label={t('dash.due_now')} value={data ? inr(amount) : '—'} sub={data ? t('dash.due_members', { n: data.length }) : undefined} />
}

function CollectedToday() {
  const t = useT()
  const day = businessDayISO()
  const { data } = useSchemeDayBook({ from: day, to: day })
  return <KpiTile size="sm" icon={HandCoins} label={t('dash.collected_today')} value={data ? inr(Number(data.moneyIn)) : '—'} sub={data ? t('dash.payments_count', { n: data.rows.length }) : undefined} />
}

/** Pending for one scheme = Σ dueAmount of its rows in the dues list (same data as "Due now"; one shared query). */
function SchemePending({ schemeId }: { schemeId: number }) {
  const { data } = useSchemeDues({})
  if (!data) return null
  const amt = data.filter((r) => r.scheme.id === schemeId).reduce((a, r) => a + Number(r.dueAmount), 0)
  return <span className={amt > 0 ? 'text-destructive' : undefined}>Pending {inr(amt)}</span>
}

/** Σ dueAmount over the whole dues list (same shared query as "Due now"). */
function TotalPending() {
  const t = useT()
  const { data } = useSchemeDues({})
  if (!data) return null
  const amt = data.reduce((a, r) => a + Number(r.dueAmount), 0)
  return <span className={amt > 0 ? 'text-destructive' : undefined}>{t('dash.pending_payments', { amt: inr(amt) })}</span>
}

export function SchemesOverview() {
  const t = useT()
  const { can } = useAuth()
  // shortcut: first 100 active schemes; Active-schemes/members undercount past that (no count endpoint).
  const { data } = useSchemes({ active: 'true', pageSize: 100 })
  const schemes = data?.items ?? []
  const members = schemes.reduce((s, x) => s + x.memberCount, 0)
  const canDues = can('schemes.due_list', 'view')
  const collected = schemes.some((s) => s.collected != null) ? schemes.reduce((a, s) => a + Number(s.collected ?? 0), 0) : null
  return (
    <SectionCard
      title={t('dash.schemes_overview')}
      subtitle={t('dash.schemes_sub')}
      actions={can('schemes.add_money', 'edit') && can('schemes.all', 'view') ? (
        <Button asChild size="sm" variant="outline"><Link to="/app/schemes/members">{t('dash.collect_payment')}</Link></Button>
      ) : undefined}
    >
      <div className="space-y-4 p-6">
      <div className="stagger grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile size="sm" icon={Gem} label={t('dash.active_schemes')} value={data ? String(data.total) : '—'} />
        <KpiTile size="sm" icon={Users} tone="slate" label={t('dash.enrolled_members')} value={data ? String(members) : '—'} />
        {can('schemes.due_list', 'view') && <DueNow />}
        {can('schemes.daybook', 'view') && <CollectedToday />}
      </div>
      {schemes.length > 0 && (
        <ul className="divide-y text-sm">
          {schemes.slice(0, 5).map((s) => (
            <li key={s.id} className="flex items-center gap-2 py-2">
              <Link to={`/app/schemes/members?schemeId=${s.id}${s.kind === 'ANJUMAN' ? '&kind=ANJUMAN' : ''}`} className="font-medium hover:underline">{s.name}</Link>
              {s.kind === 'ANJUMAN' && <Badge variant="secondary">Anjuman</Badge>}
              <span className="ml-auto text-right text-muted-foreground">
                {t('dash.scheme_meta', { n: s.memberCount, amt: inr(Number(s.emiAmount)) })}
                {(s.collected != null || canDues) && (
                  <span className="flex justify-end gap-x-3 text-xs">
                    {s.collected != null && <span>Collected {inr(Number(s.collected))}</span>}
                    {canDues && <SchemePending schemeId={s.id} />}
                  </span>
                )}
              </span>
            </li>
          ))}
          {schemes.length > 5 && (
            <li className="py-2 text-xs"><Link to="/app/schemes" className="text-brand hover:underline">{t('dash.all_schemes', { n: schemes.length })}</Link></li>
          )}
        </ul>
      )}
      {data && !schemes.length && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Activity className="size-4" aria-hidden /> {t('dash.no_schemes')}</p>}
      </div>
      {(collected != null || canDues) && (
        <SectionFooter>
          {collected != null ? <span>{t('dash.total_collected', { amt: inr(collected) })}</span> : <span />}
          {canDues && <TotalPending />}
        </SectionFooter>
      )}
    </SectionCard>
  )
}

// ───── "% vs last month" on KPI tiles (DashboardDto.lastMonth) ─────

/** "+12% vs last month" (green up / red down); nothing when last month is 0 or unknown. */
export function Trend({ cur, prev, prefix }: { cur: string | number; prev?: string | number; prefix?: string }) {
  const p = Number(prev ?? 0)
  if (!p) return null
  const pct = Math.round(((Number(cur) - p) / Math.abs(p)) * 100)
  const up = pct >= 0
  const Icon = up ? ArrowUpRight : ArrowDownRight
  return (
    <span className={`mt-1 flex items-center gap-0.5 font-semibold ${up ? 'text-green-600 dark:text-green-500' : 'text-destructive'}`}>
      <Icon className="size-3.5" aria-hidden />
      {prefix ? `${prefix} ` : ''}{up ? '+' : ''}{pct}% vs last month
    </span>
  )
}

// ───── Udhar overdue list (DashboardDto.udharOverdue) ─────

export function UdharOverdueCard({ rows, total }: { rows?: DashboardDto['udharOverdue']; total?: DashboardDto['udharOverdueTotal'] }) {
  if (!rows?.length) return null
  const metal = (g: string, sym: string) => (Number(g) ? `${g}g ${sym}` : '')
  return (
    <SectionCard title="Udhar overdue" actions={<Link to="/app/udhari/ledger" className="text-xs font-medium text-brand hover:underline">View ledger</Link>} bodyClassName="divide-y text-sm">
      {total != null && (
        <div className="px-6 py-4">
          <div className="text-xs font-semibold text-muted-foreground">Total overdue (all parties)</div>
          <div className="text-2xl font-extrabold tabular-nums">{inr(Number(total))}</div>
          {rows.length >= 10 && <div className="text-xs text-muted-foreground">Showing the 10 most overdue</div>}
        </div>
      )}
      {rows.map((r) => (
        <div key={r.party.id} className="flex flex-wrap justify-between gap-x-3 gap-y-1 px-6 py-3">
          <div className="min-w-0">
            <Link to={`/app/udhari/statement/${r.party.id}`} className="font-medium hover:underline">{r.party.name}</Link>
            <div className="text-xs text-muted-foreground">{r.daysOverdue} days overdue · since {new Date(r.since).toLocaleDateString('en-IN')}</div>
          </div>
          <div className="text-right font-semibold">
            {[Number(r.amount) ? inr(Number(r.amount)) : '', metal(r.gold, 'Au'), metal(r.silver, 'Ag')].filter(Boolean).join(' · ')}
          </div>
        </div>
      ))}
    </SectionCard>
  )
}
