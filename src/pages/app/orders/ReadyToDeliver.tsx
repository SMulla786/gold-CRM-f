import type { ColumnDef } from '@tanstack/react-table'
import { HandCoins, PackageCheck, Scale, Truck, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { DataTable } from '@/components/DataTable'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAuth } from '@/lib/auth'
import { useOrders } from '@/lib/ordersQueries'
import type { OrderDto } from '@/shared'

import { karigarStatus, sumOf } from './orderUtils'

const inr = (s: string | number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(s))
const date = (s: string) => new Date(s).toLocaleDateString('en-IN')

type View = 'READY' | 'DELIVERED' | 'ALL'

/**
 * Ready to deliver (order billing): READY orders to bill, DELIVERED orders already billed, or both.
 * "All" is one list query with statuses=READY,DELIVERED.
 */
export function ReadyToDeliver() {
  const { can } = useAuth()
  const canBill = can('billing.sell_bill', 'edit')
  const [view, setView] = useState<View>('READY')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const { data, isLoading } = useOrders({ q: q.trim() || undefined, page, pageSize, statuses: view === 'ALL' ? 'READY,DELIVERED' : view })
  // "Waiting to bill" tile under "All": a count-only READY query (one row)
  const readyCount = useOrders({ q: q.trim() || undefined, page: 1, pageSize: 1, status: 'READY' }, view === 'ALL')
  const loaded = !!data
  const rows = data?.items ?? []
  const total = data?.total ?? 0

  const columns: ColumnDef<OrderDto, unknown>[] = [
    { header: 'Order', cell: ({ row }) => <Link to={`/app/orders/${row.original.id}`} className="font-medium text-primary hover:underline">#{row.original.orderNo}</Link> },
    { header: 'Date', cell: ({ row }) => <span className="whitespace-nowrap">{date(row.original.orderDate)}{row.original.deliveryDate ? <span className="block text-xs text-muted-foreground">due {date(row.original.deliveryDate)}</span> : null}</span> },
    { header: 'Customer', cell: ({ row }) => <span>{row.original.party.name}{row.original.party.mobile && <span className="block text-xs text-muted-foreground">{row.original.party.mobile}</span>}</span> },
    { header: 'Products', cell: ({ row }) => <span className="text-sm">{row.original.items.map((it) => `${it.itemName.name}${it.pcs > 1 ? ` ×${it.pcs}` : ''}`).join(', ')}</span> },
    { header: 'Karigar', cell: ({ row }) => <span className="text-xs text-muted-foreground">{karigarStatus(row.original)}</span> },
    { header: 'Returned gross / fine (g)', cell: ({ row }) => <span className="whitespace-nowrap tabular-nums">{sumOf(row.original.items, (it) => it.returnedGross).toFixed(3)} / {sumOf(row.original.items, (it) => it.returnedFine).toFixed(3)}</span> },
    { header: 'Ghat (g)', cell: ({ row }) => <span className="tabular-nums">{sumOf(row.original.items, (it) => it.ghatAllowance).toFixed(3)}</span> },
    { header: 'Labour paid', cell: ({ row }) => <span className="tabular-nums">{inr(sumOf(row.original.items, (it) => it.karigarLabour))}</span> },
    { header: 'Est. / Advance', cell: ({ row }) => <span className="whitespace-nowrap tabular-nums">{inr(row.original.estTotal)}<span className="block text-xs text-muted-foreground">adv {inr(row.original.advance)}</span></span> },
    { header: 'Status', cell: ({ row }) => <Badge variant={row.original.status === 'READY' ? 'default' : 'secondary'}>{row.original.status}</Badge> },
    {
      id: 'action',
      header: '',
      cell: ({ row }) =>
        row.original.status === 'READY' && canBill ? (
          <Button asChild size="sm"><Link to={`/app/billing?orderId=${row.original.id}`}>Bill order</Link></Button>
        ) : row.original.billId ? (
          <Button asChild size="sm" variant="outline"><Link to={`/app/billing/view/${row.original.billId}`}>Open bill</Link></Button>
        ) : null,
    },
  ]

  const readyTotal = view === 'READY' ? data?.total : view === 'ALL' ? readyCount.data?.total : undefined
  const shownBalance = rows.filter((o) => o.status === 'READY').reduce((a, o) => a + Number(o.estTotal) - Number(o.advance), 0)
  const shownFine = rows.reduce((a, o) => a + sumOf(o.items, (it) => it.returnedFine), 0)

  const tile = (label: string, value: string, sub: string | undefined, Icon: LucideIcon) => (
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
      <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tile('Listed', loaded ? String(total) : '—', view === 'ALL' ? 'Ready and delivered' : view === 'READY' ? 'Ready to bill' : 'Delivered', PackageCheck)}
        {tile('Waiting to bill', readyTotal != null ? String(readyTotal) : '—', 'Orders in READY', Truck)}
        {tile('Balance on this page', loaded ? inr(shownBalance) : '—', 'Estimate less advance, ready orders', HandCoins)}
        {tile('Returned fine on this page', loaded ? `${shownFine.toFixed(3)} g` : '—', 'Received back from karigars', Scale)}
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 pt-6">
          <Select value={view} onValueChange={(v) => { setView(v as View); setPage(1) }}>
            <SelectTrigger className="w-56" aria-label="Show orders"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="READY">Ready to bill</SelectItem>
              <SelectItem value="DELIVERED">Delivered</SelectItem>
              <SelectItem value="ALL">All (ready and delivered)</SelectItem>
            </SelectContent>
          </Select>
          <Input className="max-w-xs" aria-label="Search ready orders" placeholder="Order no / customer / mobile…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} />
        </CardContent>
      </Card>

      <Card className="p-4">
        <DataTable columns={columns} data={rows} isLoading={isLoading} emptyText={view === 'DELIVERED' ? 'No delivered orders' : 'No orders ready to deliver'} pagination={data ? { page: data.page, pageSize: data.pageSize, total: data.total, onPage: setPage, onPageSize: (s) => { setPageSize(s); setPage(1) } } : undefined} />
      </Card>
    </div>
  )
}
