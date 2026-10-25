import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
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
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 print:hidden">
        <Link to="/app/udhari/ledger" className="text-sm text-primary hover:underline">← Ledger</Link>
        <div className="space-y-1.5"><Label htmlFor="s-from">From</Label><Input id="s-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div className="space-y-1.5"><Label htmlFor="s-to">To</Label><Input id="s-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <Button variant="outline" className="ml-auto" disabled={!data} onClick={() => data && shareOnWhatsApp(data.party.mobile, `${data.party.name}\nAccount statement · closing balance ${triple(data.closing)}`)}>Share</Button>
        <Button variant="outline" onClick={() => window.print()}>Print</Button>
        <Button variant="outline" onClick={downloadPdf}>Download PDF</Button>
      </div>

      {isLoading || !data ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="print-area space-y-3 rounded-md border p-6">
          <div>
            <h2 className="text-lg font-semibold">{data.party.name}</h2>
            <p className="text-sm text-muted-foreground">{data.party.mobile} · + party owes shop, − shop owes party</p>
          </div>
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">Opening</span><span className="font-medium">{triple(data.opening)}</span></div>
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
          <div className="flex justify-between border-t pt-2 text-sm font-semibold"><span>Closing</span><span>{triple(data.closing)}</span></div>
        </div>
      )}
    </div>
  )
}
