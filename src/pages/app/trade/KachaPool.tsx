import { ArrowDownToLine, ArrowUpFromLine, Coins, Flame, Recycle, Scale, TrendingDown, type LucideIcon } from 'lucide-react'
import { useState } from 'react'

import { MpinDialog } from '@/components/MpinDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAuth } from '@/lib/auth'
import { useKachaBalance, useKachaList, useRevertKacha } from '@/lib/tradeQueries'
import { METALS } from '@/shared'

import { ProcessKachaDialog } from './ProcessKachaDialog'

const date = (s: string) => new Date(s).toLocaleDateString('en-IN')
const n = (s: string) => Number(s) || 0

export function KachaPool() {
  const { can } = useAuth()
  const canEdit = can('exchange.entry', 'edit')
  const [metal, setMetal] = useState('GOLD')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  // The list endpoint has no type filter, so the Melt / Refine view narrows the fetched page.
  const [view, setView] = useState<'' | 'MELT' | 'REFINE'>('')
  const { data: bal } = useKachaBalance(metal)
  const { data: list, isLoading } = useKachaList({ metal, page, pageSize })
  const rows = (list?.items ?? []).filter((p) => !view || p.type === view)
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
  const scope = view ? `${view === 'MELT' ? 'Melt' : 'Refine'} entries on this page` : 'Active entries on this page'

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
          <h2 className="text-xl">Kacha pool</h2>
          <p className="text-sm text-muted-foreground">Old metal bought in, and the bullion it becomes after processing.</p>
        </div>
        {canEdit && <Button onClick={() => setProcessing(true)}>Melt / Refine</Button>}
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 pt-6">
          <Select value={metal} onValueChange={(v) => { setMetal(v); setPage(1) }}>
            <SelectTrigger className="w-32" aria-label="Metal"><SelectValue /></SelectTrigger>
            <SelectContent>{METALS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={view || 'all'} onValueChange={(v) => setView(v === 'MELT' || v === 'REFINE' ? v : '')}>
            <SelectTrigger className="w-40" aria-label="Process type"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All processes</SelectItem><SelectItem value="MELT">Melt</SelectItem><SelectItem value="REFINE">Refine</SelectItem></SelectContent>
          </Select>
          {view && <p className="w-full text-xs text-muted-foreground">The type view narrows the entries on this page; paging still counts every entry.</p>}
        </CardContent>
      </Card>

      <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tile(`Kacha (unprocessed) ${metal}`, `${bal?.kachaFine ?? '—'} g`, 'Fine grams awaiting processing', Recycle)}
        {tile(`Bullion (refined) ${metal}`, `${bal?.bullionFine ?? '—'} g`, 'Fine grams after processing', Coins)}
        {tile('Processing entries', list ? String(list.total) : '—', list ? `${activeRows.length} active on this page` : undefined, Flame)}
        {tile('Loss on this page', list ? `${lossOnPage.toFixed(3)} g` : '—', 'Excludes reverted entries', TrendingDown)}
      </div>

      <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tile('Kacha stock deduction', list ? `${inOnPage.toFixed(3)} g` : '—', `Fine in · ${scope}`, ArrowDownToLine)}
        {tile('Bullion stock addition', list ? `${outOnPage.toFixed(3)} g` : '—', `Fine out · ${scope}`, ArrowUpFromLine)}
        {tile('Difference (in − out)', list ? `${(inOnPage - outOnPage).toFixed(3)} g` : '—', 'Raval kept as kacha plus loss', Scale)}
        {tile('Raval / loss', list ? `${ravalOnPage.toFixed(3)} / ${lossOnPage.toFixed(3)} g` : '—', scope, TrendingDown)}
      </div>

      <section className="space-y-3">
        <h2 className="text-xl">Processing history</h2>
        <Card className="overflow-x-auto p-2">
          <Table>
            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Exchange</TableHead><TableHead>In</TableHead><TableHead>Out</TableHead><TableHead>Raval</TableHead><TableHead>Loss</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {isLoading ? <TableRow><TableCell colSpan={9} className="h-16 text-center text-muted-foreground">Loading…</TableCell></TableRow>
                : rows.length ? rows.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{date(p.txnDate)}</TableCell><TableCell>{p.type}</TableCell>
                    <TableCell className="text-muted-foreground">{p.exchange ? `#${p.exchange.exchangeNo}` : 'Pool'}</TableCell>
                    <TableCell className="tabular-nums">{p.inFine}</TableCell><TableCell className="tabular-nums">{p.outFine}</TableCell><TableCell className="tabular-nums">{p.ravalFine}</TableCell><TableCell className="tabular-nums">{p.difference}</TableCell>
                    <TableCell>{p.reverted ? <Badge variant="secondary">Reverted</Badge> : <Badge>Done</Badge>}</TableCell>
                    <TableCell>{canEdit && !p.reverted && <Button variant="ghost" size="sm" onClick={() => setReverting(p.id)}>Revert</Button>}</TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={9} className="h-32 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <span className="icon-chip"><Flame className="size-5" aria-hidden /></span>
                        <span>No processing yet</span>
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
              Entries
              <select className="h-8 rounded-lg border bg-card px-2 text-foreground" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }}>
                {[10, 20, 50, 100].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <span className="text-muted-foreground">Page {list.page} of {pageCount} · {list.total} entries</span>
            {list.total > list.pageSize && <>
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <Button variant="outline" size="sm" disabled={page >= pageCount} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </>}
          </div>
        )}
      </section>

      {processing && <ProcessKachaDialog metal={metal} onClose={() => setProcessing(false)} />}
      <MpinDialog open={reverting != null} title="Revert this process" onConfirm={(mpin) => revert.mutateAsync({ id: reverting!, mpin })} onClose={() => setReverting(null)} />
    </div>
  )
}
