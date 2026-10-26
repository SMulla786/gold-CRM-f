import type { ColumnDef } from '@tanstack/react-table'
import { useState } from 'react'

import { DataTable } from '@/components/DataTable'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { downloadCsv } from '@/lib/csv'
import { fetchAllPaged } from '@/lib/queries'
import { useSchemeTransactions, useSchemes } from '@/lib/schemesQueries'
import { businessDayISO, SCHEME_PAY_MEDIUMS, type SchemeTxnRowDto } from '@/shared'

const inr = (s: string) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(s))
const date = (s: string) => new Date(s).toLocaleDateString('en-IN')

export function SchemeTransactions() {
  const [schemeId, setSchemeId] = useState('')
  const [medium, setMedium] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  const [exporting, setExporting] = useState(false)
  const { data: schemes } = useSchemes({ active: 'true', pageSize: 100 })
  const params = { schemeId: schemeId ? Number(schemeId) : undefined, medium: medium || undefined, from: from || undefined, to: to || undefined }
  const { data, isLoading } = useSchemeTransactions({ ...params, page })

  const exportCsv = async () => {
    setExporting(true)
    try {
      const all = await fetchAllPaged<SchemeTxnRowDto>('/app/schemes/transactions', params)
      const rows = [['Date', 'Assign', 'Member', 'Scheme', 'EMI', 'Amount', 'Via', 'Fine', 'Reversed']]
      for (const t of all) rows.push([date(t.txnDate), t.assignId, t.party.name, t.scheme.name, t.emiNo != null ? String(t.emiNo) : '', t.amount, t.medium, t.fine ?? '', t.isReversed ? 'yes' : ''])
      downloadCsv(`scheme-transactions-${businessDayISO()}.csv`, rows)
    } finally { setExporting(false) }
  }

  const columns: ColumnDef<SchemeTxnRowDto, unknown>[] = [
    { header: 'Date', cell: ({ row }) => date(row.original.txnDate) },
    { header: 'Assign', cell: ({ row }) => <span className="font-medium">{row.original.assignId}</span> },
    { header: 'Member', cell: ({ row }) => row.original.party.name },
    { header: 'Scheme', cell: ({ row }) => row.original.scheme.name },
    { header: 'EMI', cell: ({ row }) => row.original.emiNo ?? '—' },
    { header: 'Amount', cell: ({ row }) => inr(row.original.amount) },
    { header: 'Via', cell: ({ row }) => row.original.medium },
    { header: 'Fine', cell: ({ row }) => row.original.fine ?? '—' },
    { id: 'rev', header: '', cell: ({ row }) => (row.original.isReversed ? <Badge variant="outline">Reversed</Badge> : null) },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={schemeId || 'all'} onValueChange={(v) => { setSchemeId(v === 'all' ? '' : v); setPage(1) }}>
          <SelectTrigger className="w-48" aria-label="Scheme"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All schemes</SelectItem>{schemes?.items.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={medium || 'all'} onValueChange={(v) => { setMedium(v === 'all' ? '' : v); setPage(1) }}>
          <SelectTrigger className="w-32" aria-label="Medium"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All media</SelectItem>{SCHEME_PAY_MEDIUMS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
        </Select>
        <Input className="w-40" type="date" aria-label="From" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1) }} />
        <Input className="w-40" type="date" aria-label="To" value={to} onChange={(e) => { setTo(e.target.value); setPage(1) }} />
        <Button className="ml-auto" variant="outline" size="sm" disabled={exporting || !data?.total} onClick={() => void exportCsv()}>{exporting ? 'Exporting…' : 'Export CSV'}</Button>
      </div>
      <DataTable columns={columns} data={data?.items ?? []} isLoading={isLoading} emptyText="No transactions" pagination={data ? { page: data.page, pageSize: data.pageSize, total: data.total, onPage: setPage } : undefined} />
    </div>
  )
}
