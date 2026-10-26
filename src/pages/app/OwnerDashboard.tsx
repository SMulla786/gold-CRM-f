import { Factory, HandCoins, Hourglass, ReceiptIndianRupee, ShoppingCart, TrendingUp, Users, Wallet } from 'lucide-react'
import { useState } from 'react'

import { KpiTile } from '@/components/KpiTile'
import { SectionCard } from '@/components/SectionCard'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ShopRateCard } from '@/pages/app/ShopRateCard'
import { useOccasions } from '@/lib/appQueries'
import { useT } from '@/lib/i18n'
import { plural } from '@/lib/plural'
import { useActivity, useDashboard } from '@/lib/reportsQueries'
import { ACTIVITY_ACTIONS, MODULES } from '@/shared'

const inr = (s: string) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(s))
const CLASS_LABEL: Record<string, string> = { GOLD: 'Gold', SILVER: 'Silver', STONE: 'Stone', ARTIFICIAL: 'Artificial', FRANCHISE: 'Franchise' }
const monthLabel = (m: string) => new Date(m + '-01').toLocaleDateString('en-IN', { month: 'short' })

function MonthlyChart({ data }: { data: Array<{ month: string; sales: string; purchases: string }> }) {
  const t = useT()
  const max = Math.max(1, ...data.flatMap((m) => [Number(m.sales), Number(m.purchases)]))
  return (
    <SectionCard
      title={t('dash.last_12')}
      actions={<span className="text-xs font-medium text-muted-foreground"><span className="text-brand">■</span> Sales <span className="ml-2 text-slate-400">■</span> Purchases</span>}
      bodyClassName="p-6"
    >
      <div className="flex h-56 items-end gap-2">
        {data.map((m, i) => (
          <div key={m.month} className="flex flex-1 flex-col items-center gap-2">
            <div className="flex h-48 w-full items-end justify-center gap-1">
              <div className="w-1/2 max-w-4 rounded-t-md bg-gradient-to-t from-brand-strong to-brand" style={{ height: `${(Number(m.sales) / max) * 100}%` }} title={`Sales ${inr(m.sales)}`} />
              <div className="w-1/2 max-w-4 rounded-t-md bg-slate-300 dark:bg-slate-600" style={{ height: `${(Number(m.purchases) / max) * 100}%` }} title={`Purchases ${inr(m.purchases)}`} />
            </div>
            <span className={i === data.length - 1 ? 'rounded-md bg-brand/15 px-1.5 text-[10px] font-semibold' : 'text-[10px] text-muted-foreground'}>{monthLabel(m.month)}</span>
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
  const { data } = useActivity({ module: module || undefined, action: action || undefined, pageSize: 15 })
  return (
    <SectionCard
      title={t('dash.recent_activity')}
      actions={
        <>
          <Select value={module || 'all'} onValueChange={(v) => setModule(v === 'all' ? '' : v)}>
            <SelectTrigger className="h-8 w-40 rounded-xl" aria-label="Module"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('dash.all_modules')}</SelectItem>
              {MODULES.map((m) => <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={action || 'all'} onValueChange={(v) => setAction(v === 'all' ? '' : v)}>
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
          <TableRow><TableHead>{t('dash.when')}</TableHead><TableHead>{t('dash.col_module')}</TableHead><TableHead>{t('dash.col_action')}</TableHead><TableHead>{t('dash.col_summary')}</TableHead><TableHead>{t('dash.col_by')}</TableHead></TableRow>
        </TableHeader>
        <TableBody>
          {data?.items.length ? data.items.map((a) => (
            <TableRow key={a.id}>
              <TableCell className="whitespace-nowrap text-muted-foreground">{new Date(a.createdAt).toLocaleString('en-IN')}</TableCell>
              <TableCell>{a.module}</TableCell>
              <TableCell><Badge variant="secondary">{a.action}</Badge></TableCell>
              <TableCell>{a.summary}</TableCell>
              <TableCell className="text-muted-foreground">{a.user ?? '—'}</TableCell>
            </TableRow>
          )) : (
            <TableRow><TableCell colSpan={5} className="h-16 text-center text-muted-foreground">{t('dash.no_activity')}</TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </SectionCard>
  )
}

function OccasionsCard() {
  const { data } = useOccasions(7)
  if (!data || data.length === 0) return null
  return (
    <SectionCard title="Upcoming occasions" bodyClassName="divide-y text-sm">
      {data.map((o) => (
        <div key={`${o.party.id}-${o.kind}`} className="flex flex-wrap justify-between gap-x-3 gap-y-1 px-6 py-3">
          <span><span className="font-medium">{o.party.name}</span> · {o.kind === 'BIRTHDAY' ? 'Birthday' : 'Anniversary'}{o.party.mobile ? ` · ${o.party.mobile}` : ''}</span>
          <span className="whitespace-nowrap text-muted-foreground">{o.daysAway === 0 ? 'Today' : `in ${plural(o.daysAway, 'day')}`} · {new Date(o.date).toLocaleDateString('en-IN')}</span>
        </div>
      ))}
    </SectionCard>
  )
}

/** Headline metric: navy hero with each stock class's net grams and a share-of-value bar. */
function StockHero({ stock }: { stock: Array<{ stockClass: string; net: string; pcs: number; value: string }> }) {
  const t = useT()
  const max = Math.max(1, ...stock.map((s) => Number(s.value)))
  return (
    <div className="hero-card space-y-6 p-6">
      <h2 className="text-xl">{t('dash.stock_on_hand')}</h2>
      {stock.map((s) => (
        <div key={s.stockClass} className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-widest text-white/60">{CLASS_LABEL[s.stockClass] ? t(`class.${s.stockClass}`) : s.stockClass}</div>
          <div className="text-3xl font-extrabold">{s.net} <span className="text-base font-medium text-white/60">g</span></div>
          <div className="h-3 rounded-full bg-white/10 shadow-[inset_0_2px_4px_rgb(0_0_0/0.3)]">
            <div
              className={`bar-grow h-3 rounded-full bg-gradient-to-r ${s.stockClass === 'GOLD' ? 'from-brand-strong to-brand shadow-[0_0_10px_rgb(212_175_55/0.5)]' : 'from-slate-400 to-slate-200'}`}
              style={{ width: `${Math.max(4, (Number(s.value) / max) * 100)}%` }}
            />
          </div>
          <div className="text-sm text-white/70">{plural(s.pcs, 'pc')} · {inr(s.value)}</div>
        </div>
      ))}
      {stock.length === 0 && <p className="text-sm text-white/70">{t('dash.no_stock')}</p>}
    </div>
  )
}

const Header = () => (
  <header>
    <h1>Dashboard</h1>
    <p className="mt-1 text-sm text-muted-foreground">Your shop at a glance — sales, receivables, stock and recent activity.</p>
  </header>
)

export function OwnerDashboard() {
  const t = useT()
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

  return (
    <div className="space-y-8 tabular-nums">
      <Header />
      <div className="stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile icon={ReceiptIndianRupee} label={t('dash.sales_today')} value={inr(data.sales.todayTotal)} sub={`${plural(data.sales.todayCount, 'bill')} · received ${inr(data.sales.todayReceived)}`} />
        <KpiTile icon={TrendingUp} label={t('dash.sales_month')} value={inr(data.sales.monthTotal)} sub={`Year ${inr(data.sales.yearTotal)}`} />
        <KpiTile icon={Hourglass} label={t('dash.pending')} value={inr(data.sales.pendingBalance)} />
        <KpiTile icon={ShoppingCart} tone="slate" label={t('dash.purchases_month')} value={inr(data.purchases.monthTotal)} />
      </div>
      <div className="stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile size="sm" icon={HandCoins} label={t('dash.udhari_receivable')} value={inr(data.udhari.amount)} sub={`Collected this month ${inr(data.udhari.collectedThisMonth)}${Number(data.udhari.gold) ? ` · ${data.udhari.gold}g Au` : ''}`} />
        <KpiTile size="sm" icon={Wallet} tone="slate" label={t('dash.cash_in_hand')} value={inr(data.cash.inHand)} sub={`Bank ${inr(data.cash.bank)}`} />
        <KpiTile size="sm" icon={Users} tone="slate" label={t('dash.customers')} value={String(data.parties.customers)} sub={`${data.parties.customersNewThisMonth} new this month`} />
        <KpiTile size="sm" icon={Factory} tone="slate" label={t('dash.suppliers')} value={String(data.parties.suppliers)} />
      </div>

      <div className="grid gap-6 xl:grid-cols-12">
        <div className="space-y-6 xl:col-span-8">
          <MonthlyChart data={data.monthly} />
          <ShopRateCard />
        </div>
        <div className="space-y-6 xl:col-span-4">
          <StockHero stock={data.stock} />
          {data.byBranch && (
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
          <OccasionsCard />
        </div>
      </div>

      <ActivityFeed />
    </div>
  )
}
