import { useState } from 'react'

import { TableCard } from '@/components/SectionCard'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useDayBookAllInOne } from '@/lib/accountsQueries'
import { useT } from '@/lib/i18n'
import { LEDGER_ASSETS, LEDGER_SOURCES, businessDayISO } from '@/shared'

const today = businessDayISO
const amt = (s: string) => (Number(s) ? Number(s).toLocaleString('en-IN') : '—')

export function DayBookAllInOne() {
  const t = useT()
  const [from, setFrom] = useState(today())
  const [to, setTo] = useState(today())
  const [source, setSource] = useState('')
  const [page, setPage] = useState(1)
  const { data, isLoading } = useDayBookAllInOne({ from, to, source: source || undefined, page })

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
              {LEDGER_SOURCES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </Card>

      <TableCard>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('udhari.date')}</TableHead><TableHead>{t('daybook.col_source')}</TableHead><TableHead>{t('udhari.party')}</TableHead>
              {LEDGER_ASSETS.map((a) => <TableHead key={a} className="text-right">{t('daybook.asset_in_out', { asset: a })}</TableHead>)}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={3 + LEDGER_ASSETS.length} className="h-16 text-center text-muted-foreground">{t('common.loading')}</TableCell></TableRow>
              : data?.items.length ? data.items.map((r, i) => (
                <TableRow key={`${r.source}-${r.sourceId}-${i}`}>
                  <TableCell className="whitespace-nowrap">{new Date(r.txnDate).toLocaleDateString('en-IN')}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm">{r.source}</TableCell>
                  <TableCell className="text-sm">{r.party?.name ?? '—'}</TableCell>
                  {LEDGER_ASSETS.map((a) => (
                    <TableCell key={a} className="whitespace-nowrap text-right tabular-nums">
                      <span className="text-green-600 dark:text-green-500">{amt(r.assets[a].in)}</span>
                      <span className="mx-1 text-muted-foreground">/</span>
                      <span className="text-destructive">{amt(r.assets[a].out)}</span>
                    </TableCell>
                  ))}
                </TableRow>
              )) : <TableRow><TableCell colSpan={3 + LEDGER_ASSETS.length} className="h-16 text-center text-muted-foreground">{t('dash.no_activity')}</TableCell></TableRow>}
          </TableBody>
        </Table>
      {data && data.total > data.pageSize && (
        <div className="flex items-center justify-end gap-2 border-t bg-muted/40 px-6 py-3 text-sm">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>{t('table.previous')}</Button>
          <span>{t('daybook.page', { n: data.page })}</span>
          <Button variant="outline" size="sm" disabled={page * data.pageSize >= data.total} onClick={() => setPage((p) => p + 1)}>{t('table.next')}</Button>
        </div>
      )}
      </TableCard>
    </div>
  )
}
