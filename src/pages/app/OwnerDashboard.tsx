import { Factory, HandCoins, Hourglass, ReceiptIndianRupee, ShoppingCart, TrendingUp, Users, Wallet } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { KpiTile } from '@/components/KpiTile'
import { SectionCard } from '@/components/SectionCard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DisplaySettings, SchemesOverview, TodayActivity, Trend, UdharOverdueCard, useDashboardPrefs } from '@/pages/app/DashboardExtras'
import { ShopRateCard } from '@/pages/app/ShopRateCard'
import { useOccasions } from '@/lib/appQueries'
import { useAuth } from '@/lib/auth'
import { useT } from '@/lib/i18n'
import { useActivity, useDashboard } from '@/lib/reportsQueries'
import { ACTIVITY_ACTIONS, MODULES } from '@/shared'

const inr = (s: string) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(s))
const CLASS_LABEL: Record<string, string> = { GOLD: 'Gold', SILVER: 'Silver', STONE: 'Stone', ARTIFICIAL: 'Artificial', FRANCHISE: 'Franchise' }
const monthLabel = (m: string) => new Date(m + '-01').toLocaleDateString('en-IN', { month: 'short' })

type MonthRow = { month: string; sales: string; purchases: string }
// Roll the 12 monthly rows up into calendar quarters (label 'Q1 26'); partial edge quarters keep what they have.
const toQuarters = (rows: MonthRow[]): Array<MonthRow & { label: string }> => {
  const out = new Map<string, MonthRow & { label: string }>()
  for (const m of rows) {
    const [y, mo] = m.month.split('-').map(Number)
    const key = `${y}-Q${Math.ceil(mo / 3)}`
    const cur = out.get(key) ?? { month: key, sales: '0', purchases: '0', label: `Q${Math.ceil(mo / 3)} ${String(y).slice(2)}` }
    out.set(key, { ...cur, sales: String(Number(cur.sales) + Number(m.sales)), purchases: String(Number(cur.purchases) + Number(m.purchases)) })
  }
  return [...out.values()]
}

function MonthlyChart({ data: monthly }: { data: MonthRow[] }) {
  const t = useT()
  const [range, setRange] = useState<'month' | 'quarter'>('month')
  const data = range === 'month' ? monthly.map((m) => ({ ...m, label: monthLabel(m.month) })) : toQuarters(monthly)
  const max = Math.max(1, ...data.flatMap((m) => [Number(m.sales), Number(m.purchases)]))
  return (
    <SectionCard
      title={t('dash.last_12')}
      actions={
        <>
          <span className="text-xs font-medium text-muted-foreground"><span className="text-brand">■</span> {t('dash.sales')} <span className="ml-2 text-slate-400">■</span> {t('dash.purchases')}</span>
          <Select value={range} onValueChange={(v) => setRange(v as 'month' | 'quarter')}>
            <SelectTrigger className="h-8 w-28 rounded-xl" aria-label="Chart range"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="month">{t('gst.month')}</SelectItem>
              <SelectItem value="quarter">{t('gst.quarter')}</SelectItem>
            </SelectContent>
          </Select>
        </>
      }
      bodyClassName="p-6"
    >
      <div className="flex h-56 items-end gap-2">
        {data.map((m, i) => (
          <div key={m.month} className="flex flex-1 flex-col items-center gap-2">
            <div className="flex h-48 w-full items-end justify-center gap-1">
              <div className="w-1/2 max-w-4 rounded-t-md bg-gradient-to-t from-brand-strong to-brand" style={{ height: `${(Number(m.sales) / max) * 100}%` }} title={`Sales ${inr(m.sales)}`} />
              <div className="w-1/2 max-w-4 rounded-t-md bg-slate-300 dark:bg-slate-600" style={{ height: `${(Number(m.purchases) / max) * 100}%` }} title={`Purchases ${inr(m.purchases)}`} />
            </div>
            <span className={i === data.length - 1 ? 'rounded-md bg-brand/15 px-1.5 text-[10px] font-semibold' : 'text-[10px] text-muted-foreground'}>{m.label}</span>
          </div>
        ))}
      </div>
    </SectionCard>
  )
}

