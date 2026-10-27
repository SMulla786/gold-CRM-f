import type { ColumnDef } from '@tanstack/react-table'
import { Download, Search } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { DataTable } from '@/components/DataTable'
import { WhatsAppShareDialog } from '@/components/WhatsAppShareDialog'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useUdharLedger } from '@/lib/udhariQueries'
import { downloadCsv } from '@/lib/csv'
import { useT } from '@/lib/i18n'
import { fetchAllPaged } from '@/lib/queries'
import { PARTY_TYPES, type PartyBalanceRowDto } from '@/shared'

// + = party owes shop (red), − = shop owes party (green)
const signed = (s: string, suffix: string) => {
  const v = Number(s)
  if (!v) return '—'
  return <span className={v > 0 ? 'text-destructive' : 'text-green-600 dark:text-green-500'}>{v > 0 ? '' : '−'}{Math.abs(v).toLocaleString('en-IN')}{suffix}</span>
}

export function UdharLedger() {
  const t = useT()
  const [type, setType] = useState('')
  const [nonZero, setNonZero] = useState('true')
  const [q, setQ] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [unit, setUnit] = useState<'amount' | 'gold' | 'silver'>('amount')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [exporting, setExporting] = useState(false)
  const [shareRow, setShareRow] = useState<PartyBalanceRowDto | null>(null)
  const period = !!(from || to) // when a period is set the server fills old/in/out/final
  const unitSuffix = unit === 'amount' ? '' : 'g'
  const { data, isLoading } = useUdharLedger({ type: type || undefined, nonZero, q: q || undefined, from: from || undefined, to: to || undefined, page, pageSize })

  const exportCsv = async () => {
    setExporting(true)
    try {
      const all = await fetchAllPaged<PartyBalanceRowDto>('/app/udhar/ledger', { type: type || undefined, nonZero, q: q || undefined, from: from || undefined, to: to || undefined })
      // with a period set, export its Old/In/Out/Final for all three units too
      const units = ['amount', 'gold', 'silver'] as const
      const parts = ['old', 'in', 'out', 'final'] as const
      const header = ['Party', 'Mobile', 'Amount', 'Gold', 'Silver', 'Last txn', ...(period ? parts.flatMap((p) => units.map((u) => `${p} ${u}`)) : [])]
      const body = all.map((r) => [
        r.party.name, r.party.mobile, r.amount, r.gold, r.silver, r.lastTxnDate ? new Date(r.lastTxnDate).toLocaleDateString('en-IN') : '',
        ...(period ? parts.flatMap((p) => units.map((u) => r[p]?.[u] ?? '')) : []),
      ])
      downloadCsv('udhar-ledger.csv', [header, ...body])
    } finally {
      setExporting(false)
    }
  }

  const columns: ColumnDef<PartyBalanceRowDto, unknown>[] = [
    { id: 'sn', header: '#', cell: ({ row }) => <span className="text-muted-foreground tabular-nums">{(page - 1) * pageSize + row.index + 1}</span> },
    { header: t('udhari.col_party'), cell: ({ row }) => <span className="font-semibold">{row.original.party.name}</span> },
    { header: t('udhari.col_mobile'), cell: ({ row }) => row.original.party.mobile },
    // Period Old/In/Out/Final (from/to set) for the chosen unit — the breakdown carries all three units.
    ...(period
      ? [
          { header: t('udhari.col_old'), cell: ({ row }: { row: { original: PartyBalanceRowDto } }) => signed(row.original.old?.[unit] ?? '0', unitSuffix) },
          { header: t('udhari.col_in'), cell: ({ row }: { row: { original: PartyBalanceRowDto } }) => signed(row.original.in?.[unit] ?? '0', unitSuffix) },
          { header: t('udhari.col_out'), cell: ({ row }: { row: { original: PartyBalanceRowDto } }) => signed(row.original.out?.[unit] ?? '0', unitSuffix) },
          { header: t('bill.final'), cell: ({ row }: { row: { original: PartyBalanceRowDto } }) => signed(row.original.final?.[unit] ?? '0', unitSuffix) },
        ]
      : []),
    { header: t('udhari.col_amount'), cell: ({ row }) => signed(row.original.amount, '') },
    { header: t('udhari.col_gold'), cell: ({ row }) => signed(row.original.gold, 'g') },
    { header: t('udhari.col_silver'), cell: ({ row }) => signed(row.original.silver, 'g') },
    { header: t('udhari.col_last_txn'), cell: ({ row }) => (row.original.lastTxnDate ? new Date(row.original.lastTxnDate).toLocaleDateString('en-IN') : '—') },
    {
      id: 'actions', header: '',
      cell: ({ row }) => (
        <div className="flex justify-end gap-2">
          {/* WhatsApp text stays English (share template) */}
          <Button variant="ghost" size="sm" onClick={() => setShareRow(row.original)}>{t('udhari.share')}</Button>
          <Button asChild variant="ghost" size="sm"><Link to={`/app/udhari?partyId=${row.original.party.id}`}>{t('udhari.new_txn')}</Link></Button>
          <Button asChild variant="outline" size="sm"><Link to={`/app/udhari/statement/${row.original.party.id}`}>{t('udhari.statement')}</Link></Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">{t('udhari.ledger_intro')}</p>
      <Card className="flex flex-wrap items-center gap-3 p-4">
        <div className="relative w-full sm:max-w-xs sm:flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input className="pl-9" placeholder={t('udhari.search')} value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} />
        </div>
        <Select value={type || 'all'} onValueChange={(v) => { setType(v === 'all' ? '' : v); setPage(1) }}>
          <SelectTrigger className="w-40" aria-label="Party type"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('udhari.all_types')}</SelectItem>
            {PARTY_TYPES.map((pt) => <SelectItem key={pt} value={pt}>{pt}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={nonZero} onValueChange={(v) => { setNonZero(v); setPage(1) }}>
          <SelectTrigger className="w-40" aria-label="Balance filter"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="true">{t('udhari.with_balance')}</SelectItem><SelectItem value="false">{t('udhari.all_parties')}</SelectItem></SelectContent>
        </Select>
        <Input className="w-40" type="date" aria-label="Period from" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1) }} />
        <Input className="w-40" type="date" aria-label="Period to" value={to} onChange={(e) => { setTo(e.target.value); setPage(1) }} />
        {period && (
          <Select value={unit} onValueChange={(v) => setUnit(v as 'amount' | 'gold' | 'silver')}>
            <SelectTrigger className="w-32" aria-label="Balance unit"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="amount">{t('udhari.unit_amount')}</SelectItem>
              <SelectItem value="gold">{t('udhari.col_gold')}</SelectItem>
              <SelectItem value="silver">{t('udhari.col_silver')}</SelectItem>
            </SelectContent>
          </Select>
        )}
        <Button className="ml-auto" variant="outline" disabled={exporting} onClick={exportCsv}><Download aria-hidden />{exporting ? t('udhari.exporting') : t('common.export_csv')}</Button>
      </Card>

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        isLoading={isLoading}
        emptyText={t('udhari.no_balances')}
        pagination={data ? { page: data.page, pageSize: data.pageSize, total: data.total, onPage: setPage, onPageSize: setPageSize } : undefined}
      />
      <WhatsAppShareDialog
        open={!!shareRow}
        onClose={() => setShareRow(null)}
        name={shareRow?.party.name}
        mobile={shareRow?.party.mobile}
        buildText={(size) => {
          const r = shareRow!
          const metal = `${Number(r.gold) ? ` · ${r.gold}g gold` : ''}${Number(r.silver) ? ` · ${r.silver}g silver` : ''}`
          if (size === 'MINI') return `${r.party.name}\nBal ₹${r.amount}${metal}`
          return `${r.party.name}${r.party.shopName ? ` (${r.party.shopName})` : ''}\nUdhar balance: ₹${r.amount}${metal}${r.lastTxnDate ? `\nLast transaction: ${new Date(r.lastTxnDate).toLocaleDateString('en-IN')}` : ''}`
        }}
      />
    </div>
  )
}
