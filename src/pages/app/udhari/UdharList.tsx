import type { ColumnDef } from '@tanstack/react-table'
import { useState } from 'react'

import { DataTable } from '@/components/DataTable'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useUdharEntries } from '@/lib/udhariQueries'
import { LEDGER_SOURCES, type UdharEntryRowDto } from '@/shared'

const date = (s: string) => new Date(s).toLocaleDateString('en-IN')

export function UdharList() {
  const [source, setSource] = useState('')
  const [page, setPage] = useState(1)
  const { data, isLoading } = useUdharEntries({ source: source || undefined, page })

  const columns: ColumnDef<UdharEntryRowDto, unknown>[] = [
    { header: 'Date', cell: ({ row }) => date(row.original.txnDate) },
    { header: 'Source', cell: ({ row }) => row.original.source },
    { header: 'Ref', cell: ({ row }) => row.original.reference },
    { header: 'Party', cell: ({ row }) => row.original.party.name },
    { header: '₹', cell: ({ row }) => <span className={row.original.isReversal ? 'line-through' : ''}>{Number(row.original.amount) ? row.original.amount : '—'}</span> },
    { header: 'Gold', cell: ({ row }) => (Number(row.original.gold) ? `${row.original.gold}g` : '—') },
    { header: 'Silver', cell: ({ row }) => (Number(row.original.silver) ? `${row.original.silver}g` : '—') },
    { header: 'Narration', cell: ({ row }) => row.original.narration ?? '—' },
  ]

  return (
    <div className="space-y-4">
      <Select value={source || 'all'} onValueChange={(v) => { setSource(v === 'all' ? '' : v); setPage(1) }}>
        <SelectTrigger className="w-48" aria-label="Source"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All sources</SelectItem>
          {LEDGER_SOURCES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
        </SelectContent>
      </Select>

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        isLoading={isLoading}
        emptyText="No transactions"
        pagination={data ? { page: data.page, pageSize: data.pageSize, total: data.total, onPage: setPage } : undefined}
      />
    </div>
  )
}
