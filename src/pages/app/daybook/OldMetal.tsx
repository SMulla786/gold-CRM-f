import type { ColumnDef } from '@tanstack/react-table'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

import { DataTable } from '@/components/DataTable'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useLedger } from '@/lib/accountsQueries'
import { api } from '@/lib/api'
import { useT } from '@/lib/i18n'
import { businessDayISO, LEDGER_SOURCES, type LedgerRowDto, type OldMetalSummaryRowDto } from '@/shared'

const g = (s: string | null) => (s == null ? '—' : `${Number(s).toFixed(3)} g`)
const when = (s: string) => new Date(s).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
const monthStart = () => `${businessDayISO().slice(0, 8)}01`
const ALL = 'ALL'

/** Old Metal Ledger — old/raw (kacha) gold & silver across every module: per-module summary + row history. */
export function OldMetal() {
  const t = useT()
  const [from, setFrom] = useState(monthStart)
  const [to, setTo] = useState(businessDayISO)
  const [metal, setMetal] = useState<'GOLD' | 'SILVER'>('GOLD')
  const [source, setSource] = useState(ALL)
  const [direction, setDirection] = useState(ALL)
  const [page, setPage] = useState(1)

  const summary = useQuery({
    queryKey: ['old-metal-summary', from, to],
    queryFn: () => api.get<OldMetalSummaryRowDto[]>(`/app/old-metal/summary?from=${from}&to=${to}`),
  })
  const ledger = useLedger({
    asset: metal,
    metalForm: 'KACHA',
    from,
    to,
    page,
    source: source === ALL ? undefined : source,
    direction: direction === ALL ? undefined : direction,
  })

  const columns: ColumnDef<LedgerRowDto, unknown>[] = [
    { accessorKey: 'txnDate', header: t('oldmetal.col_datetime'), cell: ({ row }) => when(row.original.createdAt) },
    { accessorKey: 'source', header: t('oldmetal.col_source'), cell: ({ row }) => `${row.original.source} #${row.original.sourceId}` },
    { id: 'party', header: t('oldmetal.col_party'), cell: ({ row }) => row.original.party?.name ?? '—' },
    { accessorKey: 'net', header: t('oldmetal.col_weight'), cell: ({ row }) => <span className="tabular-nums">{g(row.original.net)}</span> },
    { accessorKey: 'fine', header: t('stock.col_fine'), cell: ({ row }) => <span className="tabular-nums">{g(row.original.fine)}</span> },
    { accessorKey: 'karatCode', header: t('oldmetal.col_karat'), cell: ({ row }) => row.original.karatCode ?? '—' },
    {
      accessorKey: 'direction',
      header: t('stock.col_status'),
      cell: ({ row }) => (
        <span className={row.original.direction === 'IN' ? 'text-green-600 dark:text-green-500' : 'text-destructive'}>
          {row.original.direction === 'IN' ? t('oldmetal.credit_in') : t('oldmetal.debit_out')}
        </span>
      ),
    },
    { accessorKey: 'narration', header: t('oldmetal.col_remarks'), cell: ({ row }) => row.original.narration ?? '—' },
    { accessorKey: 'entryBy', header: t('oldmetal.col_author'), cell: ({ row }) => row.original.entryBy ?? '—' },
  ]

  const rows = summary.data ?? []
  const total = (k: keyof Omit<OldMetalSummaryRowDto, 'source'>) => rows.reduce((s, r) => s + Number(r[k]), 0).toFixed(3)

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1.5">
            <Label htmlFor="om-from">{t('common.from')}</Label>
            <Input id="om-from" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1) }} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="om-to">{t('common.to')}</Label>
            <Input id="om-to" type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1) }} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="om-metal">{t('udhari.metal')}</Label>
            <Select value={metal} onValueChange={(v) => { setMetal(v as typeof metal); setPage(1) }}>
              <SelectTrigger id="om-metal"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="GOLD">{t('class.GOLD')}</SelectItem>
                <SelectItem value="SILVER">{t('class.SILVER')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="om-source">{t('oldmetal.col_source')}</Label>
            <Select value={source} onValueChange={(v) => { setSource(v); setPage(1) }}>
              <SelectTrigger id="om-source"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t('dash.all_modules')}</SelectItem>
                {LEDGER_SOURCES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="om-dir">{t('stock.col_status')}</Label>
            <Select value={direction} onValueChange={(v) => { setDirection(v); setPage(1) }}>
              <SelectTrigger id="om-dir"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t('oldmetal.all_status')}</SelectItem>
                <SelectItem value="IN">{t('oldmetal.credit_in')}</SelectItem>
                <SelectItem value="OUT">{t('oldmetal.debit_out')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t('oldmetal.summary_title')}</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('oldmetal.col_source')}</TableHead>
                  <TableHead className="text-right">{t('oldmetal.gold_in')}</TableHead>
                  <TableHead className="text-right">{t('oldmetal.gold_out')}</TableHead>
                  <TableHead className="text-right">{t('oldmetal.gold_net')}</TableHead>
                  <TableHead className="text-right">{t('oldmetal.silver_in')}</TableHead>
                  <TableHead className="text-right">{t('oldmetal.silver_out')}</TableHead>
                  <TableHead className="text-right">{t('oldmetal.silver_net')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.source}>
                    <TableCell className="font-medium">{r.source}</TableCell>
                    <TableCell className="text-right tabular-nums">{g(r.goldIn)}</TableCell>
                    <TableCell className="text-right tabular-nums">{g(r.goldOut)}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{g(r.goldNet)}</TableCell>
                    <TableCell className="text-right tabular-nums">{g(r.silverIn)}</TableCell>
                    <TableCell className="text-right tabular-nums">{g(r.silverOut)}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{g(r.silverNet)}</TableCell>
                  </TableRow>
                ))}
                {rows.length > 0 && (
                  <TableRow className="bg-muted/40 font-semibold">
                    <TableCell>{t('oldmetal.total')}</TableCell>
                    <TableCell className="text-right tabular-nums">{g(total('goldIn'))}</TableCell>
                    <TableCell className="text-right tabular-nums">{g(total('goldOut'))}</TableCell>
                    <TableCell className="text-right tabular-nums">{g(total('goldNet'))}</TableCell>
                    <TableCell className="text-right tabular-nums">{g(total('silverIn'))}</TableCell>
                    <TableCell className="text-right tabular-nums">{g(total('silverOut'))}</TableCell>
                    <TableCell className="text-right tabular-nums">{g(total('silverNet'))}</TableCell>
                  </TableRow>
                )}
                {!summary.isLoading && rows.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="h-20 text-center text-muted-foreground">{t('oldmetal.empty')}</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t('oldmetal.history_title')}</CardTitle></CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={ledger.data?.items ?? []}
            isLoading={ledger.isLoading}
            pagination={ledger.data ? { page: ledger.data.page, pageSize: ledger.data.pageSize, total: ledger.data.total, onPage: setPage } : undefined}
          />
        </CardContent>
      </Card>
    </div>
  )
}
