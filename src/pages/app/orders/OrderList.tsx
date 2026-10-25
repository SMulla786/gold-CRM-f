import type { ColumnDef } from '@tanstack/react-table'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { DataTable } from '@/components/DataTable'
import { Badge } from '@/components/ui/badge'
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input className="max-w-xs" placeholder="Search order / party / mobile…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} />
        <Select value={status || 'all'} onValueChange={(v) => { setStatus(v === 'all' ? '' : v); setPage(1) }}>
          <SelectTrigger className="w-44" aria-label="Status"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {ORDER_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <DataTable columns={columns} data={data?.items ?? []} isLoading={isLoading} emptyText="No orders" pagination={data ? { page: data.page, pageSize: data.pageSize, total: data.total, onPage: setPage } : undefined} />
    </div>
  )
}
