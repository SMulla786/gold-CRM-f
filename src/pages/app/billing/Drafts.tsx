import type { ColumnDef } from '@tanstack/react-table'
import { useState } from 'react'

import { DataTable } from '@/components/DataTable'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useCancelDraft, useDrafts } from '@/lib/draftsQueries'
import { DRAFT_STATUSES, type SalesDraftDto } from '@/shared'

const inr = (s: string) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(s))
const dt = (s: string) => new Date(s).toLocaleString('en-IN')
const discLabel = (d: string, u: string) => (u === 'PERCENT' ? `${d}%` : inr(d))
const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive'> = { APPROVED: 'default', PENDING: 'secondary', BILLED: 'default', REJECTED: 'destructive', EXPIRED: 'destructive', CANCELLED: 'secondary' }

export function Drafts() {
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const { data, isLoading } = useDrafts({ status: status || undefined, page })
  const cancel = useCancelDraft()

  const columns: ColumnDef<SalesDraftDto, unknown>[] = [
    { header: 'Draft', cell: ({ row }) => <span className="font-medium">#{row.original.draftNo}</span> },
    { header: 'When', cell: ({ row }) => dt(row.original.createdAt) },
    { header: 'Salesman', cell: ({ row }) => row.original.salesman.name },
    { header: 'Customer', cell: ({ row }) => row.original.party?.name ?? row.original.customerName },
    { header: 'Items', cell: ({ row }) => `${row.original.items.length}${row.original.items.some((i) => !i.available) ? ' ⚠' : ''}` },
    { header: 'Est.', cell: ({ row }) => inr(row.original.estTotal) },
    { header: 'Req. disc', cell: ({ row }) => discLabel(row.original.requestedDiscount, row.original.requestedDiscountUnit) },
    { header: 'Status', cell: ({ row }) => <Badge variant={STATUS_VARIANT[row.original.status] ?? 'secondary'}>{row.original.status}</Badge> },
    {
      id: 'actions', header: '',
      cell: ({ row }) =>
        row.original.status === 'PENDING' || row.original.status === 'APPROVED' ? (
          <Button variant="ghost" size="sm" disabled={cancel.isPending} onClick={() => cancel.mutate({ id: row.original.id })}>Cancel</Button>
        ) : row.original.status === 'REJECTED' && row.original.rejectionReason ? (
          <span className="text-xs text-muted-foreground">{row.original.rejectionReason}</span>
        ) : null,
    },
  ]

  return (
    <div className="space-y-4">
      <Select value={status || 'all'} onValueChange={(v) => { setStatus(v === 'all' ? '' : v); setPage(1) }}>
        <SelectTrigger className="w-48" aria-label="Draft status"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          {DRAFT_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
        </SelectContent>
      </Select>

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        isLoading={isLoading}
        emptyText="No drafts"
        pagination={data ? { page: data.page, pageSize: data.pageSize, total: data.total, onPage: setPage } : undefined}
      />
    </div>
  )
}