function ActivityFeed() {
  const t = useT()
  const [module, setModule] = useState('')
  const [action, setAction] = useState('')
  const [q, setQ] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 15
  const { data } = useActivity({
    module: module || undefined,
    action: action || undefined,
    q: q.trim() || undefined,
    from: from || undefined,
    // `to` is a date; make it inclusive of that whole day.
    to: to ? `${to}T23:59:59.999` : undefined,
    page,
    pageSize,
  })
  const pages = data ? Math.max(1, Math.ceil(data.total / pageSize)) : 1
  const reset = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPage(1) }
  return (
    <SectionCard
      title={t('dash.recent_activity')}
      actions={
        <>
          <Input className="h-8 w-44 rounded-xl" aria-label="Search activity" placeholder={t('dash.search_ph')} value={q} onChange={(e) => reset(setQ)(e.target.value)} />
          <Input type="date" className="h-8 w-36 rounded-xl" aria-label="Activity from" value={from} onChange={(e) => reset(setFrom)(e.target.value)} />
          <Input type="date" className="h-8 w-36 rounded-xl" aria-label="Activity to" value={to} onChange={(e) => reset(setTo)(e.target.value)} />
          <Select value={module || 'all'} onValueChange={(v) => reset(setModule)(v === 'all' ? '' : v)}>
            <SelectTrigger className="h-8 w-40 rounded-xl" aria-label="Module"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('dash.all_modules')}</SelectItem>
              {MODULES.map((m) => <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={action || 'all'} onValueChange={(v) => reset(setAction)(v === 'all' ? '' : v)}>
            <SelectTrigger className="h-8 w-32 rounded-xl" aria-label="Action"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('dash.all_actions')}</SelectItem>
              {ACTIVITY_ACTIONS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </>
      }
    >
      <Table>
        <TableHeader>
          <TableRow><TableHead>{t('dash.when')}</TableHead><TableHead>{t('dash.col_module')}</TableHead><TableHead>{t('dash.col_action')}</TableHead><TableHead>{t('dash.col_summary')}</TableHead><TableHead>{t('udhari.party')}</TableHead><TableHead>{t('dash.col_by')}</TableHead></TableRow>
        </TableHeader>
        <TableBody>
          {data?.items.length ? data.items.map((a) => (
            <TableRow key={a.id}>
              <TableCell className="whitespace-nowrap text-muted-foreground">{new Date(a.createdAt).toLocaleString('en-IN')}</TableCell>
              <TableCell>{a.module}</TableCell>
              <TableCell><Badge variant="secondary">{a.action}</Badge></TableCell>
              <TableCell>{a.summary}</TableCell>
              <TableCell>{a.partyName ?? '—'}</TableCell>
              <TableCell className="text-muted-foreground">{a.user ?? '—'}</TableCell>
            </TableRow>
          )) : (
            <TableRow><TableCell colSpan={6} className="h-16 text-center text-muted-foreground">{t('dash.no_activity')}</TableCell></TableRow>
          )}
        </TableBody>
      </Table>
      {data && data.total > pageSize && (
        <div className="flex items-center justify-end gap-2 border-t px-6 py-3 text-xs text-muted-foreground">
          <span>{t('dash.page_entries', { page, pages, total: data.total })}</span>
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>{t('table.previous')}</Button>
          <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>{t('table.next')}</Button>
        </div>
      )}
    </SectionCard>
  )
}

function OccasionsCard() {
  const t = useT()
  const { data } = useOccasions(7)
  if (!data || data.length === 0) return null
  return (
    <SectionCard title={t('dash.occasions')} bodyClassName="divide-y text-sm">
      {data.map((o) => (
        <div key={`${o.party.id}-${o.kind}`} className="flex flex-wrap justify-between gap-x-3 gap-y-1 px-6 py-3">
          <span><span className="font-medium">{o.party.name}</span> · {o.kind === 'BIRTHDAY' ? t('party.birthday') : t('party.anniversary')}{o.party.mobile ? ` · ${o.party.mobile}` : ''}</span>
          <span className="whitespace-nowrap text-muted-foreground">{o.daysAway === 0 ? t('dash.today') : t(o.daysAway === 1 ? 'dash.in_days_one' : 'dash.in_days_other', { n: o.daysAway })} · {new Date(o.date).toLocaleDateString('en-IN')}</span>
        </div>
      ))}
    </SectionCard>
  )
}

