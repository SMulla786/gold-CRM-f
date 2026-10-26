import type { ColumnDef } from '@tanstack/react-table'
import { Search } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { DataTable } from '@/components/DataTable'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useLedger } from '@/lib/accountsQueries'
import { useBankAccounts } from '@/lib/appQueries'
import { useT } from '@/lib/i18n'
import { sourceHref } from '@/lib/sourceLinks'
import { businessDayISO, LEDGER_ASSETS, LEDGER_SOURCES, type LedgerRowDto } from '@/shared'

const today = businessDayISO
const unit = (asset: string) => (asset === 'MONEY' ? '₹' : asset === 'GOLD' || asset === 'SILVER' ? 'g' : 'pcs')
// Main metric shown per asset: money amount / metal fine / pcs for the rest.
const metric = (asset: string, r: LedgerRowDto) => (asset === 'MONEY' ? r.amount : asset === 'GOLD' || asset === 'SILVER' ? r.fine : r.pcs != null ? String(r.pcs) : null) ?? '—'
const date = (s: string) => new Date(s).toLocaleDateString('en-IN')
const time = (s: string) => new Date(s).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
const METAL_FORMS = ['USUAL', 'BULLION', 'KACHA'] as const

export function AssetLedger() {
  const t = useT()
  const { asset: param } = useParams()
  const asset = (param ?? '').toUpperCase()
  const valid = (LEDGER_ASSETS as readonly string[]).includes(asset)
  const isMoney = asset === 'MONEY'
  const isMetal = asset === 'GOLD' || asset === 'SILVER'
  const { data: banks } = useBankAccounts()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [from, setFrom] = useState(today())
  const [to, setTo] = useState(today())
  const [direction, setDirection] = useState('')
  const [source, setSource] = useState('')
  const [holder, setHolder] = useState('') // '' all, '0' shop cash, else bank id
  const [metalForm, setMetalForm] = useState('')
  const [q, setQ] = useState('')
  const { data, isLoading } = useLedger({
    asset, page, pageSize, from, to, direction: direction || undefined, source: source || undefined, q: q || undefined,
    bankAccountId: isMoney && holder !== '' ? holder : undefined, metalForm: isMetal ? metalForm || undefined : undefined,
  })
  const reset = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPage(1) }

  if (!valid) return <p className="text-sm text-muted-foreground">{t('daybook.unknown_ledger')}</p>

  const columns: ColumnDef<LedgerRowDto, unknown>[] = [
    { id: 'sn', header: '#', cell: ({ row }) => <span className="text-muted-foreground tabular-nums">{(page - 1) * pageSize + row.index + 1}</span> },
    { accessorKey: 'txnDate', header: t('udhari.date'), cell: ({ row }) => <div className="whitespace-nowrap">{date(row.original.txnDate)}<div className="text-xs text-muted-foreground tabular-nums">{time(row.original.createdAt)}</div></div> },
    { accessorKey: 'source', header: t('daybook.col_source') },
    {
      header: t('udhari.col_ref'),
      cell: ({ row }) => {
        const href = sourceHref(row.original.source, row.original.sourceId)
        return href ? <Link to={href} className="font-medium text-brand-strong hover:underline">#{row.original.sourceId}</Link> : <span className="text-muted-foreground">#{row.original.sourceId}</span>
      },
    },
    { accessorKey: 'direction', header: t('daybook.col_dir'), cell: ({ row }) => <span className={row.original.direction === 'IN' ? 'text-green-600 dark:text-green-500' : 'text-destructive'}>{row.original.direction}</span> },
    { header: t('udhari.party'), cell: ({ row }) => row.original.party?.name ?? '—' },
    { header: t('daybook.col_item_narration'), cell: ({ row }) => row.original.item?.label ?? row.original.narration ?? '—' },
    ...(isMoney ? [{ header: t('daybook.col_account'), cell: ({ row }: { row: { original: LedgerRowDto } }) => row.original.bankAccount?.name ?? t('daybook.shop_cash') }] : []),
    ...(isMetal ? [
      { header: t('daybook.col_type'), cell: ({ row }: { row: { original: LedgerRowDto } }) => row.original.metalForm ?? '—' },
      { header: t('stock.col_karat'), cell: ({ row }: { row: { original: LedgerRowDto } }) => row.original.karatCode ?? '—' },
      { header: t('stock.col_net'), cell: ({ row }: { row: { original: LedgerRowDto } }) => row.original.net ?? '—' },
    ] : []),
    { header: unit(asset), cell: ({ row }) => <span className={row.original.reversed ? 'text-muted-foreground line-through' : ''}>{metric(asset, row.original)}</span> },
    ...(!isMoney && !isMetal ? [{ header: t('daybook.col_total_cost'), cell: ({ row }: { row: { original: LedgerRowDto } }) => (Number(row.original.amount) ? `₹${row.original.amount}` : '—') }] : []),
    { accessorKey: 'balance', header: t('bill.balance'), cell: ({ row }) => <span className="font-medium">{row.original.balance}</span> },
    { accessorKey: 'entryBy', header: t('dash.col_by'), cell: ({ row }) => row.original.entryBy ?? '—' },
  ]

  return (
    <div className="space-y-6">
      <Card className="flex flex-wrap items-end gap-4 p-4">
        <div className="relative w-full sm:max-w-xs sm:flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input className="pl-9" placeholder={t('daybook.search_ref')} value={q} onChange={(e) => reset(setQ)(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="l-from">{t('common.from')}</Label>
          <Input id="l-from" type="date" value={from} onChange={(e) => reset(setFrom)(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="l-to">{t('common.to')}</Label>
          <Input id="l-to" type="date" value={to} onChange={(e) => reset(setTo)(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>{t('udhari.direction')}</Label>
          <Select value={direction || 'all'} onValueChange={(v) => reset(setDirection)(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-28" aria-label="Direction">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('daybook.all')}</SelectItem>
              <SelectItem value="IN">{t('daybook.col_in')}</SelectItem>
              <SelectItem value="OUT">{t('daybook.col_out')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>{t('daybook.col_source')}</Label>
          <Select value={source || 'all'} onValueChange={(v) => reset(setSource)(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-44" aria-label="Source"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('daybook.all_sources')}</SelectItem>
              {LEDGER_SOURCES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {isMoney && (
          <div className="space-y-1.5">
            <Label>{t('daybook.col_account')}</Label>
            <Select value={holder || 'all'} onValueChange={(v) => reset(setHolder)(v === 'all' ? '' : v)}>
              <SelectTrigger className="w-48" aria-label="Account"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('daybook.all_accounts')}</SelectItem>
                <SelectItem value="0">{t('daybook.shop_cash')}</SelectItem>
                {banks?.map((b) => <SelectItem key={b.id} value={String(b.id)}>{b.bankName} · {b.accountNo}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        {isMetal && (
          <div className="space-y-1.5">
            <Label>{t('daybook.col_type')}</Label>
            <Select value={metalForm || 'all'} onValueChange={(v) => reset(setMetalForm)(v === 'all' ? '' : v)}>
              <SelectTrigger className="w-32" aria-label="Metal type"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('daybook.all')}</SelectItem>
                {METAL_FORMS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="ml-auto rounded-full bg-brand/15 px-4 py-2 text-sm text-muted-foreground">
          {t('daybook.opening')} <span className="font-bold text-foreground tabular-nums">{data?.opening ?? '—'} {unit(asset)}</span>
        </div>
      </Card>

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        isLoading={isLoading}
        emptyText={t('daybook.no_rows')}
        pagination={data ? { page: data.page, pageSize: data.pageSize, total: data.total, onPage: setPage, onPageSize: setPageSize } : undefined}
      />
    </div>
  )
}
