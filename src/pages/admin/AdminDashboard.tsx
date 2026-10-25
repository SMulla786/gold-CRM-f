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
    <div className="overflow-x-auto rounded-md border">
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
  const section = (metal: 'gold' | 'silver', label: string) =>
    rates[metal].rows.map((r) => (
      <TableRow key={`${metal}-${r.karatCode}`}>
        <TableCell className="font-medium">{label} {r.title}</TableCell>
        <TableCell className="text-right tabular-nums">{inr(r.sellRate)}</TableCell>
        <TableCell className="text-right tabular-nums">{inr(r.buyRate)}</TableCell>
      </TableRow>
    ))
  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Metal <span className="font-normal text-muted-foreground">(Gold {UNIT[rates.gold.rateUnit]} · Silver {UNIT[rates.silver.rateUnit]})</span></TableHead>
            <TableHead className="text-right">Sell</TableHead>
            <TableHead className="text-right">Buy</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>{section('gold', 'Gold')}{section('silver', 'Silver')}</TableBody>
      </Table>
    </div>
  )
}

export function AdminDashboard() {
  const { data, isLoading } = useAdminOverview()
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>
  if (!data) return null
  const t = data.totals

  const tile = (label: string, value: string, sub?: string) => (
    <Card>
      <CardHeader className="pb-1"><CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle></CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tabular-nums">{value}</div>
        {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tile('Sales today', inr(t.salesToday))}
        {tile('Stock value', inr(t.stock.value), `${grams(t.stock.goldFine)} Au · ${grams(t.stock.silverFine)} Ag · ${t.stock.items} items`)}
        {tile('Receivable', inr(t.udhariReceivable.amount), `${grams(t.udhariReceivable.gold)} Au · ${grams(t.udhariReceivable.silver)} Ag`)}
        {tile('Users', String(t.userCount))}
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">By branch</h2>
        <BranchOverviewTable rows={data.branches} />
        <p className="text-xs text-muted-foreground">Per-branch “Receivable” is the signed udhar attributed to that branch; the business total is the sum of positive party balances (balances are business-wide, so the total is not the sum of the rows).</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Today's rates</h2>
        <RatesMini rates={data.rates} />
      </section>
    </div>
  )
}
