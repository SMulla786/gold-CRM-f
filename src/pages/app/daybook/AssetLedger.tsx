import type { ColumnDef } from '@tanstack/react-table'
import { Search } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { CsvExportButton } from '@/components/CsvExportButton'
import { DataTable } from '@/components/DataTable'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useLedger } from '@/lib/accountsQueries'
import { useBankAccounts } from '@/lib/appQueries'
import { useT } from '@/lib/i18n'
import { fetchAllPaged } from '@/lib/queries'
import { sourceHref, sourceLabel } from '@/lib/sourceLinks'
import { businessDayISO, LEDGER_ASSETS, LEDGER_SOURCES, type LedgerRowDto } from '@/shared'

const today = businessDayISO
const unit = (asset: string) => (asset === 'MONEY' ? '₹' : asset === 'GOLD' || asset === 'SILVER' ? 'g' : 'pcs')
// Main metric shown per asset: money amount / metal fine / pcs for the rest.
const metric = (asset: string, r: LedgerRowDto) => (asset === 'MONEY' ? r.amount : asset === 'GOLD' || asset === 'SILVER' ? r.fine : r.pcs != null ? String(r.pcs) : null) ?? '—'
const date = (s: string) => new Date(s).toLocaleDateString('en-IN')
const time = (s: string) => new Date(s).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
const METAL_FORMS = ['USUAL', 'BULLION', 'KACHA'] as const
// TASK-98: Type for stone / artificial / franchise rows — metal form when posted, else the stock item's group / name.
const rowType = (r: LedgerRowDto) => r.metalForm ?? ([r.item?.group, r.item?.name].filter(Boolean).join(' / ') || null)

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
  const [detail, setDetail] = useState<LedgerRowDto | null>(null)
  const filters = {
    asset, from, to, direction: direction || undefined, source: source || undefined, q: q || undefined,
    bankAccountId: isMoney && holder !== '' ? holder : undefined, metalForm: isMetal ? metalForm || undefined : undefined,
  }
  const { data, isLoading } = useLedger({ ...filters, page, pageSize })
  const exportRows = async () => {
    const all = await fetchAllPaged<LedgerRowDto>('/app/ledgers', filters)
    return [
      ['Date', 'Time', 'Source', 'Ref', 'Dir', 'Party', 'Item / Narration', 'Account', 'Type', 'Karat', 'Gross', 'Net', 'Fine', 'Pcs', 'Amount', 'Balance', 'By'],
      ...all.map((r) => [date(r.txnDate), time(r.createdAt), r.source, r.sourceId, r.direction, r.party?.name, r.item?.label ?? r.narration, r.bankAccount?.name, isMoney || isMetal ? r.metalForm : rowType(r), r.karatCode, r.gross, r.net, r.fine, r.pcs, r.amount, r.balance, r.entryBy]),
    ]
  }
  const reset = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPage(1) }

  if (!valid) return <p className="text-sm text-muted-foreground">{t('daybook.unknown_ledger')}</p>

  const columns: ColumnDef<LedgerRowDto, unknown>[] = [
    { id: 'sn', header: '#', cell: ({ row }) => <span className="text-muted-foreground tabular-nums">{(page - 1) * pageSize + row.index + 1}</span> },
    { accessorKey: 'txnDate', header: t('udhari.date'), cell: ({ row }) => <div className="whitespace-nowrap">{date(row.original.txnDate)}<div className="text-xs text-muted-foreground tabular-nums">{time(row.original.createdAt)}</div></div> },
    { accessorKey: 'source', header: t('daybook.col_source'), cell: ({ row }) => sourceLabel(t, row.original.source) },
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
    ...(!isMoney && !isMetal ? [{ header: t('daybook.col_type'), cell: ({ row }: { row: { original: LedgerRowDto } }) => rowType(row.original) ?? '—' }] : []),
    { header: unit(asset), cell: ({ row }) => <span className={row.original.reversed ? 'text-muted-foreground line-through' : ''}>{metric(asset, row.original)}</span> },
    ...(!isMoney && !isMetal ? [{ header: t('daybook.col_total_cost'), cell: ({ row }: { row: { original: LedgerRowDto } }) => (Number(row.original.amount) ? `₹${row.original.amount}` : '—') }] : []),
    { accessorKey: 'balance', header: t('bill.balance'), cell: ({ row }) => <span className="font-medium">{row.original.balance}</span> },
    { accessorKey: 'entryBy', header: t('dash.col_by'), cell: ({ row }) => row.original.entryBy ?? '—' },
    { id: 'actions', header: '', cell: ({ row }) => <Button variant="ghost" size="sm" onClick={() => setDetail(row.original)}>{t('daybook.details')}</Button> },
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
              {LEDGER_SOURCES.map((s) => <SelectItem key={s} value={s}>{sourceLabel(t, s)}</SelectItem>)}
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
        <div className="ml-auto flex flex-wrap items-center gap-3">
          <div className="rounded-full bg-brand/15 px-4 py-2 text-sm text-muted-foreground">
            {t('daybook.opening')} <span className="font-bold text-foreground tabular-nums">{data?.opening ?? '—'} {unit(asset)}</span>
          </div>
          <CsvExportButton filename={`${asset.toLowerCase()}-ledger-${from}-${to}.csv`} rows={exportRows} />
        </div>
      </Card>

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        isLoading={isLoading}
        emptyText={t('daybook.no_rows')}
        pagination={data ? { page: data.page, pageSize: data.pageSize, total: data.total, onPage: setPage, onPageSize: setPageSize } : undefined}
      />

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('daybook.txn_details')}</DialogTitle></DialogHeader>
          {detail && (
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm tabular-nums">
              {([
                [t('udhari.date'), `${date(detail.txnDate)} ${time(detail.createdAt)}`],
                [t('daybook.col_source'), `${sourceLabel(t, detail.source)} #${detail.sourceId}`],
                [t('daybook.col_dir'), detail.direction],
                [t('dash.branch'), detail.branch.name],
                [t('udhari.party'), detail.party?.name],
                [t('daybook.col_item_narration'), detail.item?.label ?? detail.narration],
                [t('daybook.col_account'), isMoney ? detail.bankAccount?.name ?? t('daybook.shop_cash') : null],
                [t('daybook.col_type'), isMoney || isMetal ? detail.metalForm : rowType(detail)],
                [t('stock.col_karat'), detail.karatCode],
                [t('stock.col_gross'), detail.gross],
                [t('stock.col_net'), detail.net],
                [t('stock.col_fine'), detail.fine],
                [t('stock.col_pcs'), detail.pcs],
                ['₹', detail.amount],
                [t('bill.balance'), `${detail.balance} ${unit(asset)}`],
                [t('dash.col_by'), detail.entryBy],
              ] as [string, string | number | null | undefined][]).filter(([, v]) => v != null && v !== '').map(([k, v]) => (
                <div key={k} className="contents"><dt className="text-muted-foreground">{k}</dt><dd className="font-medium">{v}</dd></div>
              ))}
              {(detail.isReversal || detail.reversed) && <dd className="col-span-2 text-destructive">{detail.isReversal ? t('daybook.is_reversal') : t('daybook.was_reversed')}</dd>}
            </dl>
          )}
          {detail && sourceHref(detail.source, detail.sourceId) && (
            <Button asChild variant="outline"><Link to={sourceHref(detail.source, detail.sourceId)!}>{t('daybook.open_document')}</Link></Button>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
