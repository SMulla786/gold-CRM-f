import type { ColumnDef } from '@tanstack/react-table'
import { Download, Search } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { DataTable } from '@/components/DataTable'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { api } from '@/lib/api'
import { downloadCsv } from '@/lib/csv'
import { useGirviList } from '@/lib/girviQueries'
import { useT } from '@/lib/i18n'
import { qs } from '@/lib/queries'
import type { GirviListItemDto, Paged } from '@/shared'

const inr = (s: string | undefined) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(s ?? 0))
const date = (s: string) => new Date(s).toLocaleDateString('en-IN')
const when = (s: string) => new Date(s).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
const mode = (r: GirviListItemDto) => [Number(r.payoutCash) > 0 && 'Cash', Number(r.payoutOnline) > 0 && 'Online'].filter(Boolean).join(' + ') || '—'

export function GirviList() {
  const t = useT()
  // ?partyId=… opens one customer's loans (customer view, linked from the party name)
  const [params, setParams] = useSearchParams()
  const partyId = params.get('partyId') ?? undefined
  const [status, setStatus] = useState('ACTIVE')
  const [q, setQ] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [partyType, setPartyType] = useState('')
  const [pageSize, setPageSize] = useState(20)
  const [page, setPage] = useState(1)
  const filters = { status: status || undefined, q: q || undefined, from: from || undefined, to: to || undefined, partyType: partyType || undefined, partyId, pageSize }
  const { data, isLoading } = useGirviList({ ...filters, page })
  const reset = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPage(1) }

  const exportCsv = async () => {
    const all: GirviListItemDto[] = []
    for (let p = 1; ; p++) {
      const res = await api.get<Paged<GirviListItemDto>>(`/app/girvi${qs({ ...filters, pageSize: 100, page: p })}`)
      all.push(...res.items)
      if (all.length >= res.total || res.items.length === 0) break
    }
    downloadCsv('girvi-loans.csv', [
      ['Girvi', 'Date/time', 'Customer', 'Mobile', 'Items', 'SI/CI', 'Rate %', 'Payout', 'Principal given', 'Principal returned', 'Outstanding', 'Interest paid', 'Interest due', 'Return by', 'Status'],
      ...all.map((r) => [
        r.girviNo, r.createdAt ? when(r.createdAt) : date(r.issueDate), r.party.name, r.party.mobile, (r.itemNames ?? []).join('; '), r.interestType ?? '', r.ratePercent ?? '', mode(r),
        r.principalGiven ?? '', r.principalReturned ?? '', r.principal, r.interestPaid ?? '', r.interestDue, date(r.returnDate), r.overdue && r.status === 'ACTIVE' ? 'OVERDUE' : r.status,
      ]),
    ])
  }

  const columns: ColumnDef<GirviListItemDto, unknown>[] = [
    { header: t('girvi.title'), cell: ({ row }) => <Link to={`/app/girvi/${row.original.id}`} className="font-semibold text-brand-strong hover:underline">#{row.original.girviNo}</Link> },
    {
      header: t('udhari.col_party'),
      cell: ({ row }) => (
        <button type="button" className="text-left hover:underline" title="Show all loans of this customer" onClick={() => { setParams({ partyId: String(row.original.party.id) }); setPage(1) }}>
          <span className="font-medium">{row.original.party.name}</span>
          <span className="block text-xs text-muted-foreground">{row.original.party.mobile}</span>
        </button>
      ),
    },
    { header: t('girvi.col_issued'), cell: ({ row }) => (row.original.createdAt ? when(row.original.createdAt) : date(row.original.issueDate)) },
    {
      header: t('girvi.col_items'),
      cell: ({ row }) => (
        <div className="max-w-56">
          <span className="tabular-nums">{row.original.pledgedCount}/{row.original.itemCount}</span>
          {row.original.itemNames?.length ? <span className="block truncate text-xs text-muted-foreground" title={row.original.itemNames.join(', ')}>{row.original.itemNames.join(', ')}</span> : null}
        </div>
      ),
    },
    { header: t('girvi.col_mode_type'), cell: ({ row }) => <span className="whitespace-nowrap">{mode(row.original)}<span className="block text-xs text-muted-foreground">{row.original.interestType ?? ''} {row.original.ratePercent ? `${Number(row.original.ratePercent)}%` : ''}</span></span> },
    {
      header: t('girvi.col_principal_in_out'),
      cell: ({ row }) => (
        <span className="whitespace-nowrap tabular-nums">
          <span className="text-destructive">{inr(row.original.principalGiven)}</span> / <span className="text-green-600 dark:text-green-500">{inr(row.original.principalReturned)}</span>
          <span className="block text-xs text-muted-foreground">{t('girvi.principal')}: {inr(row.original.principal)}</span>
        </span>
      ),
    },
    {
      header: t('girvi.col_interest_paid_due'),
      cell: ({ row }) => (
        <span className="whitespace-nowrap tabular-nums">
          <span className="text-green-600 dark:text-green-500">{inr(row.original.interestPaid)}</span> / {inr(row.original.interestDue)}
        </span>
      ),
    },
    { header: t('girvi.col_return_by'), cell: ({ row }) => <span className={row.original.overdue ? 'text-destructive' : ''}>{date(row.original.returnDate)}</span> },
    { header: t('stock.col_status'), cell: ({ row }) => <Badge variant={row.original.status === 'ACTIVE' ? (row.original.overdue ? 'destructive' : 'secondary') : 'default'}>{row.original.overdue && row.original.status === 'ACTIVE' ? 'OVERDUE' : row.original.status}</Badge> },
  ]

  return (
    <div className="space-y-6">
      <Card className="flex flex-wrap items-end gap-3 p-4">
        <div className="relative w-full sm:max-w-xs sm:flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input className="pl-9" placeholder={t('girvi.search')} value={q} onChange={(e) => reset(setQ)(e.target.value)} />
        </div>
        <Select value={status || 'all'} onValueChange={(v) => reset(setStatus)(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-36" aria-label="Status"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">{t('girvi.status_all')}</SelectItem><SelectItem value="ACTIVE">{t('girvi.status_active')}</SelectItem><SelectItem value="CLOSED">{t('girvi.status_closed')}</SelectItem></SelectContent>
        </Select>
        <Select value={partyType || 'all'} onValueChange={(v) => reset(setPartyType)(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-36" aria-label="Party type"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">{t('udhari.all_types')}</SelectItem><SelectItem value="CUSTOMER">{t('dash.customers')}</SelectItem><SelectItem value="SUPPLIER">{t('dash.suppliers')}</SelectItem></SelectContent>
        </Select>
        <Input type="date" className="w-40" aria-label="Issued from" value={from} onChange={(e) => reset(setFrom)(e.target.value)} />
        <Input type="date" className="w-40" aria-label="Issued to" value={to} onChange={(e) => reset(setTo)(e.target.value)} />
        <Select value={String(pageSize)} onValueChange={(v) => reset(setPageSize)(Number(v))}>
          <SelectTrigger className="w-24" aria-label="Rows per page"><SelectValue /></SelectTrigger>
          <SelectContent>{[10, 20, 50, 100].map((n) => <SelectItem key={n} value={String(n)}>{t('girvi.n_rows', { n })}</SelectItem>)}</SelectContent>
        </Select>
        <Button variant="outline" className="ml-auto" onClick={() => void exportCsv()} disabled={!data?.total}>
          <Download aria-hidden /> {t('girvi.excel_csv')}
        </Button>
      </Card>
      {partyId && (
        <div className="flex items-center gap-3 rounded-2xl border border-brand/30 bg-brand/10 px-4 py-2 text-sm">
          {data?.items[0] ? t('girvi.showing_customer_named', { name: data.items[0].party.name }) : t('girvi.showing_customer')}
          <Link to={`/app/girvi/new?partyId=${partyId}`} className="font-medium text-brand-strong hover:underline">{t('girvi.new_loan_for_customer')}</Link>
          <button type="button" className="ml-auto font-medium hover:underline" onClick={() => { setParams({}); setPage(1) }}>{t('girvi.show_all_customers')}</button>
        </div>
      )}
      <DataTable columns={columns} data={data?.items ?? []} isLoading={isLoading} emptyText={t('girvi.no_loans')} pagination={data ? { page: data.page, pageSize: data.pageSize, total: data.total, onPage: setPage } : undefined} />
    </div>
  )
}
