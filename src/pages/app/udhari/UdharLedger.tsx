import type { ColumnDef } from '@tanstack/react-table'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { DataTable } from '@/components/DataTable'
import { Button } from '@/components/ui/button'
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
  const [page, setPage] = useState(1)
  const [exporting, setExporting] = useState(false)
  const { data, isLoading } = useUdharLedger({ type: type || undefined, nonZero, q: q || undefined, page })

  const exportCsv = async () => {
    setExporting(true)
    try {
      const all = await fetchAllPaged<PartyBalanceRowDto>('/app/udhar/ledger', { type: type || undefined, nonZero, q: q || undefined })
      const header = ['Party', 'Mobile', 'Amount', 'Gold', 'Silver', 'Last txn']
      const body = all.map((r) => [r.party.name, r.party.mobile, r.amount, r.gold, r.silver, r.lastTxnDate ? new Date(r.lastTxnDate).toLocaleDateString('en-IN') : ''])
      downloadCsv('udhar-ledger.csv', [header, ...body])
    } finally {
      setExporting(false)
    }
  }

  const columns: ColumnDef<PartyBalanceRowDto, unknown>[] = [
    { header: t('udhari.col_party'), cell: ({ row }) => <span className="font-medium">{row.original.party.name}</span> },
    { header: t('udhari.col_mobile'), cell: ({ row }) => row.original.party.mobile },
    { header: t('udhari.col_amount'), cell: ({ row }) => signed(row.original.amount, '') },
    { header: t('udhari.col_gold'), cell: ({ row }) => signed(row.original.gold, 'g') },
    { header: t('udhari.col_silver'), cell: ({ row }) => signed(row.original.silver, 'g') },
    { header: t('udhari.col_last_txn'), cell: ({ row }) => (row.original.lastTxnDate ? new Date(row.original.lastTxnDate).toLocaleDateString('en-IN') : '—') },
    { id: 'actions', header: '', cell: ({ row }) => <Button asChild variant="outline" size="sm"><Link to={`/app/udhari/statement/${row.original.party.id}`}>{t('udhari.statement')}</Link></Button> },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input className="max-w-xs" placeholder={t('udhari.search')} value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} />
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
        <Button className="ml-auto" variant="outline" disabled={exporting} onClick={exportCsv}>{exporting ? 'Exporting…' : t('common.export_csv')}</Button>
      </div>

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        isLoading={isLoading}
        emptyText={t('udhari.no_balances')}
        pagination={data ? { page: data.page, pageSize: data.pageSize, total: data.total, onPage: setPage } : undefined}
      />
    </div>
  )
}
