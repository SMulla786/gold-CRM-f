import type { ColumnDef } from '@tanstack/react-table'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { DataTable } from '@/components/DataTable'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AddPaymentDialog } from '@/pages/app/billing/AddPaymentDialog'
import { usePendingBills } from '@/lib/udhariQueries'
import { useAuth } from '@/lib/auth'
import { PARTY_TYPES, type BillListItemDto } from '@/shared'

const inr = (s: string) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(s))

export function PendingBills() {
  const { can } = useAuth()
  const canPay = can('billing.sell_bill', 'edit') || can('billing.purchase_bill', 'edit')
  const [type, setType] = useState('')
  const [page, setPage] = useState(1)
  const { data, isLoading } = usePendingBills({ type: type || undefined, page })
  const [paying, setPaying] = useState<BillListItemDto | null>(null)

  const columns: ColumnDef<BillListItemDto, unknown>[] = [
    { header: 'Bill', cell: ({ row }) => <Link to={`/app/billing/view/${row.original.id}`} className="font-medium text-primary hover:underline">{row.original.billNo}</Link> },
    { header: 'Kind', cell: ({ row }) => <Badge variant="secondary">{row.original.kind}</Badge> },
    { header: 'Party', cell: ({ row }) => row.original.party.name },
    { header: 'Items', cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.itemsSummary ?? '—'}</span> },
    { header: 'Final', cell: ({ row }) => inr(row.original.final) },
    { header: 'Balance', cell: ({ row }) => <span className={Number(row.original.balance) < 0 ? 'text-green-600 dark:text-green-500' : 'text-destructive'}>{inr(row.original.balance)}</span> },
    {
      id: 'actions', header: '',
      cell: ({ row }) => (canPay && row.original.kind === 'SELL' && Number(row.original.balance) > 0 ? <Button variant="outline" size="sm" onClick={() => setPaying(row.original)}>Add payment</Button> : null),
    },
  ]

  return (
    <div className="space-y-4">
      <Select value={type || 'all'} onValueChange={(v) => { setType(v === 'all' ? '' : v); setPage(1) }}>
        <SelectTrigger className="w-40" aria-label="Party type"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All types</SelectItem>
          {PARTY_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
        </SelectContent>
      </Select>

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        isLoading={isLoading}
        emptyText="No pending bills"
        pagination={data ? { page: data.page, pageSize: data.pageSize, total: data.total, onPage: setPage } : undefined}
      />

      {paying && <AddPaymentDialog bill={paying} onClose={() => setPaying(null)} />}
    </div>
  )
}
