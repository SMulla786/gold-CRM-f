import type { ColumnDef } from '@tanstack/react-table'
import { Boxes, IndianRupee, Layers, Scale, type LucideIcon } from 'lucide-react'
import { useState } from 'react'

import { DataTable } from '@/components/DataTable'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useKarats } from '@/lib/appQueries'
import { useGroupStock } from '@/lib/inventoryQueries'
import { downloadCsv } from '@/lib/csv'
import { STOCK_CLASSES, STOCK_STATUSES, type GroupStockDto } from '@/shared'

const CLASS_LABEL: Record<string, string> = { GOLD: 'Gold', SILVER: 'Silver', STONE: 'Stone', ARTIFICIAL: 'Artificial', FRANCHISE: 'Franchise' }
const inr = (s: string) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(s))

export function GroupStock() {
  const [stockClass, setStockClass] = useState('')
  const [status, setStatus] = useState('AVAILABLE')
  const [method, setMethod] = useState('')
  const [karatCode, setKaratCode] = useState('')
  const [q, setQ] = useState('')
  const { data: karats } = useKarats()
  const karatCodes = [...new Set((karats ?? []).map((k) => k.code))]
  const { data, isLoading } = useGroupStock({ stockClass: stockClass || undefined, status, method: method || undefined, karatCode: karatCode || undefined, q: q || undefined })

  const columns: ColumnDef<GroupStockDto, unknown>[] = [
    { accessorKey: 'groupName', header: 'Group' },
    { id: 'hsn', header: 'HSN', cell: ({ row }) => row.original.hsnCode ?? '—' },
    { accessorKey: 'karatCode', header: 'Karat', cell: ({ row }) => row.original.karatCode ?? '—' },
    { accessorKey: 'items', header: 'Items' },
    { accessorKey: 'pcs', header: 'Pcs' },
    { accessorKey: 'gross', header: 'Gross' },
    { accessorKey: 'net', header: 'Net' },
    { accessorKey: 'fine', header: 'Fine' },
    { accessorKey: 'value', header: 'Value', cell: ({ row }) => inr(row.original.value) },
  ]

  const exportCsv = () => {
    const header = ['Group', 'HSN', 'Karat', 'Items', 'Pcs', 'Gross', 'Net', 'Fine', 'Value']
    const body = (data ?? []).map((g) => [g.groupName, g.hsnCode ?? '', g.karatCode ?? '', g.items, g.pcs, g.gross, g.net, g.fine, g.value])
    downloadCsv(`group-stock${stockClass ? `-${stockClass.toLowerCase()}` : ''}.csv`, [header, ...body])
  }

  // Summary numbers derived from the rows already fetched (no extra requests).
  const rows = data ?? []
  const totalItems = rows.reduce((sum, g) => sum + g.items, 0)
  const totalPcs = rows.reduce((sum, g) => sum + g.pcs, 0)
  const totalFine = rows.reduce((sum, g) => sum + Number(g.fine), 0)
  const totalValue = rows.reduce((sum, g) => sum + Number(g.value), 0)
  const scope = stockClass ? `${CLASS_LABEL[stockClass]} only` : 'Every class included'

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
        {tile('Groups listed', data ? String(rows.length) : '—', scope, Layers)}
        {tile('Total pieces', data ? String(totalPcs) : '—', data ? `${totalItems} stock entries` : undefined, Boxes)}
        {tile('Fine weight', data ? `${totalFine.toFixed(3)} g` : '—', 'Sum over listed groups', Scale)}
        {tile('Total value', data ? inr(String(totalValue)) : '—', 'Sum over listed groups', IndianRupee)}
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 pt-6">
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
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-36" aria-label="Status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STOCK_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={method || 'all'} onValueChange={(v) => setMethod(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-32" aria-label="Entry type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tag + Loose</SelectItem>
              <SelectItem value="TAG">Tag only</SelectItem>
              <SelectItem value="LOOSE">Loose only</SelectItem>
            </SelectContent>
          </Select>
          <Select value={karatCode || 'all'} onValueChange={(v) => setKaratCode(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-32" aria-label="Purity">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any purity</SelectItem>
              {karatCodes.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input className="max-w-xs" placeholder="Search tag / HUID / item…" aria-label="Search stock" value={q} onChange={(e) => setQ(e.target.value)} />
          <Button className="ml-auto" variant="outline" disabled={!data?.length} onClick={exportCsv}>Export CSV</Button>
        </CardContent>
      </Card>

      <Card className="p-4">
        <DataTable columns={columns} data={data ?? []} isLoading={isLoading} emptyText="No stock" />
      </Card>
    </div>
  )
}
