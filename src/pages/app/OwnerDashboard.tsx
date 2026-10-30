import { ChevronDown, Coins, Crown, Diamond, Gem, HandCoins, Hourglass, ReceiptIndianRupee, ShoppingCart, Sparkles, Truck, Users, Wallet } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { KpiTile } from '@/components/KpiTile'
import { NewPartyDialog } from '@/components/NewPartyDialog'
import { SectionCard } from '@/components/SectionCard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DisplaySettings, SchemesOverview, SectionFooter, TodayActivity, Trend, UdharOverdueCard, useDashboardPrefs } from '@/pages/app/DashboardExtras'
import { ShopRateCard } from '@/pages/app/ShopRateCard'
import { useOccasions } from '@/lib/appQueries'
import { useShortage } from '@/lib/inventoryQueries'
import { useAuth } from '@/lib/auth'
import { useT } from '@/lib/i18n'
import { useUsers } from '@/lib/queries'
import { useActivity, useDashboard } from '@/lib/reportsQueries'
import { sourceHref } from '@/lib/sourceLinks'
import { ACTIVITY_ACTIONS, MODULES, businessDayISO, type ActivityDto, type DashboardDto } from '@/shared'

const inr = (s: string) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(s))
const inrCompact = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', notation: 'compact', maximumFractionDigits: 1 }).format(n)
// Round the chart's top up to 1 / 2 / 2.5 / 5 x 10^k so the axis ticks are readable.
const niceMax = (v: number) => {
  const mag = 10 ** Math.floor(Math.log10(v))
  return ([1, 2, 2.5, 5, 10].find((f) => f * mag >= v) ?? 10) * mag
}
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
  // Earnings = sales − purchases of the same period (bill finals already in DashboardDto.monthly); a loss draws a thin red stub at 0.
  const earn = (m: MonthRow) => Number(m.sales) - Number(m.purchases)
  const max = niceMax(Math.max(1, ...data.flatMap((m) => [Number(m.sales), Number(m.purchases)])))
  const ticks = [max, max / 2, 0]
  const pctTop = (v: number) => `${100 - (v / max) * 100}%`
  return (
    <SectionCard
      title={t('dash.monthly_earnings')}
      subtitle={t('dash.last_12')}
      actions={
        <>
          <span className="text-xs font-medium text-muted-foreground"><span className="text-brand">■</span> {t('dash.sales')} <span className="ml-2 text-slate-400">■</span> {t('dash.purchases')} <span className="ml-2 text-emerald-500">■</span> Earnings</span>
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
      <div className="flex gap-2">
        {/* value axis: 0 / half / top, with matching gridlines behind the bars */}
        <div className="relative h-48 w-14 shrink-0 text-[10px] text-muted-foreground" aria-hidden>
          {ticks.map((v) => <span key={v} className="absolute right-0 -translate-y-1/2 whitespace-nowrap" style={{ top: pctTop(v) }}>{inrCompact(v)}</span>)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="relative h-48">
            {ticks.map((v) => <div key={v} aria-hidden className="absolute inset-x-0 border-t border-dashed border-border" style={{ top: pctTop(v) }} />)}
            <div className="relative flex h-full items-end gap-2">
              {data.map((m) => (
                <div key={m.month} className="flex h-full flex-1 items-end justify-center gap-1">
                  <div className="w-1/3 max-w-4 rounded-t-md bg-gradient-to-t from-brand-strong to-brand" style={{ height: `${(Number(m.sales) / max) * 100}%` }} title={`Sales ${inr(m.sales)}`} />
                  <div className="w-1/3 max-w-4 rounded-t-md bg-slate-300 dark:bg-slate-600" style={{ height: `${(Number(m.purchases) / max) * 100}%` }} title={`Purchases ${inr(m.purchases)}`} />
                  <div className={`w-1/3 max-w-4 rounded-t-md ${earn(m) < 0 ? 'bg-destructive' : 'bg-emerald-500'}`} style={{ height: earn(m) < 0 ? '2px' : `${(earn(m) / max) * 100}%` }} title={`Earnings ${inr(String(earn(m)))}`} />
                </div>
              ))}
            </div>
          </div>
          <div className="mt-2 flex gap-2">
            {data.map((m, i) => (
              <div key={m.month} className="flex-1 text-center">
                <span className={i === data.length - 1 ? 'rounded-md bg-brand/15 px-1.5 text-[10px] font-semibold' : 'text-[10px] text-muted-foreground'}>{m.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </SectionCard>
  )
}

// Record page behind an activity row (entity + entityId as logged by the services); null = no page of its own.
function activityHref(a: ActivityDto): string | null {
  if (a.entity === 'Party' || a.entity === 'PARTY') return '/app/settings/parties'
  if (a.action === 'DELETED' || !/^\d+$/.test(a.entityId)) return null // record gone, or a multi-id / non-numeric ref
  switch (a.entity) {
    case 'BILL': return sourceHref('SELL_BILL', a.entityId)
    case 'UdharTxn': return sourceHref('UDHAR', a.entityId)
    case 'GIRVI': return `/app/girvi/${a.entityId}`
    case 'SchemeEnrollment': return `/app/schemes/members/${a.entityId}`
    case 'Order': return `/app/orders/${a.entityId}`
    case 'JUST_BILL': return `/app/billing/just/view/${a.entityId}`
    case 'SALES_DRAFT': return `/app/billing/drafts/${a.entityId}/slip`
    case 'RepairTicket': return `/app/repair/slip/${a.entityId}`
    default: return null
  }
}

/** Operator filter. Mounted only for ADMIN-level users (/admin/users is an admin route). */
function OperatorSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { data } = useUsers({ pageSize: 100 })
  return (
    <Select value={value || 'all'} onValueChange={(v) => onChange(v === 'all' ? '' : v)}>
      <SelectTrigger className="h-9 w-40 rounded-xl" aria-label="Operator"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All operators</SelectItem>
        {data?.items.map((u) => <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>)}
      </SelectContent>
    </Select>
  )
}

// Website's date filter: presets (default Today); Custom shows the From / To inputs.
const DATE_PRESETS = ['today', 'yesterday', 'last7', 'last30', 'all', 'custom'] as const
type DatePreset = (typeof DATE_PRESETS)[number]
const shiftDay = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
const presetRange = (p: DatePreset): [string, string] => {
  const today = businessDayISO()
  if (p === 'today') return [today, today]
  if (p === 'yesterday') return [shiftDay(today, -1), shiftDay(today, -1)]
  if (p === 'last7') return [shiftDay(today, -6), today]
  if (p === 'last30') return [shiftDay(today, -29), today]
  return ['', '']
}

function ActivityFeed() {
  const t = useT()
  const { me } = useAuth()
  const [userId, setUserId] = useState('')
  const [module, setModule] = useState('')
  const [action, setAction] = useState('')
  const [q, setQ] = useState('')
  const [preset, setPreset] = useState<DatePreset>('today')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 15
  const [dFrom, dTo] = preset === 'custom' ? [from, to] : presetRange(preset)
  const { data } = useActivity({
    module: module || undefined,
    action: action || undefined,
    userId: userId || undefined,
    q: q.trim() || undefined,
    from: dFrom || undefined,
    // `to` is a date; make it inclusive of that whole day.
    to: dTo ? `${dTo}T23:59:59.999` : undefined,
    page,
    pageSize,
  })
  const pages = data ? Math.max(1, Math.ceil(data.total / pageSize)) : 1
  const reset = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPage(1) }
  return (
    <SectionCard
      title={t('dash.recent_system_activity')}
      subtitle={t('dash.activity_sub')}
      actions={<Button asChild size="sm"><Link to="/app/daybook">{t('dash.view_daybook')}</Link></Button>}
    >
      <div className="flex flex-wrap gap-2 border-b px-6 py-4">
        <Input className="h-9 min-w-48 flex-1 rounded-xl" aria-label="Search activity" placeholder={t('dash.search_ph')} value={q} onChange={(e) => reset(setQ)(e.target.value)} />
        <Select value={preset} onValueChange={(v) => reset(setPreset)(v as DatePreset)}>
          <SelectTrigger className="h-9 w-36 rounded-xl" aria-label="Activity date"><SelectValue /></SelectTrigger>
          <SelectContent>{DATE_PRESETS.map((p) => <SelectItem key={p} value={p}>{t(`dash.preset.${p}`)}</SelectItem>)}</SelectContent>
        </Select>
        {preset === 'custom' && (
          <>
            <Input type="date" className="h-9 w-36 rounded-xl" aria-label="Activity from" value={from} onChange={(e) => reset(setFrom)(e.target.value)} />
            <Input type="date" className="h-9 w-36 rounded-xl" aria-label="Activity to" value={to} onChange={(e) => reset(setTo)(e.target.value)} />
          </>
        )}
        <Select value={module || 'all'} onValueChange={(v) => reset(setModule)(v === 'all' ? '' : v)}>
          <SelectTrigger className="h-9 w-40 rounded-xl" aria-label="Module"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('dash.all_modules')}</SelectItem>
            {MODULES.map((m) => <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={action || 'all'} onValueChange={(v) => reset(setAction)(v === 'all' ? '' : v)}>
          <SelectTrigger className="h-9 w-36 rounded-xl" aria-label="Action"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('dash.all_actions')}</SelectItem>
            {ACTIVITY_ACTIONS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
        {me?.level === 'ADMIN' && <OperatorSelect value={userId} onChange={reset(setUserId)} />}
      </div>
      <Table>
        <TableHeader>
          <TableRow><TableHead>{t('dash.col_datetime')}</TableHead><TableHead>{t('dash.col_action')}</TableHead><TableHead>{t('dash.col_details')}</TableHead><TableHead>{t('dash.col_party')}</TableHead><TableHead>{t('dash.activity.operator')}</TableHead></TableRow>
        </TableHeader>
        <TableBody>
          {data?.items.length ? data.items.map((a) => {
            const href = activityHref(a)
            return (
            <TableRow key={a.id}>
              <TableCell className="whitespace-nowrap text-muted-foreground">{new Date(a.createdAt).toLocaleString('en-IN')}</TableCell>
              <TableCell><Badge variant="secondary">{a.action}</Badge><div className="mt-1 text-xs text-muted-foreground">{a.module}</div></TableCell>
              <TableCell>{href ? <Link to={href} className="font-medium text-brand hover:underline">{a.summary}</Link> : a.summary}</TableCell>
              <TableCell>{a.partyName ?? '—'}</TableCell>
              <TableCell className="text-muted-foreground">{a.user ?? '—'}</TableCell>
            </TableRow>
            )
          }) : (
            <TableRow><TableCell colSpan={5} className="h-16 text-center text-muted-foreground">{t('dash.no_activity')}</TableCell></TableRow>
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

/** Item groups below their minimum (status SHORTAGE) — same /stock/shortage data and rule as the Shortage page. Mounted only with inventory.all_stock view. */
function LowStockBadge() {
  const { data } = useShortage({ status: 'SHORTAGE' })
  const n = data?.length ?? 0
  if (!n) return null
  return (
    <Link to="/app/inventory/shortage" className="inline-flex items-center gap-1.5 rounded-full bg-destructive/90 px-2.5 py-0.5 text-xs font-semibold text-white hover:bg-destructive">
      {n} low stock
    </Link>
  )
}

// Website order of the stock tiles; every class shows, zero when there is no stock of it.
const STOCK_TILES = [
  { cls: 'GOLD', icon: Coins },
  { cls: 'SILVER', icon: Gem },
  { cls: 'ARTIFICIAL', icon: Sparkles },
  { cls: 'STONE', icon: Diamond },
  { cls: 'FRANCHISE', icon: Crown },
] as const

/** Inventory Stock section: one tile per stock class (gold g, silver kg, the rest in items) and the total stock value. */
function InventoryStock({ stock }: { stock: DashboardDto['stock'] }) {
  const t = useT()
  const { can } = useAuth()
  const total = stock.reduce((sum, s) => sum + Number(s.value), 0)
  const canList = can('inventory.all_stock', 'view')
  return (
    <SectionCard
      title={t('dash.inventory_stock')}
      subtitle={t('dash.inventory_sub')}
      actions={
        <>
          {canList && <LowStockBadge />}
          {can('inventory.import_stock', 'edit') && <Button asChild size="sm" variant="outline"><Link to="/app/inventory/import">{t('girvi.tab_import')}</Link></Button>}
          {can('inventory.new_stock', 'edit') && <Button asChild size="sm"><Link to="/app/inventory/new">{t('dash.add_new')}</Link></Button>}
        </>
      }
    >
      <div className="stagger grid gap-3 p-6 sm:grid-cols-3 xl:grid-cols-5">
        {STOCK_TILES.map(({ cls, icon }) => {
          const s = stock.find((x) => x.stockClass === cls)
          const value = cls === 'GOLD' ? `${s?.net ?? '0'} g` : cls === 'SILVER' ? `${(Number(s?.net ?? 0) / 1000).toFixed(3)} kg` : t('dash.items_n', { n: s?.items ?? 0 })
          const tile = <KpiTile size="sm" icon={icon} tone={cls === 'GOLD' ? 'gold' : 'slate'} label={t(`class.${cls}`)} value={value} sub={s ? `${t(s.pcs === 1 ? 'dash.pcs_one' : 'dash.pcs_other', { n: s.pcs })} · ${inr(s.value)}` : undefined} />
          return canList ? <TileLink key={cls} to={`/app/inventory/stock?class=${cls}`}>{tile}</TileLink> : <div key={cls}>{tile}</div>
        })}
      </div>
      <SectionFooter>
        <span>{t('dash.total_stock_value')}</span>
        <span className="font-semibold text-foreground">{inr(String(total))}</span>
      </SectionFooter>
    </SectionCard>
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

/** "Create bill" menu on the Billing & Sales section: the same targets + permission gates as the top-bar QuickBilling dialog. */
function CreateBillMenu({ className }: { className: string }) {
  const t = useT()
  const { can } = useAuth()
  const sell = can('billing.sell_bill', 'view')
  const purchase = can('billing.purchase_bill', 'view')
  const just = can('billing.just_bill', 'view')
  if (!sell && !purchase && !just) return null
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="secondary" className={className}>Create bill<ChevronDown className="size-3.5" aria-hidden /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {sell && <DropdownMenuItem asChild><Link to="/app/billing">{t('comp.sell_gst')}</Link></DropdownMenuItem>}
        {sell && <DropdownMenuItem asChild><Link to="/app/billing?type=ROUGH">{t('comp.sell_rough')}</Link></DropdownMenuItem>}
        {purchase && <DropdownMenuItem asChild><Link to="/app/billing/purchase">{t('billing.tab_purchase')}</Link></DropdownMenuItem>}
        {purchase && <DropdownMenuItem asChild><Link to="/app/billing/purchase?type=ROUGH">{t('comp.purchase_rough')}</Link></DropdownMenuItem>}
        {just && <DropdownMenuItem asChild><Link to="/app/billing/just">{t('billing.tab_just')}</Link></DropdownMenuItem>}
      </DropdownMenuContent>
    </DropdownMenu>
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
  const [newParty, setNewParty] = useState<'CUSTOMER' | 'SUPPLIER' | null>(null)
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

  const lm = data.lastMonth
  const canAddParty = can('settings.parties', 'edit') // same rule as the Shell's "New party" button
  // Small actions in a tile's corner, kept outside the tile's <Link> (no button inside an anchor).
  const corner = 'absolute bottom-3 right-3 flex gap-1.5'
  const pill = 'h-7 rounded-full px-2.5 text-xs'
  const footLink = 'block hover:text-foreground hover:underline'
  const partyTile = (type: 'CUSTOMER' | 'SUPPLIER') => {
    const cust = type === 'CUSTOMER'
    const list = `/app/settings/parties?type=${type}`
    const fresh = cust ? data.parties.customersNewThisMonth : data.parties.suppliersNewThisMonth
    return (
      <div className="relative">
        <TileLink to={list}>
          <KpiTile
            size="sm" icon={cust ? Users : Truck} tone={cust ? 'gold' : 'slate'}
            label={t(cust ? 'dash.total_customers' : 'dash.total_suppliers')}
            value={String(cust ? data.parties.customers : data.parties.suppliers)}
            sub={fresh != null ? <>{t('dash.new_this_month', { n: fresh })}<Trend cur={fresh} prev={cust ? lm?.customersNewThisMonth : lm?.suppliersNewThisMonth} prefix="New" /></> : undefined}
          />
        </TileLink>
        <div className={corner}>
          {canAddParty && <Button size="sm" variant="secondary" className={pill} aria-label={cust ? 'New customer' : 'New supplier'} onClick={() => setNewParty(type)}>{t('dash.parties.new')}</Button>}
          <Button asChild size="sm" variant="secondary" className={pill}><Link to={list} aria-label={cust ? 'All customers' : 'All suppliers'}>{t('dash.all')}</Link></Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 tabular-nums">
      <Header actions={<DisplaySettings prefs={prefs} />} />
      {prefs.show('rates') && <ShopRateCard />}

      {prefs.show('parties') && <div className="stagger grid gap-4 sm:grid-cols-2">{partyTile('CUSTOMER')}{partyTile('SUPPLIER')}</div>}

      {prefs.show('stock') && <InventoryStock stock={data.stock} />}

      {prefs.show('kpis') && (
        <SectionCard title={t('dash.billing_sales')} subtitle={t('dash.billing_sub')} actions={<CreateBillMenu className="rounded-full" />}>
          <div className="stagger grid gap-3 p-6 sm:grid-cols-3">
            <TileLink to="/app/billing/list"><KpiTile size="sm" icon={ReceiptIndianRupee} label={t('dash.total_sell_today')} value={inr(data.sales.todayTotal)} sub={<>{t(data.sales.todayCount === 1 ? 'dash.txn_one' : 'dash.txn_other', { n: data.sales.todayCount })}<Trend cur={data.sales.todayTotal} prev={lm?.todayTotal} /></>} /></TileLink>
            <TileLink to="/app/daybook"><KpiTile size="sm" icon={Wallet} tone="slate" label={t('dash.payment_received')} value={inr(data.sales.todayReceived)} sub={t('dash.todays_collection')} /></TileLink>
            <TileLink to="/app/billing/list"><KpiTile size="sm" icon={Hourglass} tone="slate" label={t('dash.bills_advance')} value={data.billsAdvance != null ? inr(data.billsAdvance) : '—'} sub={t('dash.bill_pending', { amt: inr(data.sales.pendingBalance) })} /></TileLink>
          </div>
          <SectionFooter>
            <Link to="/app/billing/list" className={footLink}>{t('dash.this_month', { amt: inr(data.sales.monthTotal) })}<Trend cur={data.sales.monthTotal} prev={lm?.monthTotal} /></Link>
            <span>{t('dash.this_year', { amt: inr(data.sales.yearTotal) })}</span>
          </SectionFooter>
        </SectionCard>
      )}

      {prefs.show('udhari') && (
        <SectionCard
          title={t('dash.udhari_overview')}
          subtitle={t('dash.udhari_sub')}
          actions={can('udhari.entry', 'edit') && <Button asChild size="sm" variant="secondary" className="rounded-full"><Link to="/app/udhari">{t('dash.udhari.new_txn')}</Link></Button>}
        >
          <div className="stagger grid gap-3 p-6 sm:grid-cols-3">
            <TileLink to="/app/udhari/ledger"><KpiTile size="sm" icon={Coins} label={t('dash.gold_udhari')} value={`${data.udhari.gold} g`} sub={t('dash.gold_pending')} /></TileLink>
            <TileLink to="/app/udhari/ledger"><KpiTile size="sm" icon={Gem} tone="slate" label={t('dash.silver_udhari')} value={`${data.udhari.silver} g`} sub={t('dash.silver_pending')} /></TileLink>
            <TileLink to="/app/udhari/ledger"><KpiTile size="sm" icon={HandCoins} label={t('dash.amount_udhari')} value={inr(data.udhari.amount)} sub={t('dash.amount_pending')} /></TileLink>
          </div>
          <SectionFooter>
            <span className={Number(data.udharOverdueTotal ?? 0) > 0 ? 'text-destructive' : undefined}>{t('dash.overdue_amount', { amt: inr(data.udharOverdueTotal ?? '0') })}</span>
            <Link to="/app/udhari/ledger" className={footLink}>{t('dash.collected_month', { amt: inr(data.udhari.collectedThisMonth) })}<Trend cur={data.udhari.collectedThisMonth} prev={lm?.collectedThisMonth} /></Link>
          </SectionFooter>
        </SectionCard>
      )}

      {prefs.show('schemes') && hasModule('schemes') && can('schemes.all', 'view') && <SchemesOverview />}
      {prefs.show('today') && <TodayActivity counts={data.activityToday} />}
      {prefs.show('activity') && <ActivityFeed />}
      {prefs.show('chart') && <MonthlyChart data={data.monthly} />}

      {/* Not on the original website; kept below its sections. */}
      {prefs.show('secondary') && (
        <div className="stagger grid gap-4 sm:grid-cols-2">
          <TileLink to="/app/billing/list"><KpiTile size="sm" icon={ShoppingCart} tone="slate" label={t('dash.purchases_month')} value={inr(data.purchases.monthTotal)} sub={Number(lm?.purchasesMonthTotal) ? <Trend cur={data.purchases.monthTotal} prev={lm?.purchasesMonthTotal} /> : undefined} /></TileLink>
          <TileLink to="/app/daybook"><KpiTile size="sm" icon={Wallet} tone="slate" label={t('dash.cash_in_hand')} value={inr(data.cash.inHand)} sub={t('dash.bank', { amt: inr(data.cash.bank) })} /></TileLink>
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-2 empty:hidden">
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
        {prefs.show('overdue') && <UdharOverdueCard rows={data.udharOverdue} total={data.udharOverdueTotal} />}
        {prefs.show('occasions') && <OccasionsCard />}
      </div>

      {newParty && <NewPartyDialog open defaultType={newParty} onClose={() => setNewParty(null)} />}
    </div>
  )
}
