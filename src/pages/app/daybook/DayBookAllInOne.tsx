import type { ColumnDef } from '@tanstack/react-table'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { CsvExportButton } from '@/components/CsvExportButton'
import { DataTable } from '@/components/DataTable'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useDayBookAllInOne } from '@/lib/accountsQueries'
import { useSettings } from '@/lib/appQueries'
import { sourceHref, sourceLabel } from '@/lib/sourceLinks'
import { useT } from '@/lib/i18n'
import { fetchAllPaged } from '@/lib/queries'
import { LEDGER_ASSETS, LEDGER_SOURCES, businessDayISO, type DayBookAllInOneRowDto } from '@/shared'

import { dayBookPrefs, shownAssets } from './dayBookPrefs'

const today = businessDayISO
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/
const amt = (s: string) => (Number(s) ? Number(s).toLocaleString('en-IN') : '—')
const date = (s: string) => new Date(s).toLocaleDateString('en-IN')
const time = (s?: string) => (s ? new Date(s).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '')
const METALS = ['GOLD', 'SILVER'] as const

/** "USUAL · 22K, 18K" under a metal cell (forms then karats), or null when the document moved none. */
function metalTypes(r: DayBookAllInOneRowDto, a: (typeof METALS)[number]): string | null {
  const m = r.metal?.[a]
  if (!m || (!m.forms.length && !m.karats.length)) return null
  return [m.forms.join(', '), m.karats.join(', ')].filter(Boolean).join(' · ')
}

