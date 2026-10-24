import type { ColumnDef } from '@tanstack/react-table'
import { useState } from 'react'

import { DataTable } from '@/components/DataTable'
import { Badge } from '@/components/ui/badge'
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

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Payments</h1>
      <DataTable
        columns={columns}
        data={data?.items ?? []}
        isLoading={isLoading}
        pagination={data ? { page: data.page, pageSize: data.pageSize, total: data.total, onPage: setPage } : undefined}
      />
    </div>
  )
}