/** Headline metric: navy hero with each stock class's net grams and a share-of-value bar. */
function StockHero({ stock }: { stock: Array<{ stockClass: string; items: number; net: string; pcs: number; value: string }> }) {
  const t = useT()
  const { can } = useAuth()
  const max = Math.max(1, ...stock.map((s) => Number(s.value)))
  const total = stock.reduce((sum, s) => sum + Number(s.value), 0)
  const canList = can('inventory.all_stock', 'view')
  return (
    <div className="hero-card space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-xl">{t('dash.stock_on_hand')}</h2>
          {stock.length > 0 && <div className="mt-1 text-sm text-white/70">{t('dash.total_value', { amt: inr(String(total)) })}</div>}
        </div>
        <div className="flex gap-2">
          {can('inventory.import_stock', 'edit') && (
            <Link to="/app/inventory/import" className="rounded-full border border-white/25 px-3 py-1 text-xs font-medium text-white hover:bg-white/10">{t('girvi.tab_import')}</Link>
          )}
          {can('inventory.new_stock', 'edit') && (
            <Link to="/app/inventory/new" className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white hover:bg-white/25">{t('dash.add_new')}</Link>
          )}
        </div>
      </div>
      {stock.map((s) => (
        <div key={s.stockClass} className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-widest text-white/60">
            {canList ? (
              <Link to={`/app/inventory/stock?class=${s.stockClass}`} className="hover:text-white hover:underline">{CLASS_LABEL[s.stockClass] ? t(`class.${s.stockClass}`) : s.stockClass}</Link>
            ) : CLASS_LABEL[s.stockClass] ? t(`class.${s.stockClass}`) : s.stockClass}
            <span className="ml-2 normal-case tracking-normal">{t('dash.items_count', { n: s.items })}</span>
          </div>
          <div className="text-3xl font-extrabold">{s.net} <span className="text-base font-medium text-white/60">g</span></div>
          <div className="h-3 rounded-full bg-white/10 shadow-[inset_0_2px_4px_rgb(0_0_0/0.3)]">
            <div
              className={`bar-grow h-3 rounded-full bg-gradient-to-r ${s.stockClass === 'GOLD' ? 'from-brand-strong to-brand shadow-[0_0_10px_rgb(212_175_55/0.5)]' : 'from-slate-400 to-slate-200'}`}
              style={{ width: `${Math.max(4, (Number(s.value) / max) * 100)}%` }}
            />
          </div>
          <div className="text-sm text-white/70">{t(s.pcs === 1 ? 'dash.pcs_one' : 'dash.pcs_other', { n: s.pcs })} · {inr(s.value)}</div>
        </div>
      ))}
      {stock.length === 0 && <p className="text-sm text-white/70">{t('dash.no_stock')}</p>}
    </div>
  )
}