export function DayBookAllInOne() {
  const t = useT()
  const [params] = useSearchParams()
  const initial = (k: 'from' | 'to') => { const v = params.get(k); return v && ISO_DAY.test(v) ? v : today() }
  const [from, setFrom] = useState(() => initial('from'))
  const [to, setTo] = useState(() => initial('to'))
  // SET-08: source filter and page size start from the saved Day Book prefs until the user changes them here
  const prefs = dayBookPrefs(useSettings().data)
  const [sourcePick, setSource] = useState<string | null>(null)
  const source = sourcePick ?? prefs.defaultSource ?? ''
  const [page, setPage] = useState(1)
  const [sizePick, setPageSize] = useState<number | null>(null)
  const pageSize = sizePick ?? prefs.pageSize
  const [detail, setDetail] = useState<DayBookAllInOneRowDto | null>(null)
  const filters = { from, to, source: source || undefined }
  const { data, isLoading } = useDayBookAllInOne({ ...filters, page, pageSize })
  const exportRows = async () => {
    const all = await fetchAllPaged<DayBookAllInOneRowDto>('/app/day-book/all-in-one', filters)
    return [
      ['Date', 'Time', 'Source', 'Ref', 'Party', ...LEDGER_ASSETS.flatMap((a) => [`${a} in`, `${a} out`]), 'Cash in', 'Cash out', 'Bank in', 'Bank out', 'Gold type', 'Silver type', 'Money balance', 'Gold balance', 'Silver balance'],
      ...all.map((r) => [
        date(r.txnDate), time(r.createdAt), r.source, r.sourceId, r.party?.name, ...LEDGER_ASSETS.flatMap((a) => [r.assets[a].in, r.assets[a].out]),
        r.money?.cashIn, r.money?.cashOut, r.money?.bankIn, r.money?.bankOut, metalTypes(r, 'GOLD'), metalTypes(r, 'SILVER'),
        r.balance?.MONEY, r.balance?.GOLD, r.balance?.SILVER,
      ]),
    ]
  }

  const sourceCell = (r: DayBookAllInOneRowDto) => {
    const href = sourceHref(r.source, r.sourceId)
    const label = `${sourceLabel(t, r.source)} #${r.sourceId}`
    return href ? <Link to={href} className="font-medium text-brand-strong hover:underline">{label}</Link> : label
  }
  const inOut = (v: { in: string; out: string }) => (
    <>
      <span className="text-green-600 dark:text-green-500">{amt(v.in)}</span>
      <span className="mx-1 text-muted-foreground">/</span>
      <span className="text-destructive">{amt(v.out)}</span>
    </>
  )

  const columns: ColumnDef<DayBookAllInOneRowDto, unknown>[] = [
    { id: 'sn', header: '#', cell: ({ row }) => <span className="text-muted-foreground tabular-nums">{(page - 1) * pageSize + row.index + 1}</span> },
    {
      id: 'date', header: t('udhari.date'),
      cell: ({ row }) => <div className="whitespace-nowrap">{date(row.original.txnDate)}<div className="text-xs text-muted-foreground tabular-nums">{time(row.original.createdAt)}</div></div>,
    },
    { id: 'source', header: t('daybook.col_source'), cell: ({ row }) => <span className="whitespace-nowrap text-sm">{sourceCell(row.original)}</span> },
    { id: 'party', header: t('udhari.party'), cell: ({ row }) => <span className="text-sm">{row.original.party?.name ?? '—'}</span> },
    ...shownAssets(prefs).map((a): ColumnDef<DayBookAllInOneRowDto, unknown> => ({
      id: a,
      header: t('daybook.asset_in_out', { asset: a }),
      cell: ({ row }) => {
        const r = row.original
        const m = r.money
        const sub = a === 'MONEY'
          ? m && (Number(m.cashIn) || Number(m.cashOut) || Number(m.bankIn) || Number(m.bankOut))
            ? [Number(m.cashIn) || Number(m.cashOut) ? `${t('db98.cash')} ${amt(m.cashIn)}/${amt(m.cashOut)}` : '', Number(m.bankIn) || Number(m.bankOut) ? `${t('db98.bank')} ${amt(m.bankIn)}/${amt(m.bankOut)}` : ''].filter(Boolean).join(' · ')
            : null
          : a === 'GOLD' || a === 'SILVER' ? metalTypes(r, a) : null
        return (
          <div className="whitespace-nowrap text-right tabular-nums">
            {inOut(r.assets[a])}
            {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
          </div>
        )
      },
    })),
    ...(prefs.showRunningBalance ? [{
      id: 'balance', header: t('db98.running_bal'),
      cell: ({ row }) => {
        const b = row.original.balance
        if (!b) return '—'
        return (
          <div className="whitespace-nowrap text-right tabular-nums">
            <span className="font-medium">₹{Number(b.MONEY).toLocaleString('en-IN')}</span>
            {(Number(b.GOLD) || Number(b.SILVER)) ? <div className="text-xs text-muted-foreground">{t('db98.gold_short')} {b.GOLD}g · {t('db98.silver_short')} {b.SILVER}g</div> : null}
          </div>
        )
      },
    } satisfies ColumnDef<DayBookAllInOneRowDto, unknown>] : []),
    { id: 'actions', header: '', cell: ({ row }) => <Button variant="ghost" size="sm" onClick={() => setDetail(row.original)}>{t('daybook.details')}</Button> },
  ]

  return (
    <div className="space-y-6">
      <Card className="flex flex-wrap items-end gap-4 p-4">
        <div className="space-y-1.5"><Label htmlFor="aio-from">{t('common.from')}</Label><Input id="aio-from" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1) }} /></div>
        <div className="space-y-1.5"><Label htmlFor="aio-to">{t('common.to')}</Label><Input id="aio-to" type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1) }} /></div>
        <div className="space-y-1.5">
          <Label>{t('daybook.col_source')}</Label>
          <Select value={source || 'all'} onValueChange={(v) => { setSource(v === 'all' ? '' : v); setPage(1) }}>
            <SelectTrigger className="w-full sm:w-48" aria-label="Source"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('daybook.all_sources')}</SelectItem>
              {LEDGER_SOURCES.map((s) => <SelectItem key={s} value={s}>{sourceLabel(t, s)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <CsvExportButton className="ml-auto" filename={`day-book-${from}-${to}.csv`} rows={exportRows} />
      </Card>

      <div className="overflow-x-auto">
        <DataTable
          columns={columns}
          data={data?.items ?? []}
          isLoading={isLoading}
          emptyText={t('dash.no_activity')}
          pagination={data ? { page: data.page, pageSize: data.pageSize, total: data.total, onPage: setPage, onPageSize: setPageSize } : undefined}
        />
      </div>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('daybook.txn_details')}</DialogTitle></DialogHeader>
          {detail && (
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm tabular-nums">
              {([
                [t('udhari.date'), `${date(detail.txnDate)} ${time(detail.createdAt)}`.trim()],
                [t('daybook.col_source'), `${sourceLabel(t, detail.source)} #${detail.sourceId}`],
                [t('udhari.party'), detail.party?.name],
                [t('daybook.col_item_narration'), detail.narration],
              ] as [string, string | null | undefined][]).filter(([, v]) => v != null && v !== '').map(([k, v]) => (
                <div key={k} className="contents"><dt className="text-muted-foreground">{k}</dt><dd className="font-medium">{v}</dd></div>
              ))}
              {LEDGER_ASSETS.filter((a) => Number(detail.assets[a].in) || Number(detail.assets[a].out)).map((a) => (
                <div key={a} className="contents">
                  <dt className="text-muted-foreground">{t('daybook.asset_in_out', { asset: a })}</dt>
                  <dd className="font-medium">
                    {inOut(detail.assets[a])}
                    {(a === 'GOLD' || a === 'SILVER') && metalTypes(detail, a) && <span className="ml-2 text-xs text-muted-foreground">{metalTypes(detail, a)}</span>}
                  </dd>
                </div>
              ))}
              {detail.money && (Number(detail.money.cashIn) || Number(detail.money.cashOut)) ? (
                <div className="contents"><dt className="text-muted-foreground">{t('db98.cash')}</dt><dd className="font-medium">{inOut({ in: detail.money.cashIn, out: detail.money.cashOut })}</dd></div>
              ) : null}
              {detail.money && (Number(detail.money.bankIn) || Number(detail.money.bankOut)) ? (
                <div className="contents"><dt className="text-muted-foreground">{t('db98.bank')}</dt><dd className="font-medium">{inOut({ in: detail.money.bankIn, out: detail.money.bankOut })}</dd></div>
              ) : null}
              {detail.balance && (
                <div className="contents">
                  <dt className="text-muted-foreground">{t('db98.running_bal')}</dt>
                  <dd className="font-medium">₹{Number(detail.balance.MONEY).toLocaleString('en-IN')} · {t('db98.gold_short')} {detail.balance.GOLD}g · {t('db98.silver_short')} {detail.balance.SILVER}g</dd>
                </div>
              )}
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
