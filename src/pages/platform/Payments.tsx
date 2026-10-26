import type { ColumnDef } from '@tanstack/react-table'
import { Ban, BadgeCheck, Clock, Receipt, type LucideIcon } from 'lucide-react'
import { useState } from 'react'

import { DataTable } from '@/components/DataTable'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { usePayments } from '@/lib/queries'
import type { PaymentDto } from '@/shared'

const inr = (s: string) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(s))
const date = (s: string | null) => (s ? new Date(s).toLocaleDateString('en-IN') : '—')
const statusVariant = (s: PaymentDto['status']) => (s === 'CONFIRMED' ? 'default' : s === 'PENDING' ? 'secondary' : 'destructive')

export function Payments() {
  const [page, setPage] = useState(1)
  const { data, isLoading } = usePayments(page)

  const columns: ColumnDef<PaymentDto, unknown>[] = [
    { accessorKey: 'businessName', header: 'Business' },
    { accessorKey: 'amount', header: 'Amount', cell: ({ row }) => inr(row.original.amount) },
    { accessorKey: 'method', header: 'Method' },
    { accessorKey: 'utr', header: 'UTR / Ref', cell: ({ row }) => row.original.utr ?? '—' },
    { accessorKey: 'status', header: 'Status', cell: ({ row }) => <Badge variant={statusVariant(row.original.status)}>{row.original.status}</Badge> },
    { accessorKey: 'paidAt', header: 'Paid', cell: ({ row }) => date(row.original.paidAt) },
  ]

  // Summary numbers derived from the page already fetched (no extra requests).
  const items = data?.items ?? []
  const confirmedRows = items.filter((p) => p.status === 'CONFIRMED')
  const confirmedSum = confirmedRows.reduce((sum, p) => sum + Number(p.amount), 0)
  const pendingRows = items.filter((p) => p.status === 'PENDING')
  const pendingSum = pendingRows.reduce((sum, p) => sum + Number(p.amount), 0)
  const rejectedRows = items.filter((p) => p.status === 'REJECTED').length

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
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1>Payments</h1>
          <p className="mt-1 text-sm text-muted-foreground">Subscription collections received across the platform</p>
        </div>
      </header>

      <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tile('Total records', data ? String(data.total) : '—', 'All time', Receipt)}
        {tile('Confirmed on this page', data ? inr(String(confirmedSum)) : '—', data ? `${confirmedRows.length} of ${items.length} shown` : undefined, BadgeCheck)}
        {tile('Pending on this page', data ? String(pendingRows.length) : '—', data ? `${inr(String(pendingSum))} awaiting` : undefined, Clock)}
        {tile('Rejected on this page', data ? String(rejectedRows) : '—', data ? `of ${items.length} shown` : undefined, Ban)}
      </div>

      <Card className="p-4">
        <DataTable
          columns={columns}
          data={data?.items ?? []}
          isLoading={isLoading}
          pagination={data ? { page: data.page, pageSize: data.pageSize, total: data.total, onPage: setPage } : undefined}
        />
      </Card>
    </div>
  )
}
