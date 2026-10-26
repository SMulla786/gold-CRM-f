import type { ColumnDef } from '@tanstack/react-table'
import { ArrowLeftRight, Coins, IndianRupee, Scale, type LucideIcon } from 'lucide-react'
import { useState } from 'react'

import { DataTable } from '@/components/DataTable'
import { MpinDialog } from '@/components/MpinDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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

  // Summary numbers derived from the page already fetched (no extra requests).
  const items = data?.items ?? []
  const rowsOf = (m: ExchangeDto['metal']) => items.filter((e) => e.metal === m)
  const goldRows = rowsOf('GOLD')
  const silverRows = rowsOf('SILVER')
  const goldFine = goldRows.reduce((sum, e) => sum + Number(e.afterFine), 0)
  const silverFine = silverRows.reduce((sum, e) => sum + Number(e.afterFine), 0)
  const moneyRows = items.filter((e) => Number(e.rate) > 0)
  const moneyTotal = moneyRows.reduce((sum, e) => sum + Number(e.finalAmount), 0)

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
        {tile('Entries', data ? String(data.total) : '—', 'Matching current filters', ArrowLeftRight)}
        {tile('Gold fine on this page', data ? `${goldFine.toFixed(3)} g` : '—', data ? `${goldRows.length} of ${items.length} shown` : undefined, Coins)}
        {tile('Silver fine on this page', data ? `${silverFine.toFixed(3)} g` : '—', data ? `${silverRows.length} of ${items.length} shown` : undefined, Scale)}
        {tile('Value on this page', data ? inr(String(moneyTotal)) : '—', data ? `${moneyRows.length} settled in money` : undefined, IndianRupee)}
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 pt-6">
          <Input className="max-w-xs" placeholder="Search no / party / mobile…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} />
          <Select value={side || 'all'} onValueChange={(v) => { setSide(v === 'all' ? '' : v); setPage(1) }}>
            <SelectTrigger className="w-32" aria-label="Side"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All sides</SelectItem>{TRADE_SIDES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={metal || 'all'} onValueChange={(v) => { setMetal(v === 'all' ? '' : v); setPage(1) }}>
            <SelectTrigger className="w-32" aria-label="Metal"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All metals</SelectItem>{METALS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card className="p-4">
        <DataTable columns={columns} data={data?.items ?? []} isLoading={isLoading} emptyText="No exchanges" pagination={data ? { page: data.page, pageSize: data.pageSize, total: data.total, onPage: setPage } : undefined} />
      </Card>
      <MpinDialog open={!!deleting} title={`Delete exchange #${deleting?.exchangeNo ?? ''}`} onConfirm={(mpin) => del.mutateAsync({ id: deleting!.id, mpin })} onClose={() => setDeleting(null)} />
    </div>
  )
}
