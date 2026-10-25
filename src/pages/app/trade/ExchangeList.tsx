import type { ColumnDef } from '@tanstack/react-table'
import { useState } from 'react'

import { DataTable } from '@/components/DataTable'
import { MpinDialog } from '@/components/MpinDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAuth } from '@/lib/auth'
import { useDeleteExchange, useExchanges } from '@/lib/tradeQueries'
import { METALS, TRADE_SIDES, type ExchangeDto } from '@/shared'

const inr = (s: string) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(s))
const date = (s: string) => new Date(s).toLocaleDateString('en-IN')

export function ExchangeList() {
  const { can } = useAuth()
  const canDelete = can('exchange.entry', 'delete')
  const [side, setSide] = useState('')
  const [metal, setMetal] = useState('')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const { data, isLoading } = useExchanges({ side: side || undefined, metal: metal || undefined, q: q || undefined, page })
  const del = useDeleteExchange()
  const [deleting, setDeleting] = useState<ExchangeDto | null>(null)

  const columns: ColumnDef<ExchangeDto, unknown>[] = [
    { header: 'No', cell: ({ row }) => <span className="font-medium">#{row.original.exchangeNo}</span> },
    { header: 'Date', cell: ({ row }) => date(row.original.txnDate) },
    { header: 'Side', cell: ({ row }) => <Badge variant="secondary">{row.original.side}</Badge> },
    { header: 'Party', cell: ({ row }) => row.original.party.name },
    { header: 'Metal', cell: ({ row }) => row.original.metal },
    { header: 'Fine', cell: ({ row }) => `${row.original.afterFine} g` },
    { header: 'Amount', cell: ({ row }) => (Number(row.original.rate) > 0 ? inr(row.original.finalAmount) : '— metal') },
    { header: 'Balance', cell: ({ row }) => (Number(row.original.rate) > 0 ? inr(row.original.balance) : `${row.original.afterFine}g`) },
    { id: 'actions', header: '', cell: ({ row }) => (canDelete ? <Button variant="ghost" size="sm" onClick={() => setDeleting(row.original)}>Delete</Button> : null) },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input className="max-w-xs" placeholder="Search no / party / mobile…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} />
        <Select value={side || 'all'} onValueChange={(v) => { setSide(v === 'all' ? '' : v); setPage(1) }}>
          <SelectTrigger className="w-32" aria-label="Side"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All sides</SelectItem>{TRADE_SIDES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={metal || 'all'} onValueChange={(v) => { setMetal(v === 'all' ? '' : v); setPage(1) }}>
          <SelectTrigger className="w-32" aria-label="Metal"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All metals</SelectItem>{METALS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <DataTable columns={columns} data={data?.items ?? []} isLoading={isLoading} emptyText="No exchanges" pagination={data ? { page: data.page, pageSize: data.pageSize, total: data.total, onPage: setPage } : undefined} />
      <MpinDialog open={!!deleting} title={`Delete exchange #${deleting?.exchangeNo ?? ''}`} onConfirm={(mpin) => del.mutateAsync({ id: deleting!.id, mpin })} onClose={() => setDeleting(null)} />
    </div>
  )
}
