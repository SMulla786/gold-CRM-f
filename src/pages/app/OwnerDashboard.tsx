import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ShopRateCard } from '@/pages/app/ShopRateCard'
import { plural } from '@/lib/plural'
import { useActivity, useDashboard } from '@/lib/reportsQueries'
import { ACTIVITY_ACTIONS, MODULES } from '@/shared'

const inr = (s: string) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(s))
const CLASS_LABEL: Record<string, string> = { GOLD: 'Gold', SILVER: 'Silver', STONE: 'Stone', ARTIFICIAL: 'Artificial', FRANCHISE: 'Franchise' }
const monthLabel = (m: string) => new Date(m + '-01').toLocaleDateString('en-IN', { month: 'short' })

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardHeader className="pb-1"><CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle></CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold break-words">{value}</div>
        {sub && <div className="text-xs text-muted-foreground break-words">{sub}</div>}
      </CardContent>
    </Card>
  )
}

function MonthlyChart({ data }: { data: Array<{ month: string; sales: string; purchases: string }> }) {
  const max = Math.max(1, ...data.flatMap((m) => [Number(m.sales), Number(m.purchases)]))
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Last 12 months
          <span className="ml-3 text-xs font-normal text-muted-foreground"><span className="text-brand">■</span> Sales <span className="ml-2 text-muted-foreground">■</span> Purchases</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex h-40 items-end gap-2">
          {data.map((m) => (
            <div key={m.month} className="flex flex-1 flex-col items-center gap-1">
              <div className="flex h-32 w-full items-end justify-center gap-0.5">
                <div className="w-1/2 rounded-t bg-brand" style={{ height: `${(Number(m.sales) / max) * 100}%` }} title={`Sales ${inr(m.sales)}`} />
                <div className="w-1/2 rounded-t bg-muted-foreground/40" style={{ height: `${(Number(m.purchases) / max) * 100}%` }} title={`Purchases ${inr(m.purchases)}`} />
              </div>
              <span className="text-[10px] text-muted-foreground">{monthLabel(m.month)}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function ActivityFeed() {
  const [module, setModule] = useState('')
  const [action, setAction] = useState('')
  const { data } = useActivity({ module: module || undefined, action: action || undefined, pageSize: 15 })
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-sm font-medium">Recent activity</CardTitle>
          <div className="ml-auto flex gap-2">
            <Select value={module || 'all'} onValueChange={(v) => setModule(v === 'all' ? '' : v)}>
              <SelectTrigger className="h-8 w-40" aria-label="Module"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All modules</SelectItem>
                {MODULES.map((m) => <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={action || 'all'} onValueChange={(v) => setAction(v === 'all' ? '' : v)}>
              <SelectTrigger className="h-8 w-32" aria-label="Action"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All actions</SelectItem>
                {ACTIVITY_ACTIONS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow><TableHead>When</TableHead><TableHead>Module</TableHead><TableHead>Action</TableHead><TableHead>Summary</TableHead><TableHead>By</TableHead></TableRow>
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
              <TableRow><TableCell colSpan={5} className="h-16 text-center text-muted-foreground">No activity</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

export function OwnerDashboard() {
  const { data, isLoading, isError } = useDashboard()
  if (isError) return <p className="text-sm text-muted-foreground">Couldn’t load the dashboard.</p>
  if (isLoading || !data) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
      </div>
    )
  }

  return (
    <div className="space-y-6 tabular-nums">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Sales today" value={inr(data.sales.todayTotal)} sub={`${plural(data.sales.todayCount, 'bill')} · received ${inr(data.sales.todayReceived)}`} />
        <Stat label="Sales this month" value={inr(data.sales.monthTotal)} sub={`Year ${inr(data.sales.yearTotal)}`} />
        <Stat label="Pending (receivable)" value={inr(data.sales.pendingBalance)} />
        <Stat label="Purchases this month" value={inr(data.purchases.monthTotal)} />
        <Stat label="Udhari receivable" value={inr(data.udhari.amount)} sub={`Collected this month ${inr(data.udhari.collectedThisMonth)}${Number(data.udhari.gold) ? ` · ${data.udhari.gold}g Au` : ''}`} />
        <Stat label="Cash in hand" value={inr(data.cash.inHand)} sub={`Bank ${inr(data.cash.bank)}`} />
        <Stat label="Customers" value={String(data.parties.customers)} sub={`${data.parties.customersNewThisMonth} new this month`} />
        <Stat label="Suppliers" value={String(data.parties.suppliers)} />
      </div>

      <ShopRateCard />

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Stock on hand</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {data.stock.map((s) => (
            <div key={s.stockClass}>
              <div className="text-sm text-muted-foreground">{CLASS_LABEL[s.stockClass] ?? s.stockClass}</div>
              <div className="font-semibold">{s.net} g</div>
              <div className="text-xs text-muted-foreground">{plural(s.pcs, 'pc')} · {inr(s.value)}</div>
            </div>
          ))}
          {data.stock.length === 0 && <p className="text-sm text-muted-foreground">No stock yet.</p>}
        </CardContent>
      </Card>

      <MonthlyChart data={data.monthly} />

      {data.byBranch && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">By branch</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Branch</TableHead><TableHead className="text-right">Sales today</TableHead><TableHead className="text-right">Sales this month</TableHead></TableRow></TableHeader>
              <TableBody>
                {data.byBranch.map((b) => (
                  <TableRow key={b.branch.id}>
                    <TableCell>{b.branch.name}</TableCell>
                    <TableCell className="text-right">{inr(b.todayTotal)}</TableCell>
                    <TableCell className="text-right">{inr(b.monthTotal)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <ActivityFeed />
    </div>
  )
}
