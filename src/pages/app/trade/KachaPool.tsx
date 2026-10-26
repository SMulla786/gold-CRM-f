import { ArrowDownToLine, ArrowUpFromLine, Coins, Flame, Recycle, Scale, TrendingDown, type LucideIcon } from 'lucide-react'
import { useState } from 'react'

import { MpinDialog } from '@/components/MpinDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAuth } from '@/lib/auth'
import { useT } from '@/lib/i18n'
import { useKachaBalance, useKachaList, useRevertKacha } from '@/lib/tradeQueries'
import { METALS } from '@/shared'

import { ProcessKachaDialog } from './ProcessKachaDialog'

const date = (s: string) => new Date(s).toLocaleDateString('en-IN')
const n = (s: string) => Number(s) || 0

export function KachaPool() {
  const t = useT()
  const { can } = useAuth()
  const canEdit = can('exchange.entry', 'edit')
  const [metal, setMetal] = useState('GOLD')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  // Melt / Refine view and metal ('' = All) are server-side filters.
  const [view, setView] = useState<'' | 'MELT' | 'REFINE'>('')
  const { data: bal } = useKachaBalance(metal)
  const { data: list, isLoading } = useKachaList({ metal: metal || undefined, type: view || undefined, page, pageSize })
  const rows = list?.items ?? []
  const revert = useRevertKacha()
  const [processing, setProcessing] = useState(false)
  const [reverting, setReverting] = useState<number | null>(null)
  const pageCount = list ? Math.max(1, Math.ceil(list.total / list.pageSize)) : 1

  // Summary numbers derived from the list already fetched (no extra requests).
  const activeRows = rows.filter((p) => !p.reverted)
  const sumOf = (pick: (p: (typeof rows)[number]) => string) => activeRows.reduce((sum, p) => sum + n(pick(p)), 0)
  const lossOnPage = sumOf((p) => p.difference)
  const inOnPage = sumOf((p) => p.inFine)
  const outOnPage = sumOf((p) => p.outFine)
  const ravalOnPage = sumOf((p) => p.ravalFine)
  const scope = view ? t('trade.kacha.scope_type', { type: view === 'MELT' ? t('trade.kacha.melt') : t('trade.kacha.refine') }) : t('trade.kacha.scope_active')
  // All metals: one figure per metal, never summed across gold and silver.
  const balOf = (m: string) => bal?.byMetal?.find((b) => b.metal === m)
  const poolCard = (form: 'kachaFine' | 'bullionFine') => metal
    ? `${bal?.[form] ?? '—'} g`
    : `${balOf('GOLD')?.[form] ?? '—'} / ${balOf('SILVER')?.[form] ?? '—'} g`

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl">{t('trade.kacha.title')}</h2>
          <p className="text-sm text-muted-foreground">{t('trade.kacha.subtitle')}</p>
        </div>
        {canEdit && <Button onClick={() => setProcessing(true)}>{t('trade.kacha.melt_refine')}</Button>}
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 pt-6">
          <Select value={metal || 'all'} onValueChange={(v) => { setMetal(v === 'all' ? '' : v); setPage(1) }}>
            <SelectTrigger className="w-32" aria-label="Metal"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">{t('trade.all_metals')}</SelectItem>{METALS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={view || 'all'} onValueChange={(v) => { setView(v === 'MELT' || v === 'REFINE' ? v : ''); setPage(1) }}>
            <SelectTrigger className="w-40" aria-label="Process type"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">{t('trade.kacha.all_processes')}</SelectItem><SelectItem value="MELT">{t('trade.kacha.melt')}</SelectItem><SelectItem value="REFINE">{t('trade.kacha.refine')}</SelectItem></SelectContent>
          </Select>
        </CardContent>
      </Card>

      <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tile(t('trade.kacha.tile_kacha', { metal: metal || 'GOLD / SILVER' }), poolCard('kachaFine'), t('trade.kacha.tile_kacha_sub'), Recycle)}
        {tile(t('trade.kacha.tile_bullion', { metal: metal || 'GOLD / SILVER' }), poolCard('bullionFine'), t('trade.kacha.tile_bullion_sub'), Coins)}
        {tile(t('trade.kacha.tile_entries'), list ? String(list.total) : '—', list ? t('trade.kacha.tile_active', { n: activeRows.length }) : undefined, Flame)}
        {tile(t('trade.kacha.tile_loss'), list ? `${lossOnPage.toFixed(3)} g` : '—', t('trade.kacha.tile_loss_sub'), TrendingDown)}
      </div>

      <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tile(t('trade.kacha.tile_deduct'), list ? `${inOnPage.toFixed(3)} g` : '—', t('trade.kacha.fine_in', { scope }), ArrowDownToLine)}
        {tile(t('trade.kacha.tile_add'), list ? `${outOnPage.toFixed(3)} g` : '—', t('trade.kacha.fine_out', { scope }), ArrowUpFromLine)}
        {tile(t('trade.kacha.tile_diff'), list ? `${(inOnPage - outOnPage).toFixed(3)} g` : '—', t('trade.kacha.tile_diff_sub'), Scale)}
        {tile(t('trade.kacha.tile_raval'), list ? `${ravalOnPage.toFixed(3)} / ${lossOnPage.toFixed(3)} g` : '—', scope, TrendingDown)}
      </div>

      <section className="space-y-3">
        <h2 className="text-xl">{t('trade.kacha.history')}</h2>
        <Card className="overflow-x-auto p-2">
          <Table>
            <TableHeader><TableRow><TableHead>{t('udhari.date')}</TableHead><TableHead>{t('bill.type')}</TableHead><TableHead>{t('src.EXCHANGE')}</TableHead><TableHead>{t('udhari.col_in')}</TableHead><TableHead>{t('udhari.col_out')}</TableHead><TableHead>{t('trade.kacha.col_raval')}</TableHead><TableHead>{t('trade.kacha.col_loss')}</TableHead><TableHead>{t('stock.col_status')}</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {isLoading ? <TableRow><TableCell colSpan={9} className="h-16 text-center text-muted-foreground">{t('common.loading')}</TableCell></TableRow>
                : rows.length ? rows.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{date(p.txnDate)}</TableCell><TableCell>{p.type}{!metal && <span className="block text-xs text-muted-foreground">{p.metal}</span>}</TableCell>
                    <TableCell className="text-muted-foreground">{p.exchange ? `#${p.exchange.exchangeNo}` : t('trade.kacha.pool')}</TableCell>
                    <TableCell className="tabular-nums">{p.inFine}</TableCell><TableCell className="tabular-nums">{p.outFine}</TableCell><TableCell className="tabular-nums">{p.ravalFine}</TableCell><TableCell className="tabular-nums">{p.difference}</TableCell>
                    <TableCell>{p.reverted ? <Badge variant="secondary">{t('trade.kacha.reverted')}</Badge> : <Badge>{t('trade.kacha.done')}</Badge>}</TableCell>
                    <TableCell>{canEdit && !p.reverted && <Button variant="ghost" size="sm" onClick={() => setReverting(p.id)}>{t('trade.kacha.revert')}</Button>}</TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={9} className="h-32 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <span className="icon-chip"><Flame className="size-5" aria-hidden /></span>
                        <span>{t('trade.kacha.empty')}</span>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
            </TableBody>
          </Table>
        </Card>
        {list && list.total > 10 && (
          <div className="flex flex-wrap items-center justify-end gap-2 text-sm">
            <label className="mr-auto flex items-center gap-2 text-muted-foreground">
              {t('table.entries')}
              <select className="h-8 rounded-lg border bg-card px-2 text-foreground" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }}>
                {[10, 20, 50, 100].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <span className="text-muted-foreground">{t('dash.page_entries', { page: list.page, pages: pageCount, total: list.total })}</span>
            {list.total > list.pageSize && <>
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>{t('table.previous')}</Button>
              <Button variant="outline" size="sm" disabled={page >= pageCount} onClick={() => setPage((p) => p + 1)}>{t('table.next')}</Button>
            </>}
          </div>
        )}
      </section>

      {processing && <ProcessKachaDialog metal={metal || 'GOLD'} onClose={() => setProcessing(false)} />}
      <MpinDialog open={reverting != null} title={t('trade.kacha.revert_title')} onConfirm={(mpin) => revert.mutateAsync({ id: reverting!, mpin })} onClose={() => setReverting(null)} />
    </div>
  )
}
