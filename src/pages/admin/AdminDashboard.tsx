import { BadgeIndianRupee, Boxes, HandCoins, Users, type LucideIcon } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAdminOverview } from '@/lib/queries'
import type { AdminOverviewRowDto, CurrentRatesDto, RateUnitKey } from '@/shared'

const inr = (s: string | number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(s))
const grams = (s: string) => `${Number(s).toFixed(3)} g`
const UNIT: Record<RateUnitKey, string> = { GRAM_1: 'per g', GRAM_10: 'per 10 g', TOLA: 'per tola', KG_1: 'per kg' }

/** Per-branch overview rows (path order, indented by depth). Shared by the dashboard and /admin/branches. */
export function BranchOverviewTable({ rows }: { rows: AdminOverviewRowDto[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-card shadow-xs">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Branch</TableHead>
            <TableHead className="text-right">Sales today</TableHead>
            <TableHead className="text-right">Gold fine</TableHead>
            <TableHead className="text-right">Silver fine</TableHead>
            <TableHead className="text-right">Stock value</TableHead>
            <TableHead className="text-right">Items</TableHead>
            <TableHead className="text-right">Receivable</TableHead>
            <TableHead className="text-right">Users</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.branch.id}>
              <TableCell className="font-medium" style={{ paddingLeft: `${r.branch.depth * 16 + 12}px` }}>
                {r.branch.name}
                {r.branch.isAdminNode && <Badge variant="secondary" className="ml-2">admin</Badge>}
              </TableCell>
              <TableCell className="text-right tabular-nums">{inr(r.salesToday)}</TableCell>
              <TableCell className="text-right tabular-nums">{grams(r.stock.goldFine)}</TableCell>
              <TableCell className="text-right tabular-nums">{grams(r.stock.silverFine)}</TableCell>
              <TableCell className="text-right tabular-nums">{inr(r.stock.value)}</TableCell>
              <TableCell className="text-right tabular-nums">{r.stock.items}</TableCell>
              <TableCell className="text-right tabular-nums">{inr(r.udhariReceivable.amount)}</TableCell>
              <TableCell className="text-right tabular-nums">{r.userCount}</TableCell>
            </TableRow>
          ))}
          {rows.length === 0 && (
            <TableRow><TableCell colSpan={8} className="h-20 text-center text-muted-foreground">No branches.</TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}

function RatesMini({ rates }: { rates: CurrentRatesDto }) {
  const group = (metal: 'gold' | 'silver', label: string) => (
    <div className="space-y-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label} <span className="normal-case tracking-normal">· {UNIT[rates[metal].rateUnit]}</span></p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {rates[metal].rows.map((r) => (
          <div key={`${metal}-${r.karatCode}`} className="rounded-2xl border bg-card p-4 shadow-sm transition-transform duration-300 hover:-translate-y-1">
            <p className="text-sm font-medium">{label} {r.title}</p>
            <p className="mt-2 text-lg font-semibold tabular-nums">{inr(r.sellRate)} <span className="text-xs font-normal text-muted-foreground">Sell</span></p>
            <p className="text-sm tabular-nums text-muted-foreground">{inr(r.buyRate)} Buy</p>
          </div>
        ))}
      </div>
    </div>
  )
  return <div className="space-y-5">{group('gold', 'Gold')}{group('silver', 'Silver')}</div>
}

export function AdminDashboard() {
  const { data, isLoading } = useAdminOverview()
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>
  if (!data) return null
  const t = data.totals

  const tile = (label: string, value: string, sub?: string, Icon: LucideIcon = Boxes) => (
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

  return (
    <div className="space-y-8">
      <header>
        <h1>Business overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">All branches at a glance — sales, stock, receivables and today's rates.</p>
      </header>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tile('Sales today', inr(t.salesToday), undefined, BadgeIndianRupee)}
        {tile('Stock value', inr(t.stock.value), `${grams(t.stock.goldFine)} Au · ${grams(t.stock.silverFine)} Ag · ${t.stock.items} items`, Boxes)}
        {tile('Receivable', inr(t.udhariReceivable.amount), `${grams(t.udhariReceivable.gold)} Au · ${grams(t.udhariReceivable.silver)} Ag`, HandCoins)}
        {tile('Users', String(t.userCount), undefined, Users)}
      </div>

      <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-3">
          <h2 className="text-xl">By branch</h2>
          <BranchOverviewTable rows={data.branches} />
          <p className="text-xs text-muted-foreground">Per-branch “Receivable” is the signed udhar attributed to that branch; the business total is the sum of positive party balances (balances are business-wide, so the total is not the sum of the rows).</p>
        </div>
        <div className="hero-card space-y-6 p-6">
          <h2 className="text-xl">Stock on hand</h2>
          {[
            { label: 'Gold', g: t.stock.goldFine, bar: 'from-brand-strong to-brand' },
            { label: 'Silver', g: t.stock.silverFine, bar: 'from-slate-400 to-slate-200' },
          ].map((m) => {
            const total = Number(t.stock.goldFine) + Number(t.stock.silverFine) || 1
            return (
              <div key={m.label} className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-white/60">{m.label}</p>
                <p className="text-3xl font-extrabold tabular-nums">{Number(m.g).toFixed(3)} <span className="text-base font-medium text-white/60">g</span></p>
                <div className="h-3 rounded-full bg-white/10 shadow-[inset_0_2px_4px_rgb(0_0_0/0.3)]">
                  <div className={`h-3 rounded-full bg-gradient-to-r ${m.bar} shadow-[0_0_10px_rgb(212_175_55/0.5)]`} style={{ width: `${Math.max(4, (Number(m.g) / total) * 100)}%` }} />
                </div>
              </div>
            )
          })}
          <p className="text-sm text-white/70">{inr(t.stock.value)} · {t.stock.items} items</p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl">Today's rates</h2>
        <RatesMini rates={data.rates} />
      </section>
    </div>
  )
}
