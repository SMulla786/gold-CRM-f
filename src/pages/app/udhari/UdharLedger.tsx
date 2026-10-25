import type { ColumnDef } from '@tanstack/react-table'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { DataTable } from '@/components/DataTable'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useUdharLedger } from '@/lib/udhariQueries'
import { downloadCsv } from '@/lib/csv'
import { fetchAllPaged } from '@/lib/queries'
import { PARTY_TYPES, type PartyBalanceRowDto } from '@/shared'

// + = party owes shop (red), − = shop owes party (green)
const signed = (s: string, suffix: string) => {
  const v = Number(s)
  if (!v) return '—'
  return <span className={v > 0 ? 'text-destructive' : 'text-green-600 dark:text-green-500'}>{v > 0 ? '' : '−'}{Math.abs(v).toLocaleString('en-IN')}{suffix}</span>
}

export function UdharLedger() {
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
    { header: 'Party', cell: ({ row }) => <span className="font-medium">{row.original.party.name}</span> },
    { header: 'Mobile', cell: ({ row }) => row.original.party.mobile },
    { header: 'Amount ₹', cell: ({ row }) => signed(row.original.amount, '') },
    { header: 'Gold', cell: ({ row }) => signed(row.original.gold, 'g') },
    { header: 'Silver', cell: ({ row }) => signed(row.original.silver, 'g') },
    { header: 'Last txn', cell: ({ row }) => (row.original.lastTxnDate ? new Date(row.original.lastTxnDate).toLocaleDateString('en-IN') : '—') },
    { id: 'actions', header: '', cell: ({ row }) => <Button asChild variant="outline" size="sm"><Link to={`/app/udhari/statement/${row.original.party.id}`}>Statement</Link></Button> },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input className="max-w-xs" placeholder="Search name / mobile…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} />
        <Select value={type || 'all'} onValueChange={(v) => { setType(v === 'all' ? '' : v); setPage(1) }}>
          <SelectTrigger className="w-40" aria-label="Party type"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {PARTY_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={nonZero} onValueChange={(v) => { setNonZero(v); setPage(1) }}>
          <SelectTrigger className="w-40" aria-label="Balance filter"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="true">With balance</SelectItem><SelectItem value="false">All parties</SelectItem></SelectContent>
        </Select>
        <Button className="ml-auto" variant="outline" disabled={exporting} onClick={exportCsv}>{exporting ? 'Exporting…' : 'Export CSV'}</Button>
      </div>

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        isLoading={isLoading}
        emptyText="No balances"
        pagination={data ? { page: data.page, pageSize: data.pageSize, total: data.total, onPage: setPage } : undefined}
      />
    </div>
  )
}
