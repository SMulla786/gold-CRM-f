import { FileDown, Printer } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { usePartyStatement } from '@/lib/udhariQueries'
import { downloadPdf, shareOnWhatsApp } from '@/lib/share'
import type { BalanceDto } from '@/shared'

const date = (s: string) => new Date(s).toLocaleDateString('en-IN')
const triple = (b: BalanceDto) => `₹${b.amount}${Number(b.gold) ? ` · ${b.gold}g Au` : ''}${Number(b.silver) ? ` · ${b.silver}g Ag` : ''}`

export function Statement() {
  const { partyId } = useParams()
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const { data, isLoading } = usePartyStatement(Number(partyId), { from: from || undefined, to: to || undefined })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 print:hidden">
        <div className="space-y-1">
          <Link to="/app/udhari/ledger" className="text-sm font-medium text-brand-strong hover:underline">← Ledger</Link>
          <p className="text-sm text-muted-foreground">Party account statement for the selected period. Share, print or save as PDF.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" disabled={!data} onClick={() => data && shareOnWhatsApp(data.party.mobile, `${data.party.name}\nAccount statement · closing balance ${triple(data.closing)}`)}>Share</Button>
          <Button variant="outline" onClick={downloadPdf}><FileDown aria-hidden />Download PDF</Button>
          <Button onClick={() => window.print()}><Printer aria-hidden />Print</Button>
        </div>
      </div>

      <Card className="flex w-fit flex-wrap items-end gap-4 p-4 print:hidden">
        <div className="space-y-1.5"><Label htmlFor="s-from">From</Label><Input id="s-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div className="space-y-1.5"><Label htmlFor="s-to">To</Label><Input id="s-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
      </Card>

      {isLoading || !data ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="print-area space-y-4 rounded-3xl border border-white/80 bg-card p-6 shadow-sm sm:p-10 dark:border-border print:rounded-none print:border-0 print:bg-transparent print:shadow-none">
          <div>
            <h2 className="text-xl font-bold">{data.party.name}</h2>
            <p className="text-sm text-muted-foreground">{data.party.mobile} · + party owes shop, − shop owes party</p>
          </div>
          <div className="flex justify-between rounded-2xl bg-muted/50 px-4 py-3 text-sm print:rounded-none print:bg-transparent print:px-0"><span className="text-muted-foreground">Opening</span><span className="font-semibold">{triple(data.opening)}</span></div>
          <div className="overflow-x-auto print:overflow-visible">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead><TableHead>Source</TableHead><TableHead>Ref</TableHead><TableHead>Narration</TableHead>
                <TableHead className="text-right">₹</TableHead><TableHead className="text-right">Gold</TableHead><TableHead className="text-right">Silver</TableHead>
                <TableHead className="text-right">Balance ₹</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.length ? data.rows.map((r, i) => (
                <TableRow key={i} className={r.isReversal ? 'text-muted-foreground line-through' : ''}>
                  <TableCell>{date(r.txnDate)}</TableCell>
                  <TableCell>{r.source}</TableCell>
                  <TableCell>{r.reference}</TableCell>
                  <TableCell>{r.narration ?? '—'}</TableCell>
                  <TableCell className="text-right">{Number(r.amount) ? r.amount : '—'}</TableCell>
                  <TableCell className="text-right">{Number(r.gold) ? r.gold : '—'}</TableCell>
                  <TableCell className="text-right">{Number(r.silver) ? r.silver : '—'}</TableCell>
                  <TableCell className="text-right font-medium">{r.balance.amount}</TableCell>
                </TableRow>
              )) : (
                <TableRow><TableCell colSpan={8} className="h-16 text-center text-muted-foreground">No transactions in range</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
          </div>
          <div className="flex justify-between border-t-2 border-brand pt-3 text-base font-bold"><span>Closing</span><span>{triple(data.closing)}</span></div>
        </div>
      )}
    </div>
  )
}
