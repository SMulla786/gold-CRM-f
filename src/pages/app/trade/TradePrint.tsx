import { useQuery } from '@tanstack/react-query'
import { FileDown, Printer } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useBusinessProfile } from '@/lib/appQueries'
import { useAuth } from '@/lib/auth'
import { fetchAllPaged } from '@/lib/queries'
import { downloadPdf, shareOnWhatsApp } from '@/lib/share'
import { useBhavBooking, useBuySell, useExchange } from '@/lib/tradeQueries'
import type { ExchangeDto, PartyRefDto } from '@/shared'

import { PaymentLines } from './TradeExtras'

const inr = (s: string | number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(s))
const date = (s: string) => new Date(s).toLocaleDateString('en-IN')
const time = (s: string) => new Date(s).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
const signed = (s: string) => `${Number(s) > 0 ? '+' : ''}${s}`

/** Shared shell for the trade print views — same .print-area pattern as RepairSlip / OrderPrint. */
function PrintShell({ back, backLabel, note, title, party, summary, status, children }: {
  back: string; backLabel: string; note: string; title: string
  party?: PartyRefDto; summary?: (shop: string) => string; status?: string; children: ReactNode
}) {
  const { me } = useAuth()
  const { data: business } = useBusinessProfile()
  const shopName = business?.name ?? me?.business?.name ?? 'Shop'
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 print:hidden">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <Link to={back} className="text-sm font-medium text-brand-strong hover:underline">← {backLabel}</Link>
            {status && <Badge variant="secondary">{status}</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">{note}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {party && summary && <Button variant="outline" onClick={() => shareOnWhatsApp(party.mobile, summary(shopName))}>Share</Button>}
          <Button variant="outline" onClick={downloadPdf}><FileDown aria-hidden />Download PDF</Button>
          <Button onClick={() => window.print()}><Printer aria-hidden />Print</Button>
        </div>
      </div>

      <div className="print-area space-y-4 rounded-3xl border border-white/80 bg-card p-6 text-sm shadow-sm sm:p-10 dark:border-border print:rounded-none print:border-0 print:bg-transparent print:shadow-none">
        <header className="text-center">
          <div className="text-lg font-bold">{shopName}</div>
          {business?.address && <div>{business.address}</div>}
          {business?.gstin && <div>GSTIN: {business.gstin}</div>}
          <div className="mt-1 font-medium">{title}</div>
        </header>
        {children}
        {party && (
          <div className="flex justify-between gap-6 pt-10">
            <div className="w-40 border-t pt-1 text-center text-xs text-muted-foreground">Party signature</div>
            <div className="w-40 border-t pt-1 text-center text-xs text-muted-foreground">For {shopName}</div>
          </div>
        )}
      </div>
    </div>
  )
}

function Head({ no, label, txnDate, createdAt, party, extra }: { no: number; label: string; txnDate: string; createdAt: string; party: PartyRefDto; extra?: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 rounded-2xl bg-muted/50 px-4 py-3 print:rounded-none print:border-y print:bg-transparent print:px-0">
      <div>
        <span className="text-muted-foreground">{label}:</span> #{no}<br />
        <span className="text-muted-foreground">Date:</span> {date(txnDate)} {time(createdAt)}
        {extra}
      </div>
      <div className="text-right">
        <div className="font-medium">{party.name}</div>
        <div>{party.mobile}</div>
        {party.shopName && <div>{party.shopName}</div>}
      </div>
    </div>
  )
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return <div className={`flex justify-between${strong ? ' border-t-2 border-brand pt-1 text-base font-bold' : ''}`}><span className={strong ? '' : 'text-muted-foreground'}>{label}</span><span>{value}</span></div>
}

const Loading = () => <p className="text-sm text-muted-foreground">Loading…</p>

