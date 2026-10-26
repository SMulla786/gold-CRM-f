import type { ColumnDef } from '@tanstack/react-table'
import { Search } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { CsvExportButton } from '@/components/CsvExportButton'
import { DataTable } from '@/components/DataTable'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useT } from '@/lib/i18n'
import { fetchAllPaged } from '@/lib/queries'
import { useUdharEntries } from '@/lib/udhariQueries'
import { LEDGER_SOURCES, type UdharEntryRowDto } from '@/shared'

const date = (s: string) => new Date(s).toLocaleDateString('en-IN')
const time = (s: string) => new Date(s).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })

export function UdharList() {
  const t = useT()
  const [source, setSource] = useState('')
  const [q, setQ] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const filters = { source: source || undefined, q: q || undefined, from: from || undefined, to: to || undefined }
  const { data, isLoading } = useUdharEntries({ ...filters, page, pageSize })
  const exportRows = async () => {
    const all = await fetchAllPaged<UdharEntryRowDto>('/app/udhar/entries', filters)
    return [
      ['Date', 'Time', 'Source', 'Ref', 'Party', 'Mobile', 'Amount', 'Gold', 'Silver', 'Narration', 'Reversal'],
      ...all.map((r) => [date(r.txnDate), time(r.createdAt), r.source, r.reference, r.party.name, r.party.mobile, r.amount, r.gold, r.silver, r.narration, r.isReversal ? 'yes' : '']),
    ]
  }

  const columns: ColumnDef<UdharEntryRowDto, unknown>[] = [
    { id: 'sn', header: '#', cell: ({ row }) => <span className="text-muted-foreground tabular-nums">{(page - 1) * pageSize + row.index + 1}</span> },
    { header: t('udhari.date'), cell: ({ row }) => date(row.original.txnDate) },
    { header: t('udhari.col_time'), cell: ({ row }) => <span className="text-muted-foreground tabular-nums">{time(row.original.createdAt)}</span> },
    { header: t('udhari.col_source'), cell: ({ row }) => row.original.source },
    { header: t('udhari.col_ref'), cell: ({ row }) => row.original.reference },
    {
      header: t('udhari.col_party'),
      cell: ({ row }) => <div><div className="font-medium">{row.original.party.name}</div>{row.original.party.mobile && <div className="text-xs text-muted-foreground">{row.original.party.mobile}</div>}</div>,
    },
    { header: '₹', cell: ({ row }) => <span className={row.original.isReversal ? 'line-through' : ''}>{Number(row.original.amount) ? row.original.amount : '—'}</span> },
    { header: t('udhari.col_gold'), cell: ({ row }) => (Number(row.original.gold) ? `${row.original.gold}g` : '—') },
    { header: t('udhari.col_silver'), cell: ({ row }) => (Number(row.original.silver) ? `${row.original.silver}g` : '—') },
    { header: t('udhari.col_narration'), cell: ({ row }) => row.original.narration ?? '—' },
    {
      id: 'actions', header: '',
      // manual udhar entries open their receipt (print / MPIN delete); other sources live in their own module
      cell: ({ row }) => (row.original.source === 'UDHAR' && !row.original.isReversal
        ? <Button asChild variant="outline" size="sm"><Link to={`/app/udhari/txn/${row.original.sourceId}`}>{t('udhari.view')}</Link></Button>
        : null),
    },
  ]

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">{t('udhari.list_intro')}</p>
      <Card className="flex flex-wrap items-end gap-3 p-4">
        <div className="relative w-full sm:max-w-xs sm:flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input className="pl-9" placeholder={t('udhari.search_list')} value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} />
        </div>
        <Select value={source || 'all'} onValueChange={(v) => { setSource(v === 'all' ? '' : v); setPage(1) }}>
          <SelectTrigger className="w-48" aria-label="Source"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('udhari.all_sources')}</SelectItem>
            {LEDGER_SOURCES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input className="w-40" type="date" aria-label="From date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1) }} />
        <Input className="w-40" type="date" aria-label="To date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1) }} />
        <CsvExportButton className="ml-auto" filename="udhar-list.csv" rows={exportRows} />
      </Card>

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        isLoading={isLoading}
        emptyText={t('udhari.no_txns')}
        pagination={data ? { page: data.page, pageSize: data.pageSize, total: data.total, onPage: setPage, onPageSize: setPageSize } : undefined}
      />
    </div>
  )
}
