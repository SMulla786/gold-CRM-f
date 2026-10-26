import type { ColumnDef } from '@tanstack/react-table'
import { Coins, Download, History, IndianRupee, ListOrdered, Pencil, Printer, Wallet, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { DataTable } from '@/components/DataTable'
import { MpinDialog } from '@/components/MpinDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAuth } from '@/lib/auth'
import { downloadCsv } from '@/lib/csv'
import { fetchAllPaged } from '@/lib/queries'
import { useBuySells, useDeleteBuySell } from '@/lib/tradeQueries'
import { businessDayISO, METALS, TRADE_SIDES, type BuySellDto } from '@/shared'

import { DateRangeFilter, HistoryDialog } from './TradeExtras'

const inr = (s: string) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(s))
const date = (s: string) => new Date(s).toLocaleDateString('en-IN')
const time = (s: string) => new Date(s).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })

export function BuySellList() {
  const { can } = useAuth()
  const canDelete = can('buy_sell.entry', 'delete')
  const canEdit = can('buy_sell.entry', 'edit')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [history, setHistory] = useState<BuySellDto | null>(null)
  const [side, setSide] = useState('')
  const [metal, setMetal] = useState('')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const filters = { side: side || undefined, metal: metal || undefined, q: q || undefined, from: from || undefined, to: to || undefined }
  const { data, isLoading } = useBuySells({ ...filters, page, pageSize })
  const [exporting, setExporting] = useState(false)
  const exportCsv = async () => {
    setExporting(true)
    try {
      const all = await fetchAllPaged<BuySellDto>('/app/buy-sell', filters)
      const header = ['No', 'Date', 'Side', 'Party', 'Mobile', 'Metal', 'Lines (weight @ rate = amount)', 'Weight (g)', 'Discount', 'Amount', 'Cash', 'Online', 'Balance', 'Booking', 'Narration']
      const body = all.map((t) => [t.buySellNo, date(t.txnDate), t.side, t.party.name, t.party.mobile, t.metal, t.lines.map((l) => `${l.weight} @ ${l.rate} = ${l.amount}`).join('; '), t.totalWeight, t.discount, t.totalAmount, t.cash, t.online, t.balance, t.bhavBooking ? `#${t.bhavBooking.bookingNo}` : '', t.narration])
      downloadCsv(`buy-sell-${businessDayISO()}.csv`, [header, ...body])
    } finally {
      setExporting(false)
    }
  }
  const del = useDeleteBuySell()
  const [deleting, setDeleting] = useState<BuySellDto | null>(null)

  const columns: ColumnDef<BuySellDto, unknown>[] = [
    { header: 'No', cell: ({ row }) => <span className="font-medium">#{row.original.buySellNo}</span> },
    { header: 'Date', cell: ({ row }) => <div className="whitespace-nowrap">{date(row.original.txnDate)}<div className="text-xs text-muted-foreground">{time(row.original.createdAt)}</div></div> },
    { header: 'Side', cell: ({ row }) => <Badge variant="secondary">{row.original.side}</Badge> },
    { header: 'Party', cell: ({ row }) => <div>{row.original.party.name}<div className="text-xs text-muted-foreground tabular-nums">{row.original.party.mobile}</div></div> },
    { header: 'Metal', cell: ({ row }) => row.original.metal },
    { header: 'Weight', cell: ({ row }) => `${row.original.totalWeight} g` },
    { header: 'Rate', cell: ({ row }) => (
      <div className="tabular-nums">
        {row.original.lines.map((l) => <div key={l.id} className="whitespace-nowrap">{row.original.lines.length > 1 ? `${l.weight} g @ ` : ''}{l.rate}</div>)}
      </div>
    ) },
    { header: 'Amount', cell: ({ row }) => inr(row.original.totalAmount) },
    { header: 'Balance', cell: ({ row }) => inr(row.original.balance) },
    { header: 'Booking', cell: ({ row }) => (row.original.bhavBooking ? `#${row.original.bhavBooking.bookingNo}` : '—') },
    { id: 'actions', header: '', cell: ({ row }) => (
      <div className="flex justify-end gap-1">
        <Button asChild variant="ghost" size="sm"><Link to={`/app/buy_sell/${row.original.id}/print`}><Printer className="size-4" aria-hidden />Print</Link></Button>
        {canEdit && <Button asChild variant="ghost" size="sm"><Link to={`/app/buy_sell/new?edit=${row.original.id}`}><Pencil className="size-4" aria-hidden />Edit</Link></Button>}
        <Button variant="ghost" size="sm" onClick={() => setHistory(row.original)}><History className="size-4" aria-hidden />History</Button>
        {canDelete && <Button variant="ghost" size="sm" onClick={() => setDeleting(row.original)}>Delete</Button>}
      </div>
    ) },
  ]

  // Summary numbers derived from the page already fetched (no extra requests).
  const items = data?.items ?? []
  const amountTotal = items.reduce((sum, t) => sum + Number(t.totalAmount), 0)
  const balanceTotal = items.reduce((sum, t) => sum + Number(t.balance), 0)
  const goldGrams = items.filter((t) => t.metal === 'GOLD').reduce((sum, t) => sum + Number(t.totalWeight), 0)
  const silverGrams = items.filter((t) => t.metal === 'SILVER').reduce((sum, t) => sum + Number(t.totalWeight), 0)

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
        {tile('Matching entries', data ? String(data.total) : '—', 'For current filters', ListOrdered)}
        {tile('Amount on this page', data ? inr(String(amountTotal)) : '—', data ? `${items.length} shown` : undefined, IndianRupee)}
        {tile('Balance on this page', data ? inr(String(balanceTotal)) : '—', 'Unsettled across shown rows', Wallet)}
        {tile('Gold on this page', data ? `${goldGrams.toFixed(3)} g` : '—', data ? `Silver ${silverGrams.toFixed(3)} g` : undefined, Coins)}
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
          <DateRangeFilter from={from} to={to} onChange={(a, b) => { setFrom(a); setTo(b); setPage(1) }} />
          <Button variant="outline" className="ml-auto" disabled={exporting} onClick={() => void exportCsv()}><Download className="size-4" aria-hidden />{exporting ? 'Exporting…' : 'Export CSV'}</Button>
        </CardContent>
      </Card>

      <Card className="p-4">
        <DataTable columns={columns} data={data?.items ?? []} isLoading={isLoading} emptyText="No trades" pagination={data ? { page: data.page, pageSize: data.pageSize, total: data.total, onPage: setPage, onPageSize: setPageSize } : undefined} />
      </Card>
      <MpinDialog open={!!deleting} title={`Delete trade #${deleting?.buySellNo ?? ''}`} onConfirm={(mpin) => del.mutateAsync({ id: deleting!.id, mpin })} onClose={() => setDeleting(null)} />
      <HistoryDialog kind="buy-sell" id={history?.id} title={`History of trade #${history?.buySellNo ?? ''}`} onClose={() => setHistory(null)} />
    </div>
  )
}
