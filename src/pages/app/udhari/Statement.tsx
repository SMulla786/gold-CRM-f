import { FileDown, Printer } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useT } from '@/lib/i18n'
import { usePartyStatement } from '@/lib/udhariQueries'
import { downloadPdf } from '@/lib/share'
import { WhatsAppShareDialog, type ShareSize } from '@/components/WhatsAppShareDialog'
import { sourceHref } from '@/lib/sourceLinks'
import { cn } from '@/lib/utils'
import type { BalanceDto } from '@/shared'

const date = (s: string) => new Date(s).toLocaleDateString('en-IN')
const triple = (b: BalanceDto) => `₹${b.amount}${Number(b.gold) ? ` · ${b.gold}g Au` : ''}${Number(b.silver) ? ` · ${b.silver}g Ag` : ''}`

export function Statement() {
  const t = useT()
  const { partyId } = useParams()
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [thermal, setThermal] = useState(false) // Mini 80 mm: date, ref, ₹, balance only
  const { data, isLoading } = usePartyStatement(Number(partyId), { from: from || undefined, to: to || undefined })
  const [sharing, setSharing] = useState(false)
  // WhatsApp message stays English (share template). A4 = opening, every row, closing; Mini = closing only.
  const shareText = (size: ShareSize) => {
    if (!data) return ''
    const period = from || to ? ` (${from ? date(from) : '…'} to ${to ? date(to) : 'today'})` : ''
    if (size === 'MINI') return `${data.party.name}\nAccount statement${period}\nClosing: ${triple(data.closing)}`
    const lines = data.rows.map((r) => `${date(r.txnDate)} ${r.reference}: ${Number(r.amount) ? `₹${r.amount}` : ''}${Number(r.gold) ? ` ${r.gold}g Au` : ''}${Number(r.silver) ? ` ${r.silver}g Ag` : ''}${r.isReversal ? ' (reversed)' : ''} → ${triple(r.balance)}`)
    return [`${data.party.name}`, `Account statement${period}`, `Opening: ${triple(data.opening)}`, ...lines, `Closing: ${triple(data.closing)}`].join('\n')
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 print:hidden">
        <div className="space-y-1">
          <Link to="/app/udhari/ledger" className="text-sm font-medium text-brand-strong hover:underline">{t('udhari.back_ledger')}</Link>
          <p className="text-sm text-muted-foreground">{t('udhari.statement_intro')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* WhatsApp message stays English (share template) */}
          <Button variant="outline" disabled={!data} onClick={() => setSharing(true)}>{t('udhari.share')}</Button>
          <Select value={thermal ? 'THERMAL_80' : 'A4'} onValueChange={(v) => setThermal(v === 'THERMAL_80')}>
            <SelectTrigger className="w-40" aria-label="Print layout"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="A4">A4</SelectItem>
              <SelectItem value="THERMAL_80">{t('bill.thermal_80')}</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={downloadPdf}><FileDown aria-hidden />{t('udhari.download_pdf')}</Button>
          <Button onClick={() => window.print()}><Printer aria-hidden />{t('udhari.print')}</Button>
        </div>
      </div>

      <Card className="flex w-fit flex-wrap items-end gap-4 p-4 print:hidden">
        <div className="space-y-1.5"><Label htmlFor="s-from">{t('common.from')}</Label><Input id="s-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div className="space-y-1.5"><Label htmlFor="s-to">{t('common.to')}</Label><Input id="s-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
      </Card>

      {isLoading || !data ? (
        <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
      ) : (
        <div className={cn('print-area space-y-4 rounded-3xl border border-white/80 bg-card p-6 shadow-sm sm:p-10 dark:border-border print:rounded-none print:border-0 print:bg-transparent print:shadow-none', thermal && 'print-thermal mx-auto max-w-sm')}>
          <div>
            <h2 className="text-xl font-bold">{data.party.name}</h2>
            <p className="text-sm text-muted-foreground">{data.party.mobile} · {t('udhari.stmt_sign_hint')}</p>
          </div>
          <div className="flex justify-between rounded-2xl bg-muted/50 px-4 py-3 text-sm print:rounded-none print:bg-transparent print:px-0"><span className="text-muted-foreground">{t('udhari.opening')}</span><span className="font-semibold">{triple(data.opening)}</span></div>
          <div className="overflow-x-auto print:overflow-visible">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('udhari.date')}</TableHead>{!thermal && <TableHead>{t('udhari.col_source')}</TableHead>}<TableHead>{t('udhari.col_ref')}</TableHead>{!thermal && <TableHead>{t('udhari.col_narration')}</TableHead>}
                <TableHead className="text-right">₹</TableHead>{!thermal && <><TableHead className="text-right">{t('udhari.col_gold')}</TableHead><TableHead className="text-right">{t('udhari.col_silver')}</TableHead></>}
                <TableHead className="text-right">{t('udhari.col_balance_inr')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.length ? data.rows.map((r, i) => (
                <TableRow key={i} className={r.isReversal ? 'text-muted-foreground line-through' : ''}>
                  <TableCell>{date(r.txnDate)}</TableCell>
                  {!thermal && <TableCell>{r.source}</TableCell>}
                  <TableCell>{(() => {
                    const href = sourceHref(r.source === 'BHAV_CUT' ? 'UDHAR' : r.source, r.sourceId) // a bhav cut is part of its udhar txn
                    return href ? <Link to={href} className="font-medium text-brand-strong hover:underline print:text-foreground print:no-underline">{r.reference}</Link> : r.reference
                  })()}</TableCell>
                  {!thermal && <TableCell>{r.narration ?? '—'}</TableCell>}
                  <TableCell className="text-right">{Number(r.amount) ? r.amount : '—'}</TableCell>
                  {!thermal && <>
                    <TableCell className="text-right">{Number(r.gold) ? r.gold : '—'}</TableCell>
                    <TableCell className="text-right">{Number(r.silver) ? r.silver : '—'}</TableCell>
                  </>}
                  {/* running balance: ₹ always, metal lines only once the party has carried any */}
                  <TableCell className="text-right font-medium">
                    {r.balance.amount}
                    {Number(r.balance.gold) ? <div className="text-xs font-normal text-muted-foreground">{r.balance.gold}g Au</div> : null}
                    {Number(r.balance.silver) ? <div className="text-xs font-normal text-muted-foreground">{r.balance.silver}g Ag</div> : null}
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow><TableCell colSpan={thermal ? 4 : 8} className="h-16 text-center text-muted-foreground">{t('udhari.no_txns_range')}</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
          </div>
          <div className="flex justify-between border-t-2 border-brand pt-3 text-base font-bold"><span>{t('udhari.closing')}</span><span>{triple(data.closing)}</span></div>
        </div>
      )}
      <WhatsAppShareDialog open={sharing && !!data} onClose={() => setSharing(false)} name={data?.party.name} mobile={data?.party.mobile} buildText={shareText} />
    </div>
  )
}
