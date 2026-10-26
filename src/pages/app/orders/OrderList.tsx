import type { ColumnDef } from '@tanstack/react-table'
import { ClipboardList, Flame, IndianRupee, Wallet, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { DataTable } from '@/components/DataTable'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useOrders } from '@/lib/ordersQueries'
import { ORDER_STATUSES, type OrderDto } from '@/shared'

const inr = (s: string) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(s))
const date = (s: string) => new Date(s).toLocaleDateString('en-IN')
const VARIANT: Record<string, 'default' | 'secondary' | 'destructive'> = { READY: 'default', PENDING: 'secondary', IN_PROCESS: 'secondary', DELIVERED: 'default', CANCELLED: 'destructive' }

export function OrderList() {
  const [status, setStatus] = useState('')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const { data, isLoading } = useOrders({ status: status || undefined, q: q || undefined, page })

  const columns: ColumnDef<OrderDto, unknown>[] = [
    { header: 'Order', cell: ({ row }) => <Link to={`/app/orders/${row.original.id}`} className="font-medium text-primary hover:underline">#{row.original.orderNo}</Link> },
    { header: 'Date', cell: ({ row }) => date(row.original.orderDate) },
    { header: 'Party', cell: ({ row }) => <span>{row.original.party.name}{row.original.isUrgent && <Badge variant="destructive" className="ml-2">Urgent</Badge>}</span> },
    { header: 'Items', cell: ({ row }) => row.original.items.length },
    { header: 'Est.', cell: ({ row }) => inr(row.original.estTotal) },
    { header: 'Advance', cell: ({ row }) => inr(row.original.advance) },
    { header: 'Status', cell: ({ row }) => <Badge variant={VARIANT[row.original.status] ?? 'secondary'}>{row.original.status}</Badge> },
  ]

  // Summary numbers derived from the page already fetched (no extra requests).
  const items = data?.items ?? []
  const urgentRows = items.filter((o) => o.isUrgent).length
  const estTotal = items.reduce((sum, o) => sum + Number(o.estTotal), 0)
  const advanceTotal = items.reduce((sum, o) => sum + Number(o.advance), 0)

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
        {tile('Order count', data ? String(data.total) : '—', 'Matching current filters', ClipboardList)}
        {tile('Urgent on this page', data ? String(urgentRows) : '—', data ? `of ${items.length} shown` : undefined, Flame)}
        {tile('Estimated value', data ? inr(String(estTotal)) : '—', 'Across this page', IndianRupee)}
        {tile('Advances on this page', data ? inr(String(advanceTotal)) : '—', 'Collected up front', Wallet)}
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 pt-6">
          <Input className="max-w-xs" placeholder="Search order / party / mobile…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} />
          <Select value={status || 'all'} onValueChange={(v) => { setStatus(v === 'all' ? '' : v); setPage(1) }}>
            <SelectTrigger className="w-44" aria-label="Status"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {ORDER_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card className="p-4">
        <DataTable columns={columns} data={data?.items ?? []} isLoading={isLoading} emptyText="No orders" pagination={data ? { page: data.page, pageSize: data.pageSize, total: data.total, onPage: setPage } : undefined} />
      </Card>
    </div>
  )
}
