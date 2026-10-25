import type { ColumnDef } from '@tanstack/react-table'
import { useState } from 'react'

import { DataTable } from '@/components/DataTable'
import { MpinDialog } from '@/components/MpinDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useDeleteStock, useStock } from '@/lib/inventoryQueries'
import { STOCK_CLASSES, STOCK_STATUSES, type StockItemDto } from '@/shared'

const CLASS_LABEL: Record<string, string> = { GOLD: 'Gold', SILVER: 'Silver', STONE: 'Stone', ARTIFICIAL: 'Artificial', FRANCHISE: 'Franchise' }

export function StockList() {
  const [page, setPage] = useState(1)
  const [stockClass, setStockClass] = useState('')
  const [status, setStatus] = useState('AVAILABLE')
  const [q, setQ] = useState('')
  const { data, isLoading } = useStock({ page, status, stockClass: stockClass || undefined, q: q || undefined })
  const del = useDeleteStock()
  const [deleting, setDeleting] = useState<StockItemDto | null>(null)

  const columns: ColumnDef<StockItemDto, unknown>[] = [
    { header: 'Tag / Item', cell: ({ row }) => <span className="font-medium">{row.original.tagNo ?? row.original.itemName.name}</span> },
    { header: 'Group', cell: ({ row }) => row.original.group.name },
    { accessorKey: 'karatCode', header: 'Karat', cell: ({ row }) => row.original.karatCode ?? '—' },
    { accessorKey: 'pcs', header: 'Pcs' },
    { accessorKey: 'gross', header: 'Gross' },
    { accessorKey: 'net', header: 'Net' },
    { accessorKey: 'fine', header: 'Fine' },
    { header: 'Branch', cell: ({ row }) => row.original.branch.name },
    { accessorKey: 'status', header: 'Status', cell: ({ row }) => <Badge variant={row.original.status === 'AVAILABLE' ? 'default' : 'secondary'}>{row.original.status}</Badge> },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) =>
        row.original.status === 'AVAILABLE' ? (
          <Button variant="ghost" size="sm" onClick={() => setDeleting(row.original)}>
            Delete
          </Button>
        ) : null,
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input className="max-w-xs" placeholder="Search tag / item…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} />
        <Select value={stockClass || 'all'} onValueChange={(v) => { setStockClass(v === 'all' ? '' : v); setPage(1) }}>
          <SelectTrigger className="w-36" aria-label="Stock class">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All classes</SelectItem>
            {STOCK_CLASSES.map((c) => (
              <SelectItem key={c} value={c}>
                {CLASS_LABEL[c]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1) }}>
          <SelectTrigger className="w-36" aria-label="Status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STOCK_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        isLoading={isLoading}
        emptyText="No stock items"
        pagination={data ? { page: data.page, pageSize: data.pageSize, total: data.total, onPage: setPage } : undefined}
      />

      <MpinDialog
        open={!!deleting}
        title={`Delete ${deleting?.tagNo ?? deleting?.itemName.name ?? ''}`}
        onConfirm={(mpin) => del.mutateAsync({ id: deleting!.id, mpin })}
        onClose={() => setDeleting(null)}
      />
    </div>
  )
}
