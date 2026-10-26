import type { ColumnDef } from '@tanstack/react-table'
import { useState } from 'react'
import { useParams } from 'react-router-dom'

import { DataTable } from '@/components/DataTable'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useLedger } from '@/lib/accountsQueries'
import { businessDayISO, LEDGER_ASSETS, type LedgerRowDto } from '@/shared'

const today = businessDayISO
const unit = (asset: string) => (asset === 'MONEY' ? '₹' : asset === 'GOLD' || asset === 'SILVER' ? 'g' : 'pcs')
// Main metric shown per asset: money amount / metal fine / pcs for the rest.
const metric = (asset: string, r: LedgerRowDto) => (asset === 'MONEY' ? r.amount : asset === 'GOLD' || asset === 'SILVER' ? r.fine : r.pcs != null ? String(r.pcs) : null) ?? '—'
const date = (s: string) => new Date(s).toLocaleDateString('en-IN')

export function AssetLedger() {
  const { asset: param } = useParams()
  const asset = (param ?? '').toUpperCase()
  const valid = (LEDGER_ASSETS as readonly string[]).includes(asset)
  const [page, setPage] = useState(1)
  const [from, setFrom] = useState(today())
  const [to, setTo] = useState(today())
  const [direction, setDirection] = useState('')
  const { data, isLoading } = useLedger({ asset, page, from, to, direction: direction || undefined })

  if (!valid) return <p className="text-sm text-muted-foreground">Unknown ledger.</p>

  const columns: ColumnDef<LedgerRowDto, unknown>[] = [
    { accessorKey: 'txnDate', header: 'Date', cell: ({ row }) => date(row.original.txnDate) },
    { accessorKey: 'source', header: 'Source' },
    { accessorKey: 'direction', header: 'Dir', cell: ({ row }) => <span className={row.original.direction === 'IN' ? 'text-green-600 dark:text-green-500' : 'text-destructive'}>{row.original.direction}</span> },
    { header: 'Party', cell: ({ row }) => row.original.party?.name ?? '—' },
    { header: 'Item / Narration', cell: ({ row }) => row.original.item?.label ?? row.original.narration ?? '—' },
    { header: unit(asset), cell: ({ row }) => <span className={row.original.reversed ? 'text-muted-foreground line-through' : ''}>{metric(asset, row.original)}</span> },
    { accessorKey: 'balance', header: 'Balance', cell: ({ row }) => <span className="font-medium">{row.original.balance}</span> },
    { accessorKey: 'entryBy', header: 'By', cell: ({ row }) => row.original.entryBy ?? '—' },
  ]

  return (
    <div className="space-y-6">
      <Card className="flex flex-wrap items-end gap-4 p-4">
        <div className="space-y-1.5">
          <Label htmlFor="l-from">From</Label>
          <Input id="l-from" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1) }} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="l-to">To</Label>
          <Input id="l-to" type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1) }} />
        </div>
        <div className="space-y-1.5">
          <Label>Direction</Label>
          <Select value={direction || 'all'} onValueChange={(v) => { setDirection(v === 'all' ? '' : v); setPage(1) }}>
            <SelectTrigger className="w-28" aria-label="Direction">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="IN">In</SelectItem>
              <SelectItem value="OUT">Out</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="ml-auto rounded-full bg-brand/15 px-4 py-2 text-sm text-muted-foreground">
          Opening: <span className="font-bold text-foreground tabular-nums">{data?.opening ?? '—'} {unit(asset)}</span>
        </div>
      </Card>

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        isLoading={isLoading}
        emptyText="No ledger rows"
        pagination={data ? { page: data.page, pageSize: data.pageSize, total: data.total, onPage: setPage } : undefined}
      />
    </div>
  )
}
