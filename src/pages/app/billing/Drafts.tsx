import type { ColumnDef } from '@tanstack/react-table'
import { Search } from 'lucide-react'
import { useState } from 'react'

import { DataTable } from '@/components/DataTable'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useCancelDraft, useDrafts } from '@/lib/draftsQueries'
import { useT } from '@/lib/i18n'
import { DRAFT_STATUSES, type SalesDraftDto } from '@/shared'

const inr = (s: string) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(s))
const dt = (s: string) => new Date(s).toLocaleString('en-IN')
const discLabel = (d: string, u: string) => (u === 'PERCENT' ? `${d}%` : inr(d))
const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive'> = { APPROVED: 'default', PENDING: 'secondary', BILLED: 'default', REJECTED: 'destructive', EXPIRED: 'destructive', CANCELLED: 'secondary' }

export function Drafts() {
  const t = useT()
  const [status, setStatus] = useState('')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const { data, isLoading } = useDrafts({ status: status || undefined, q: q || undefined, page, pageSize })
  const cancel = useCancelDraft()

  const columns: ColumnDef<SalesDraftDto, unknown>[] = [
    { header: t('draft.col_draft'), cell: ({ row }) => <span className="font-semibold">#{row.original.draftNo}</span> },
    { header: t('dash.when'), cell: ({ row }) => dt(row.original.createdAt) },
    { header: t('draft.col_salesman'), cell: ({ row }) => row.original.salesman.name },
    { header: t('bill.customer'), cell: ({ row }) => row.original.party?.name ?? row.original.customerName },
    { header: t('bill.col_items'), cell: ({ row }) => `${row.original.items.length}${row.original.items.some((i) => !i.available) ? ' ⚠' : ''}` },
    { header: t('draft.col_est'), cell: ({ row }) => inr(row.original.estTotal) },
    { header: t('draft.col_req_disc'), cell: ({ row }) => discLabel(row.original.requestedDiscount, row.original.requestedDiscountUnit) },
    {
      header: t('draft.col_approved_disc'),
      cell: ({ row }) => (row.original.approvedDiscount != null ? discLabel(row.original.approvedDiscount, row.original.approvedDiscountUnit ?? 'FIXED') : '—'),
    },
    { header: t('draft.col_note'), cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.note ?? '—'}</span> },
    { header: t('stock.col_status'), cell: ({ row }) => <Badge variant={STATUS_VARIANT[row.original.status] ?? 'secondary'}>{row.original.status}</Badge> },
    {
      id: 'actions', header: '',
      cell: ({ row }) =>
        row.original.status === 'PENDING' || row.original.status === 'APPROVED' ? (
          <Button variant="ghost" size="sm" disabled={cancel.isPending} onClick={() => cancel.mutate({ id: row.original.id })}>{t('common.cancel')}</Button>
        ) : row.original.status === 'REJECTED' && row.original.rejectionReason ? (
          <span className="text-xs text-muted-foreground">{row.original.rejectionReason}</span>
        ) : null,
    },
  ]

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">{t('draft.list_subtitle')}</p>
      <Card className="flex flex-wrap items-center gap-3 p-4">
        <div className="relative w-full sm:max-w-xs sm:flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input className="pl-9" placeholder={t('draft.search')} value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} />
        </div>
        <Select value={status || 'all'} onValueChange={(v) => { setStatus(v === 'all' ? '' : v); setPage(1) }}>
          <SelectTrigger className="w-48" aria-label="Draft status"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('draft.all_statuses')}</SelectItem>
            {DRAFT_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </Card>

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        isLoading={isLoading}
        emptyText={t('draft.no_drafts')}
        pagination={data ? { page: data.page, pageSize: data.pageSize, total: data.total, onPage: setPage, onPageSize: setPageSize } : undefined}
      />
    </div>
  )
}
