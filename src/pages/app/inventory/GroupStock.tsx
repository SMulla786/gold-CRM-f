import type { ColumnDef } from '@tanstack/react-table'
import { useState } from 'react'

import { DataTable } from '@/components/DataTable'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useGroupStock } from '@/lib/inventoryQueries'
import { downloadCsv } from '@/lib/csv'
import { STOCK_CLASSES, type GroupStockDto } from '@/shared'

const CLASS_LABEL: Record<string, string> = { GOLD: 'Gold', SILVER: 'Silver', STONE: 'Stone', ARTIFICIAL: 'Artificial', FRANCHISE: 'Franchise' }
const inr = (s: string) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(s))

export function GroupStock() {
  const [stockClass, setStockClass] = useState('')
  const { data, isLoading } = useGroupStock({ stockClass: stockClass || undefined })

  const columns: ColumnDef<GroupStockDto, unknown>[] = [
    { accessorKey: 'groupName', header: 'Group' },
    { accessorKey: 'karatCode', header: 'Karat', cell: ({ row }) => row.original.karatCode ?? '—' },
    { accessorKey: 'items', header: 'Items' },
    { accessorKey: 'pcs', header: 'Pcs' },
    { accessorKey: 'gross', header: 'Gross' },
    { accessorKey: 'net', header: 'Net' },
    { accessorKey: 'fine', header: 'Fine' },
    { accessorKey: 'value', header: 'Value', cell: ({ row }) => inr(row.original.value) },
  ]

  const exportCsv = () => {
    const header = ['Group', 'Karat', 'Items', 'Pcs', 'Gross', 'Net', 'Fine', 'Value']
    const body = (data ?? []).map((g) => [g.groupName, g.karatCode ?? '', g.items, g.pcs, g.gross, g.net, g.fine, g.value])
    downloadCsv(`group-stock${stockClass ? `-${stockClass.toLowerCase()}` : ''}.csv`, [header, ...body])
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Select value={stockClass || 'all'} onValueChange={(v) => setStockClass(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-40" aria-label="Stock class">
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
        <Button className="ml-auto" variant="outline" disabled={!data?.length} onClick={exportCsv}>Export CSV</Button>
      </div>
      <DataTable columns={columns} data={data ?? []} isLoading={isLoading} emptyText="No stock" />
    </div>
  )
}
