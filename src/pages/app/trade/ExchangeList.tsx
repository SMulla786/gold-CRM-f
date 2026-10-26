import type { ColumnDef } from '@tanstack/react-table'
import { ArrowLeftRight, Coins, Download, FileDown, Flame, History, IndianRupee, Pencil, Printer, Scale, type LucideIcon } from 'lucide-react'
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
import { useT } from '@/lib/i18n'
import { fetchAllPaged, qs } from '@/lib/queries'
import { useDeleteExchange, useExchanges } from '@/lib/tradeQueries'
import { businessDayISO, METALS, PARTY_TYPES, TRADE_SIDES, type ExchangeDto } from '@/shared'

import { ProcessKachaDialog } from './ProcessKachaDialog'
import { DateRangeFilter, HistoryDialog } from './TradeExtras'

const inr = (s: string) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(s))
const date = (s: string) => new Date(s).toLocaleDateString('en-IN')
const time = (s: string) => new Date(s).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })

export function ExchangeList() {
  const t = useT()
  const { can, activeBranch } = useAuth()
  const canDelete = can('exchange.entry', 'delete')
  const canProcess = can('exchange.entry', 'edit')
  const [melting, setMelting] = useState<ExchangeDto | null>(null)
  const [side, setSide] = useState('')
  const [metal, setMetal] = useState('')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [ptype, setPtype] = useState('')
  const [processed, setProcessed] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [history, setHistory] = useState<ExchangeDto | null>(null)
  const filters = { side: side || undefined, metal: metal || undefined, q: q || undefined, partyType: ptype || undefined, processed: processed || undefined, from: from || undefined, to: to || undefined }
  const { data, isLoading } = useExchanges({ ...filters, page, pageSize })
  const del = useDeleteExchange()
  const [exporting, setExporting] = useState(false)
  const exportCsv = async () => {
    setExporting(true)
    try {
      const all = await fetchAllPaged<ExchangeDto>('/app/exchange', filters)
      const header = ['No', 'Date', 'Side', 'Party', 'Party type', 'Mobile', 'Metal', 'Lines (weight @ touch = fine)', 'Fine before adj. (g)', 'Adj. (g)', 'Fine (g)', 'Rate', 'Amount', 'Cash', 'Online', 'Balance', 'Processed', 'Remark']
      const body = all.map((e) => [e.exchangeNo, date(e.txnDate), e.side, e.party.name, e.party.type, e.party.mobile, e.metal, e.lines.map((l) => `${l.weight} @ ${l.touch} = ${l.fine}`).join('; '), e.totalFine, e.diffFine, e.afterFine, e.rate, e.finalAmount, e.cash, e.online, e.balance, e.side === 'BUY' ? (e.processed ? 'Yes' : 'No') : '', e.remark])
      downloadCsv(`exchanges-${businessDayISO()}.csv`, [header, ...body])
    } finally {
      setExporting(false)
    }
  }
  const [deleting, setDeleting] = useState<ExchangeDto | null>(null)

  // Only a BUY (old metal in) adds to the kacha pool, and processing posts at the active branch.
  const meltAction = (e: ExchangeDto) => {
    if (!canProcess || e.side !== 'BUY' || e.processed) return null
    const here = activeBranch === String(e.branch.id)
    return (
      <Button variant="ghost" size="sm" disabled={!here} title={here ? undefined : t('trade.switch_branch_process', { name: e.branch.name })} onClick={() => setMelting(e)}>
        <Flame className="size-4" aria-hidden />{t('trade.ex.send_to_melt')}
      </Button>
    )
  }

  const columns: ColumnDef<ExchangeDto, unknown>[] = [
    { header: t('trade.col_no'), cell: ({ row }) => <span className="font-medium">#{row.original.exchangeNo}</span> },
    { header: t('udhari.date'), cell: ({ row }) => <div className="whitespace-nowrap">{date(row.original.txnDate)}<div className="text-xs text-muted-foreground">{time(row.original.createdAt)}</div></div> },
    { header: t('trade.side'), cell: ({ row }) => <Badge variant="secondary">{row.original.side}</Badge> },
    { header: t('udhari.party'), cell: ({ row }) => <div>{row.original.party.name}<div className="text-xs text-muted-foreground tabular-nums">{row.original.party.mobile}</div></div> },
    { header: t('udhari.metal'), cell: ({ row }) => row.original.metal },
    { header: t('trade.ex.col_fine_before'), cell: ({ row }) => <span className="tabular-nums">{row.original.totalFine} g</span> },
    { header: t('trade.ex.col_adj'), cell: ({ row }) => <span className="tabular-nums">{Number(row.original.diffFine) > 0 ? '+' : ''}{row.original.diffFine} g</span> },
    { header: t('stock.col_fine'), cell: ({ row }) => `${row.original.afterFine} g` },
    { header: t('bill.amount'), cell: ({ row }) => (Number(row.original.rate) > 0 ? inr(row.original.finalAmount) : t('trade.ex.metal_only')) },
    { header: t('bill.balance'), cell: ({ row }) => (Number(row.original.rate) > 0 ? inr(row.original.balance) : `${row.original.afterFine}g`) },
    { header: t('trade.ex.processed'), cell: ({ row }) => (row.original.side !== 'BUY' ? '—' : row.original.processed ? <Badge>{t('trade.ex.processed')}</Badge> : <Badge variant="outline">{t('trade.ex.in_kacha')}</Badge>) },
    { id: 'actions', header: '', cell: ({ row }) => (
      <div className="flex justify-end gap-1">
        {meltAction(row.original)}
        <Button asChild variant="ghost" size="sm"><Link to={`/app/exchange/${row.original.id}/print`}><Printer className="size-4" aria-hidden />{t('bill.print')}</Link></Button>
        {canProcess && !row.original.processed && <Button asChild variant="ghost" size="sm"><Link to={`/app/exchange/new?edit=${row.original.id}`}><Pencil className="size-4" aria-hidden />{t('common.edit')}</Link></Button>}
        <Button variant="ghost" size="sm" onClick={() => setHistory(row.original)}><History className="size-4" aria-hidden />{t('girvi.history')}</Button>
        {canDelete && <Button variant="ghost" size="sm" onClick={() => setDeleting(row.original)}>{t('common.delete')}</Button>}
      </div>
    ) },
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
        {tile(t('table.entries'), data ? String(data.total) : '—', t('inv.shortage.rows_listed_sub'), ArrowLeftRight)}
        {tile(t('trade.ex.tile_gold'), data ? `${goldFine.toFixed(3)} g` : '—', data ? t('payments.confirmed_sub', { n: goldRows.length, total: items.length }) : undefined, Coins)}
        {tile(t('trade.ex.tile_silver'), data ? `${silverFine.toFixed(3)} g` : '—', data ? t('payments.confirmed_sub', { n: silverRows.length, total: items.length }) : undefined, Scale)}
        {tile(t('trade.ex.tile_value'), data ? inr(String(moneyTotal)) : '—', data ? t('trade.ex.tile_value_sub', { n: moneyRows.length }) : undefined, IndianRupee)}
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 pt-6">
          <Input className="max-w-xs" placeholder={t('trade.search_ph')} value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} />
          <Select value={side || 'all'} onValueChange={(v) => { setSide(v === 'all' ? '' : v); setPage(1) }}>
            <SelectTrigger className="w-32" aria-label="Side"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">{t('trade.all_sides')}</SelectItem>{TRADE_SIDES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={metal || 'all'} onValueChange={(v) => { setMetal(v === 'all' ? '' : v); setPage(1) }}>
            <SelectTrigger className="w-32" aria-label="Metal"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">{t('trade.all_metals')}</SelectItem>{METALS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={ptype || 'all'} onValueChange={(v) => { setPtype(v === 'all' ? '' : v); setPage(1) }}>
            <SelectTrigger className="w-40" aria-label="Party type"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">{t('trade.ex.all_ptypes')}</SelectItem>{PARTY_TYPES.map((pt) => <SelectItem key={pt} value={pt}>{pt}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={processed || 'all'} onValueChange={(v) => { setProcessed(v === 'all' ? '' : v); setPage(1) }}>
            <SelectTrigger className="w-40" aria-label="Processing"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">{t('trade.ex.any_processing')}</SelectItem><SelectItem value="true">{t('trade.ex.sent_to_melt')}</SelectItem><SelectItem value="false">{t('trade.ex.not_sent')}</SelectItem></SelectContent>
          </Select>
          <DateRangeFilter from={from} to={to} onChange={(a, b) => { setFrom(a); setTo(b); setPage(1) }} />
          <Button variant="outline" className="ml-auto" disabled={exporting} onClick={() => void exportCsv()}><Download className="size-4" aria-hidden />{exporting ? t('bill.exporting') : t('common.export_csv')}</Button>
          <Button asChild variant="outline"><Link to={`/app/exchange/print${qs({ ...filters, ptype: ptype || undefined })}`}><FileDown className="size-4" aria-hidden />{t('bill.download_pdf')}</Link></Button>
        </CardContent>
      </Card>

      <Card className="p-4">
        <DataTable columns={columns} data={items} isLoading={isLoading} emptyText={t('trade.ex.empty')} pagination={data ? { page: data.page, pageSize: data.pageSize, total: data.total, onPage: setPage, onPageSize: setPageSize } : undefined} />
      </Card>
      <MpinDialog open={!!deleting} title={t('trade.ex.delete_title', { no: deleting?.exchangeNo ?? '' })} onConfirm={(mpin) => del.mutateAsync({ id: deleting!.id, mpin })} onClose={() => setDeleting(null)} />
      <HistoryDialog kind="exchange" id={history?.id} title={t('trade.ex.history_title', { no: history?.exchangeNo ?? '' })} onClose={() => setHistory(null)} />
      {melting && <ProcessKachaDialog metal={melting.metal} source={{ id: melting.id, exchangeNo: melting.exchangeNo, fine: melting.afterFine }} onClose={() => setMelting(null)} />}
    </div>
  )
}
