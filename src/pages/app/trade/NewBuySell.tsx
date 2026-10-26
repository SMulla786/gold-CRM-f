import { useNavigate, useSearchParams } from 'react-router-dom'
import { useState } from 'react'

import { PartyPicker } from '@/components/PartyPicker'
import { SelectBranchForTxn } from '@/components/SelectBranchForTxn'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useBankAccounts, useCurrentRates, useSettings } from '@/lib/appQueries'
import { useAuth } from '@/lib/auth'
import { metalRateUnitGrams } from '@/lib/billingQueries'
import { useBhavBooking, useBhavBookings, useCreateBuySell } from '@/lib/tradeQueries'
import { businessDayISO, METALS, TRADE_SIDES, metalToMoney, type BhavBookingDto, type PartyRefDto } from '@/shared'

import { fineRate } from './tradeRates'

let uid = 0
const k = () => `b${uid++}`
const today = businessDayISO
const inr = (s: string | number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(s))
const n = (s: string) => Number(s) || 0

interface Row { key: string; weight: string; rate: string }
const blankRow = (rate = ''): Row => ({ key: k(), weight: '', rate })

export function NewBuySell() {
  const navigate = useNavigate()
  const { activeBranch } = useAuth()
  const branchReady = activeBranch !== '' && activeBranch !== 'all'
  const { data: settings } = useSettings()
  const { data: banks } = useBankAccounts()
  const { data: rates } = useCurrentRates()
  const create = useCreateBuySell()

  const [side, setSide] = useState('BUY')
  const [party, setParty] = useState<PartyRefDto | null>(null)
  const [metal, setMetal] = useState('GOLD')
  const [txnDate, setTxnDate] = useState(today())
  const [rows, setRows] = useState<Row[]>([blankRow()])
  const [booking, setBooking] = useState<BhavBookingDto | null>(null)
  const [f, setF] = useState({ discount: '0', cash: '0', online: '0', bankAccountId: '', narration: '' })
  const set = (key: keyof typeof f, v: string) => setF((s) => ({ ...s, [key]: v }))

  // "Deliver" from the bhav booking list opens this page with ?booking=<id>: prefill side, metal, party and
  // the locked rate once, with the pending weight as the first line. Everything stays editable as usual.
  const [params] = useSearchParams()
  const bookingParam = Number(params.get('booking'))
  const preId = Number.isInteger(bookingParam) && bookingParam > 0 ? bookingParam : undefined
  const { data: preBooking } = useBhavBooking(preId)
  const [prefilled, setPrefilled] = useState<number | null>(null)
  if (preBooking && prefilled !== preBooking.id && (preBooking.status === 'PENDING' || preBooking.status === 'PARTIAL')) {
    setPrefilled(preBooking.id)
    setSide(preBooking.side)
    setMetal(preBooking.metal)
    setParty(preBooking.party)
    setBooking(preBooking)
    setRows([{ ...blankRow(preBooking.rate), weight: preBooking.pendingWeight }])
  }

  // open bookings for the picker: same side/metal/party, PENDING+PARTIAL
  const { data: bookings } = useBhavBookings({ open: 'true', side, metal, partyId: party?.id })

  const unit = metalRateUnitGrams(metal, settings)
  const setRow = (i: number, key: keyof Row, v: string) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [key]: v } : r)))
  // A blank rate falls back to today's fine rate for this side (shown as the placeholder); typing a rate overrides it.
  const spot = booking ? '' : fineRate(rates, metal, side, settings)
  const rateOf = (r: Row) => (r.rate !== '' ? r.rate : spot)
  const amountOf = (r: Row) => Number(metalToMoney(n(r.weight), n(rateOf(r)), unit))
  const totalWeight = rows.reduce((a, r) => a + n(r.weight), 0)
  const gross = rows.reduce((a, r) => a + amountOf(r), 0)
  const totalAmount = gross - n(f.discount)
  const paid = n(f.cash) + n(f.online)
  const advance = booking ? n(booking.advance) : 0 // nets like an order advance (party credit)
  const balance = totalAmount - paid - advance

  // selecting a booking locks every line to its rate (spec: deliver at the booking rate)
  const pickBooking = (id: string) => {
    const b = bookings?.items.find((x) => String(x.id) === id) ?? null
    setBooking(b)
    if (b) setRows((rs) => rs.map((r) => ({ ...r, rate: b.rate })))
  }

  const valid = branchReady && !!party && rows.every((r) => n(r.weight) > 0 && n(rateOf(r)) > 0) && totalWeight > 0 && (n(f.online) === 0 || f.bankAccountId)

  const submit = async () => {
    await create.mutateAsync({
      side, partyId: party!.id, metal, txnDate,
      lines: rows.map((r) => ({ weight: n(r.weight), rate: n(rateOf(r)) })),
      discount: n(f.discount), bhavBookingId: booking?.id,
      cash: n(f.cash), online: n(f.online), bankAccountId: n(f.online) > 0 ? Number(f.bankAccountId) : undefined,
      narration: f.narration || undefined,
    })
    navigate('/app/buy_sell')
  }

  return (
    <div className="space-y-8">
      {!branchReady && <SelectBranchForTxn note="A trade is booked at one branch. Select a branch." />}

      <Card>
        <CardHeader><CardTitle>Trade details</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Side</Label>
            <Select value={side} onValueChange={(v) => { setSide(v); setBooking(null) }}>
              <SelectTrigger aria-label="Side"><SelectValue /></SelectTrigger>
              <SelectContent>{TRADE_SIDES.map((s) => <SelectItem key={s} value={s}>{s === 'BUY' ? 'Buy (bullion in)' : 'Sell (bullion out)'}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 lg:col-span-2"><Label htmlFor="bs-party">Party</Label><PartyPicker value={party} onChange={(p) => { setParty(p); setBooking(null) }} placeholder="Search name / mobile" id="bs-party" ariaLabel="Party" /></div>
          <div className="space-y-1.5">
            <Label>Metal</Label>
            <Select value={metal} onValueChange={(v) => { setMetal(v); setBooking(null) }}>
              <SelectTrigger aria-label="Metal"><SelectValue /></SelectTrigger>
              <SelectContent>{METALS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label htmlFor="bs-date">Date</Label><Input id="bs-date" type="date" value={txnDate} onChange={(e) => setTxnDate(e.target.value)} /></div>
          {!!bookings?.items.length && (
            <div className="space-y-1.5 lg:col-span-2">
              <Label>Deliver against bhav booking</Label>
              <Select value={booking ? String(booking.id) : 'none'} onValueChange={(v) => pickBooking(v === 'none' ? '' : v)}>
                <SelectTrigger aria-label="Bhav booking"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (spot rate)</SelectItem>
                  {bookings.items.map((b) => <SelectItem key={b.id} value={String(b.id)}>#{b.bookingNo} · {b.pendingWeight}g pending @ {b.rate}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-xl">Line items</h2>
        <Card className="overflow-x-auto p-2">
          <Table>
            <TableHeader><TableRow><TableHead>Weight (g)</TableHead><TableHead>Rate ({metal === 'GOLD' ? '/10g' : '/kg'})</TableHead><TableHead>Amount</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {rows.map((r, i) => (
                <TableRow key={r.key}>
                  <TableCell><Input className="w-28" type="number" step="0.001" aria-label="Weight" value={r.weight} onChange={(e) => setRow(i, 'weight', e.target.value)} /></TableCell>
                  <TableCell><Input className="w-32" type="number" aria-label="Rate" value={r.rate} placeholder={spot || undefined} disabled={!!booking} onChange={(e) => setRow(i, 'rate', e.target.value)} /></TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">{inr(amountOf(r))}</TableCell>
                  <TableCell><Button variant="ghost" size="sm" aria-label="Remove line" disabled={rows.length === 1} onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}>✕</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="outline" size="sm" onClick={() => setRows((rs) => [...rs, blankRow(booking?.rate ?? '')])}>+ Add line</Button>
          {spot && <p className="text-xs text-muted-foreground tabular-nums">Today's fine {side === 'BUY' ? 'buy' : 'sell'} rate {spot} ({metal === 'GOLD' ? '/10g' : '/kg'}) is used when a line's rate is left blank.</p>}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Payment</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5"><Label htmlFor="bs-disc">Discount ₹</Label><Input id="bs-disc" type="number" value={f.discount} onChange={(e) => set('discount', e.target.value)} /></div>
              <div className="space-y-1.5"><Label htmlFor="bs-cash">{side === 'BUY' ? 'Cash paid ₹' : 'Cash recd ₹'}</Label><Input id="bs-cash" type="number" value={f.cash} onChange={(e) => set('cash', e.target.value)} /></div>
              <div className="space-y-1.5"><Label htmlFor="bs-online">Online ₹</Label><Input id="bs-online" type="number" value={f.online} onChange={(e) => set('online', e.target.value)} /></div>
              {n(f.online) > 0 && (
                <div className="space-y-1.5"><Label>Bank</Label>
                  <Select value={f.bankAccountId} onValueChange={(v) => set('bankAccountId', v)}><SelectTrigger aria-label="Bank account"><SelectValue placeholder="Bank" /></SelectTrigger>
                    <SelectContent>{banks?.map((b) => <SelectItem key={b.id} value={String(b.id)}>{b.bankName} · {b.accountNo}</SelectItem>)}</SelectContent></Select>
                </div>
              )}
            </div>
            <div className="space-y-1.5"><Label htmlFor="bs-narr">Narration</Label><Input id="bs-narr" value={f.narration} onChange={(e) => set('narration', e.target.value)} /></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Summary</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm tabular-nums">
            <div className="flex justify-between"><span className="text-muted-foreground">Total weight</span><span>{totalWeight.toFixed(3)} g</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Gross</span><span>{inr(gross)}</span></div>
            <div className="flex justify-between border-t pt-1 font-semibold"><span>Amount</span><span>{inr(totalAmount)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Paid</span><span>{inr(paid)}</span></div>
            {!!advance && <div className="flex justify-between"><span className="text-muted-foreground">Booking advance</span><span>−{inr(advance)}</span></div>}
            <div className="flex justify-between font-medium"><span>Balance ({side === 'BUY' ? 'shop owes' : 'party owes'})</span><span>{inr(Math.abs(balance))}</span></div>
            <div className="flex justify-end pt-2">
              <Button className="w-full" disabled={!valid || create.isPending} onClick={() => void submit().catch(() => {})}>
                {create.isPending ? 'Saving…' : `Save ${side === 'BUY' ? 'purchase' : 'sale'}`}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