/** /app/exchange/:id/print — old jewellery exchange receipt. */
export function ExchangePrint() {
  const { id } = useParams()
  const { data: e, isLoading } = useExchange(Number(id))
  if (isLoading || !e) return <Loading />
  const money = Number(e.rate) > 0
  return (
    <PrintShell
      back="/app/exchange" backLabel="Exchanges" note="Exchange receipt. Share, print or save it as a PDF."
      title={`EXCHANGE RECEIPT · ${e.side === 'BUY' ? 'PURCHASE' : 'SALE'}`} party={e.party}
      summary={(shop) => `${shop}\nExchange #${e.exchangeNo} · ${e.metal} ${e.afterFine} g fine${money ? ` · ${inr(e.finalAmount)} · Balance ${inr(e.balance)}` : ''}`}
    >
      <Head no={e.exchangeNo} label="Exchange" txnDate={e.txnDate} createdAt={e.createdAt} party={e.party} extra={<><br /><span className="text-muted-foreground">Metal:</span> {e.metal}</>} />
      <div className="overflow-x-auto print:overflow-visible">
        <Table>
          <TableHeader><TableRow><TableHead>#</TableHead><TableHead>Serial</TableHead><TableHead className="text-right">Weight (g)</TableHead><TableHead className="text-right">Touch %</TableHead><TableHead className="text-right">Fine (g)</TableHead></TableRow></TableHeader>
          <TableBody>
            {e.lines.map((l, i) => (
              <TableRow key={l.id}>
                <TableCell>{i + 1}</TableCell><TableCell>{l.serialNo ?? '—'}</TableCell>
                <TableCell className="text-right tabular-nums">{l.weight}</TableCell><TableCell className="text-right tabular-nums">{l.touch}</TableCell><TableCell className="text-right tabular-nums">{l.fine}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="ml-auto max-w-xs space-y-1 tabular-nums">
        <Line label="Fine before adjust" value={`${e.totalFine} g`} />
        <Line label="± Fine adjust" value={`${signed(e.diffFine)} g`} />
        <Line label="Fine after adjust" value={`${e.afterFine} g`} strong />
        {money && <>
          <Line label="Rate" value={inr(e.rate)} />
          {Number(e.charges) > 0 && <Line label="Charges" value={inr(e.charges)} />}
          {Number(e.discount) > 0 && <Line label="Discount" value={inr(e.discount)} />}
          <Line label="Final amount" value={inr(e.finalAmount)} />
          <Line label="Cash" value={inr(e.cash)} />
          <Line label={`Online${e.bankAccount ? ` (${e.bankAccount.name})` : ''}`} value={inr(e.online)} />
          <PaymentLines payments={e.payments} />
          <div className="flex justify-between font-medium"><span>Balance</span><span>{inr(e.balance)}</span></div>
        </>}
        {!money && <p className="text-xs text-muted-foreground">Settled in metal (no money rate).</p>}
      </div>
      {e.remark && <p><span className="text-muted-foreground">Remark:</span> {e.remark}</p>}
    </PrintShell>
  )
}

/** /app/buy_sell/:id/print — bullion buy / sell slip. */
export function BuySellPrint() {
  const { id } = useParams()
  const { data: t, isLoading } = useBuySell(Number(id))
  if (isLoading || !t) return <Loading />
  const paidLabel = t.side === 'BUY' ? 'Paid' : 'Received'
  return (
    <PrintShell
      back="/app/buy_sell" backLabel="Buy / sell list" note="Buy / sell slip. Share, print or save it as a PDF."
      title={`${t.side === 'BUY' ? 'PURCHASE' : 'SALE'} SLIP · ${t.metal}`} party={t.party}
      summary={(shop) => `${shop}\nTrade #${t.buySellNo} · ${t.side} ${t.totalWeight} g ${t.metal} · ${inr(t.totalAmount)} · Balance ${inr(t.balance)}`}
    >
      <Head no={t.buySellNo} label="Trade" txnDate={t.txnDate} createdAt={t.createdAt} party={t.party} extra={t.bhavBooking ? <><br /><span className="text-muted-foreground">Against booking:</span> #{t.bhavBooking.bookingNo}</> : null} />
      <div className="overflow-x-auto print:overflow-visible">
        <Table>
          <TableHeader><TableRow><TableHead>#</TableHead><TableHead className="text-right">Weight (g)</TableHead><TableHead className="text-right">Rate</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
          <TableBody>
            {t.lines.map((l, i) => (
              <TableRow key={l.id}>
                <TableCell>{i + 1}</TableCell>
                <TableCell className="text-right tabular-nums">{l.weight}</TableCell><TableCell className="text-right tabular-nums">{inr(l.rate)}</TableCell><TableCell className="text-right tabular-nums">{inr(l.amount)}</TableCell>
              </TableRow>
            ))}
            <TableRow className="font-medium"><TableCell>Total</TableCell><TableCell className="text-right tabular-nums">{t.totalWeight}</TableCell><TableCell /><TableCell /></TableRow>
          </TableBody>
        </Table>
      </div>
      <div className="ml-auto max-w-xs space-y-1 tabular-nums">
        {Number(t.discount) > 0 && <Line label="Discount" value={inr(t.discount)} />}
        <Line label="Total amount" value={inr(t.totalAmount)} strong />
        <Line label={`${paidLabel} cash`} value={inr(t.cash)} />
        <Line label={`${paidLabel} online${t.bankAccount ? ` (${t.bankAccount.name})` : ''}`} value={inr(t.online)} />
        <PaymentLines payments={t.payments} />
        <div className="flex justify-between font-medium"><span>Balance</span><span>{inr(t.balance)}</span></div>
      </div>
      {t.narration && <p><span className="text-muted-foreground">Narration:</span> {t.narration}</p>}
    </PrintShell>
  )
}

/** /app/buy_sell/bhav/:id/print — bhav (rate lock) booking slip. */
export function BhavPrint() {
  const { id } = useParams()
  const { data: b, isLoading } = useBhavBooking(Number(id))
  if (isLoading || !b) return <Loading />
  return (
    <PrintShell
      back="/app/buy_sell/bhav" backLabel="Bhav bookings" note="Rate lock (bhav) slip. Share, print or save it as a PDF." status={b.status}
      title={`BHAV BOOKING · ${b.side === 'BUY' ? 'WE BUY' : 'WE SELL'}`} party={b.party}
      summary={(shop) => `${shop}\nBhav booking #${b.bookingNo} · ${b.side} ${b.weight} g ${b.metal} @ ${b.rate} · Advance ${inr(b.advance)}`}
    >
      <Head no={b.bookingNo} label="Booking" txnDate={b.txnDate} createdAt={b.createdAt} party={b.party} extra={<><br /><span className="text-muted-foreground">Status:</span> {b.status}</>} />
      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
        <Item label="Side">{b.side}</Item>
        <Item label="Metal">{b.metal}</Item>
        <Item label="Weight">{b.weight} g</Item>
        <Item label="Rate">{inr(b.rate)}</Item>
        <Item label="Pending weight">{b.pendingWeight} g</Item>
        {b.entryType === 'ONLY_ENTRY' && <Item label="Entry">Record only</Item>}
        {b.verifiedAt && <Item label="Verified">{date(b.verifiedAt)}{b.verifiedBy ? ` · ${b.verifiedBy}` : ''}</Item>}
      </dl>
      {!!b.lines?.length && (
        <div className="overflow-x-auto print:overflow-visible">
          <Table>
            <TableHeader><TableRow><TableHead>#</TableHead><TableHead className="text-right">Weight (g)</TableHead><TableHead className="text-right">Rate</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
            <TableBody>
              {b.lines.map((l, i) => (
                <TableRow key={l.id}><TableCell>{i + 1}</TableCell><TableCell className="text-right tabular-nums">{l.weight}</TableCell><TableCell className="text-right tabular-nums">{inr(l.rate)}</TableCell><TableCell className="text-right tabular-nums">{inr(l.amount)}</TableCell></TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <div className="ml-auto max-w-xs space-y-1 tabular-nums">
        <Line label="Amount" value={inr(b.amount)} strong />
        <Line label={`Advance${b.bankAccount ? ` (incl. online, ${b.bankAccount.name})` : ''}`} value={inr(b.advance)} />
        <PaymentLines payments={b.payments} />
      </div>
      {b.narration && <p><span className="text-muted-foreground">Narration:</span> {b.narration}</p>}
    </PrintShell>
  )
}

function Item({ label, children }: { label: string; children: ReactNode }) {
  return <div><dt className="text-xs text-muted-foreground">{label}</dt><dd className="font-medium">{children}</dd></div>
}

/** /app/exchange/print?side&metal&q&ptype — every row matching the Exchanges list filters, as a printable list. */
export function ExchangeListPrint() {
  const [sp] = useSearchParams()
  const get = (k: string) => sp.get(k) ?? undefined
  const filters = { side: get('side'), metal: get('metal'), q: get('q'), partyType: get('partyType') ?? get('ptype'), processed: get('processed'), from: get('from'), to: get('to') }
  const { data, isLoading } = useQuery({ queryKey: ['exchange', 'print-all', filters], queryFn: () => fetchAllPaged<ExchangeDto>('/app/exchange', filters) })
  if (isLoading || !data) return <Loading />
  const rows = data
  const fineOf = (m: string) => rows.filter((e) => e.metal === m).reduce((a, e) => a + Number(e.afterFine), 0)
  const amount = rows.filter((e) => Number(e.rate) > 0).reduce((a, e) => a + Number(e.finalAmount), 0)
  const applied = [filters.side, filters.metal, filters.partyType, filters.processed && (filters.processed === 'true' ? 'sent to melt' : 'not sent to melt'), (filters.from || filters.to) && `${filters.from ?? '…'} to ${filters.to ?? '…'}`, filters.q && `“${filters.q}”`].filter(Boolean).join(' · ') || 'All'
  return (
    <PrintShell back="/app/exchange" backLabel="Exchanges" note="Exchanges matching the list filters, all pages. Print it or save it as a PDF." title="EXCHANGE LIST">
      <p className="text-center text-muted-foreground">Filters: {applied} · {rows.length} entries</p>
      <div className="overflow-x-auto print:overflow-visible">
        <Table>
          <TableHeader><TableRow>
            <TableHead>No</TableHead><TableHead>Date</TableHead><TableHead>Side</TableHead><TableHead>Party</TableHead><TableHead>Metal</TableHead>
            <TableHead className="text-right">Fine before adj.</TableHead><TableHead className="text-right">± Adj.</TableHead><TableHead className="text-right">Fine</TableHead><TableHead className="text-right">Amount</TableHead><TableHead className="text-right">Balance</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.map((e) => (
              <TableRow key={e.id}>
                <TableCell>#{e.exchangeNo}</TableCell><TableCell className="whitespace-nowrap">{date(e.txnDate)}</TableCell><TableCell>{e.side}</TableCell>
                <TableCell>{e.party.name}<div className="text-xs text-muted-foreground">{e.party.mobile}</div></TableCell><TableCell>{e.metal}</TableCell>
                <TableCell className="text-right tabular-nums">{e.totalFine}</TableCell><TableCell className="text-right tabular-nums">{signed(e.diffFine)}</TableCell><TableCell className="text-right tabular-nums">{e.afterFine}</TableCell>
                <TableCell className="text-right tabular-nums">{Number(e.rate) > 0 ? inr(e.finalAmount) : '— metal'}</TableCell>
                <TableCell className="text-right tabular-nums">{Number(e.rate) > 0 ? inr(e.balance) : `${e.afterFine}g`}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="ml-auto max-w-xs space-y-1 tabular-nums">
        <Line label="Gold fine" value={`${fineOf('GOLD').toFixed(3)} g`} />
        <Line label="Silver fine" value={`${fineOf('SILVER').toFixed(3)} g`} />
        <Line label="Value settled in money" value={inr(amount)} strong />
      </div>
    </PrintShell>
  )
}
