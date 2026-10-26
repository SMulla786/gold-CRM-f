import type { ColumnDef } from '@tanstack/react-table'
import { IndianRupee, ReceiptText, RotateCcw, Scale, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { DataTable } from '@/components/DataTable'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { downloadCsv } from '@/lib/csv'
import { fetchAllPaged } from '@/lib/queries'
import { useSchemeGroups, useSchemeTransactions, useSchemes } from '@/lib/schemesQueries'
import { businessDayISO, SCHEME_KINDS, SCHEME_PAY_MEDIUMS, type SchemeTxnRowDto } from '@/shared'

const inr = (s: string) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(s))
const date = (s: string) => new Date(s).toLocaleDateString('en-IN')
const KIND_LABEL: Record<string, string> = { SAVING: 'Saving', ANJUMAN: 'Anjuman' }

export function SchemeTransactions() {
  const [sp] = useSearchParams()
  const [kind, setKind] = useState(sp.get('kind') ?? '')
  const [schemeId, setSchemeId] = useState('')
  const [groupId, setGroupId] = useState('')
  const [q, setQ] = useState('')
  const [medium, setMedium] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  const [exporting, setExporting] = useState(false)
  const { data: schemes } = useSchemes({ active: 'true', kind: kind || undefined, pageSize: 100 })
  const { data: groups } = useSchemeGroups(schemeId ? Number(schemeId) : undefined)
  const params = {
    kind: kind || undefined, schemeId: schemeId ? Number(schemeId) : undefined, groupId: groupId ? Number(groupId) : undefined, q: q.trim() || undefined,
    medium: medium || undefined, from: from || undefined, to: to || undefined,
  }
  const { data, isLoading } = useSchemeTransactions({ ...params, page })

  const exportCsv = async () => {
    setExporting(true)
    try {
      const all = await fetchAllPaged<SchemeTxnRowDto>('/app/schemes/transactions', params)
      const rows = [['Date', 'Assign', 'Member', 'Scheme', 'Group', 'EMI', 'EMI date', 'Amount', 'Via', 'Fine', 'Reversed']]
      for (const t of all) rows.push([date(t.txnDate), t.assignId, t.party.name, t.scheme.name, t.group?.name ?? '', t.emiNo != null ? String(t.emiNo) : '', t.emiDate ? date(t.emiDate) : '', t.amount, t.medium, t.fine ?? '', t.isReversed ? 'yes' : ''])
      downloadCsv(`scheme-transactions-${businessDayISO()}.csv`, rows)
    } finally { setExporting(false) }
  }

  const columns: ColumnDef<SchemeTxnRowDto, unknown>[] = [
    { header: 'Date', cell: ({ row }) => date(row.original.txnDate) },
    { header: 'Assign', cell: ({ row }) => <span className="font-medium">{row.original.assignId}</span> },
    { header: 'Member', cell: ({ row }) => row.original.party.name },
    { header: 'Scheme', cell: ({ row }) => row.original.scheme.name },
    { header: 'Group', cell: ({ row }) => row.original.group?.name ?? '—' },
    { header: 'EMI', cell: ({ row }) => row.original.emiNo ?? '—' },
    { header: 'EMI date', cell: ({ row }) => (row.original.emiDate ? date(row.original.emiDate) : '—') },
    { header: 'Amount', cell: ({ row }) => inr(row.original.amount) },
    { header: 'Via', cell: ({ row }) => row.original.medium },
    { header: 'Fine', cell: ({ row }) => row.original.fine ?? '—' },
    { id: 'rev', header: '', cell: ({ row }) => (row.original.isReversed ? <Badge variant="outline">Reversed</Badge> : null) },
  ]

  // Summary numbers derived from the page already fetched (no extra requests).
  const items = data?.items ?? []
  const liveRows = items.filter((t) => !t.isReversed)
  const collectedTotal = liveRows.reduce((sum, t) => sum + Number(t.amount), 0)
  const fineTotal = liveRows.reduce((sum, t) => sum + Number(t.fine ?? 0), 0)
  const reversedRows = items.length - liveRows.length

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
        {tile('Total entries', data ? String(data.total) : '—', 'Matching current filters', ReceiptText)}
        {tile('Collected on this page', data ? inr(String(collectedTotal)) : '—', data ? `${liveRows.length} entries, excl. reversals` : undefined, IndianRupee)}
        {tile('Gold fine on this page', data ? `${fineTotal.toFixed(3)} g` : '—', 'Gold schemes, excl. reversals', Scale)}
        {tile('Reversals on this page', data ? String(reversedRows) : '—', data ? `of ${items.length} shown` : undefined, RotateCcw)}
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 pt-6">
          <Input className="max-w-xs" placeholder="Customer / mobile / assign…" aria-label="Customer" value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} />
          <Select value={kind || 'all'} onValueChange={(v) => { setKind(v === 'all' ? '' : v); setSchemeId(''); setGroupId(''); setPage(1) }}>
            <SelectTrigger className="w-36" aria-label="Kind"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All kinds</SelectItem>{SCHEME_KINDS.map((k) => <SelectItem key={k} value={k}>{KIND_LABEL[k]}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={schemeId || 'all'} onValueChange={(v) => { setSchemeId(v === 'all' ? '' : v); setGroupId(''); setPage(1) }}>
            <SelectTrigger className="w-48" aria-label="Scheme"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All schemes</SelectItem>{schemes?.items.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={groupId || 'all'} onValueChange={(v) => { setGroupId(v === 'all' ? '' : v); setPage(1) }} disabled={!schemeId}>
            <SelectTrigger className="w-40" aria-label="Group" title={schemeId ? undefined : 'Pick a scheme first'}><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All groups</SelectItem>{groups?.map((g) => <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={medium || 'all'} onValueChange={(v) => { setMedium(v === 'all' ? '' : v); setPage(1) }}>
            <SelectTrigger className="w-32" aria-label="Medium"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All media</SelectItem>{SCHEME_PAY_MEDIUMS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
          </Select>
          <Input className="w-40" type="date" aria-label="From" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1) }} />
          <Input className="w-40" type="date" aria-label="To" value={to} onChange={(e) => { setTo(e.target.value); setPage(1) }} />
          <Button className="ml-auto" variant="outline" size="sm" disabled={exporting || !data?.total} onClick={() => void exportCsv()}>{exporting ? 'Exporting…' : 'Export CSV'}</Button>
        </CardContent>
      </Card>

      <Card className="p-4">
        <DataTable columns={columns} data={data?.items ?? []} isLoading={isLoading} emptyText="No transactions" pagination={data ? { page: data.page, pageSize: data.pageSize, total: data.total, onPage: setPage } : undefined} />
      </Card>
    </div>
  )
}