function Header({ actions }: { actions?: React.ReactNode }) {
  const t = useT()
  return (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1>{t('dash.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('dash.subtitle')}</p>
      </div>
      {actions}
    </header>
  )
}

// KPI tile that opens the related list (original dashboard cards had 'All' links).
const TileLink = ({ to, children }: { to: string; children: React.ReactNode }) => (
  <Link to={to} className="block rounded-3xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{children}</Link>
)

export function OwnerDashboard() {
  const t = useT()
  const { can, hasModule } = useAuth()
  const prefs = useDashboardPrefs()
  const { data, isLoading, isError } = useDashboard()
  if (isError) return <div className="space-y-8"><Header /><p className="text-sm text-muted-foreground">{t('dash.load_error')}</p></div>
  if (isLoading || !data) {
    return (
      <div className="space-y-8">
        <Header />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-3xl" />)}
        </div>
      </div>
    )
  }

  const metal = (g: string, sym: string) => (Number(g) ? ` · ${g}g ${sym}` : '')
  const lm = data.lastMonth
  return (
    <div className="space-y-8 tabular-nums">
      <Header actions={<DisplaySettings prefs={prefs} />} />
      {prefs.show('kpis') && (
        <div className="stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <TileLink to="/app/billing/list"><KpiTile icon={ReceiptIndianRupee} label={t('dash.sales_today')} value={inr(data.sales.todayTotal)} sub={<>{t(data.sales.todayCount === 1 ? 'dash.sales_today_sub_one' : 'dash.sales_today_sub_other', { n: data.sales.todayCount, amt: inr(data.sales.todayReceived) })}<Trend cur={data.sales.todayTotal} prev={lm?.todayTotal} /></>} /></TileLink>
          <TileLink to="/app/billing/list"><KpiTile icon={TrendingUp} label={t('dash.sales_month')} value={inr(data.sales.monthTotal)} sub={<>{t('dash.year', { amt: inr(data.sales.yearTotal) })}<Trend cur={data.sales.monthTotal} prev={lm?.monthTotal} /></>} /></TileLink>
          <TileLink to="/app/billing/list"><KpiTile icon={Hourglass} label={t('dash.pending')} value={inr(data.sales.pendingBalance)} sub={data.billsAdvance != null ? `Bills advance ${inr(data.billsAdvance)}` : undefined} /></TileLink>
          <TileLink to="/app/billing/list"><KpiTile icon={ShoppingCart} tone="slate" label={t('dash.purchases_month')} value={inr(data.purchases.monthTotal)} sub={Number(lm?.purchasesMonthTotal) ? <Trend cur={data.purchases.monthTotal} prev={lm?.purchasesMonthTotal} /> : undefined} /></TileLink>
        </div>
      )}
      {prefs.show('secondary') && (
        <div className="stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <TileLink to="/app/udhari/ledger"><KpiTile size="sm" icon={HandCoins} label={t('dash.udhari_receivable')} value={inr(data.udhari.amount)} sub={<>{`${t('dash.collected_month', { amt: inr(data.udhari.collectedThisMonth) })}${metal(data.udhari.gold, 'Au')}${metal(data.udhari.silver, 'Ag')}`}<Trend cur={data.udhari.collectedThisMonth} prev={lm?.collectedThisMonth} prefix="Collected" /></>} /></TileLink>
          <TileLink to="/app/daybook"><KpiTile size="sm" icon={Wallet} tone="slate" label={t('dash.cash_in_hand')} value={inr(data.cash.inHand)} sub={t('dash.bank', { amt: inr(data.cash.bank) })} /></TileLink>
          <TileLink to="/app/settings/parties?type=CUSTOMER"><KpiTile size="sm" icon={Users} tone="slate" label={t('dash.customers')} value={String(data.parties.customers)} sub={<>{t('dash.new_this_month', { n: data.parties.customersNewThisMonth })}<Trend cur={data.parties.customersNewThisMonth} prev={lm?.customersNewThisMonth} prefix="New" /></>} /></TileLink>
          <TileLink to="/app/settings/parties?type=SUPPLIER"><KpiTile size="sm" icon={Factory} tone="slate" label={t('dash.suppliers')} value={String(data.parties.suppliers)} /></TileLink>
        </div>
      )}
      {prefs.show('today') && <TodayActivity counts={data.activityToday} />}

      <div className="grid gap-6 xl:grid-cols-12">
        <div className="space-y-6 xl:col-span-8">
          {prefs.show('chart') && <MonthlyChart data={data.monthly} />}
          {prefs.show('rates') && <ShopRateCard />}
          {prefs.show('schemes') && hasModule('schemes') && can('schemes.all', 'view') && <SchemesOverview />}
        </div>
        <div className="space-y-6 xl:col-span-4">
          {prefs.show('stock') && <StockHero stock={data.stock} />}
          {prefs.show('branches') && data.byBranch && (
            <SectionCard title={t('dash.by_branch')}>
              <Table>
                <TableHeader><TableRow><TableHead>{t('dash.branch')}</TableHead><TableHead className="text-right">{t('dash.sales_today')}</TableHead><TableHead className="text-right">{t('dash.sales_month')}</TableHead></TableRow></TableHeader>
                <TableBody>
                  {data.byBranch.map((b) => (
                    <TableRow key={b.branch.id}>
                      <TableCell className="font-medium">{b.branch.name}</TableCell>
                      <TableCell className="text-right">{inr(b.todayTotal)}</TableCell>
                      <TableCell className="text-right">{inr(b.monthTotal)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </SectionCard>
          )}
          {prefs.show('overdue') && <UdharOverdueCard rows={data.udharOverdue} />}
          {prefs.show('occasions') && <OccasionsCard />}
        </div>
      </div>

      {prefs.show('activity') && <ActivityFeed />}
    </div>
  )
}
