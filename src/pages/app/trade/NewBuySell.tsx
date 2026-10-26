import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useState } from 'react'
import { toast } from 'sonner'

import { MpinDialog } from '@/components/MpinDialog'
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
import { useT } from '@/lib/i18n'
import { useBhavBooking, useBhavBookings, useBuySell, useCreateBuySell, useUpdateBuySell } from '@/lib/tradeQueries'
import { businessDayISO, METALS, TRADE_SIDES, metalToMoney, type BhavBookingDto, type PartyRefDto } from '@/shared'

import { blankPay, payBody, payRowsFrom, payTotal, payValid, type PayRow } from './splitPay'
import { PartyBalanceChip, SplitPaymentTable, SplitToggle } from './TradeExtras'
import { fineRate } from './tradeRates'

let uid = 0
const k = () => `b${uid++}`
const today = businessDayISO
const inr = (s: string | number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(s))
const n = (s: string) => Number(s) || 0

interface Row { key: string; weight: string; rate: string }
const blankRow = (rate = ''): Row => ({ key: k(), weight: '', rate })

export function NewBuySell() {
  const t = useT()
  const navigate = useNavigate()
  const { activeBranch } = useAuth()
  const branchReady = activeBranch !== '' && activeBranch !== 'all'
  const { data: settings } = useSettings()
  const { data: banks } = useBankAccounts()
  const { data: rates } = useCurrentRates()
  const create = useCreateBuySell()
  const update = useUpdateBuySell()

  const [side, setSide] = useState('BUY')
  const [party, setParty] = useState<PartyRefDto | null>(null)
  const [metal, setMetal] = useState('GOLD')
  const [txnDate, setTxnDate] = useState(today())
  const [rows, setRows] = useState<Row[]>([blankRow()])
  const [booking, setBooking] = useState<BhavBookingDto | null>(null)
  const [f, setF] = useState({ discount: '0', cash: '0', online: '0', bankAccountId: '', narration: '' })
  const set = (key: keyof typeof f, v: string) => setF((s) => ({ ...s, [key]: v }))
  const [split, setSplit] = useState(false)
  const [pays, setPays] = useState<PayRow[]>(() => [blankPay()])
  const [askMpin, setAskMpin] = useState(false)

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

  // ?edit=<id> opens a saved trade prefilled; saving replaces it (same number) after MPIN.
  const editParam = Number(params.get('edit'))
  const editId = Number.isInteger(editParam) && editParam > 0 && editParam <= 2_147_483_647 ? editParam : 0
  const { data: editing } = useBuySell(editId)
  const { data: editBooking } = useBhavBooking(editing?.bhavBooking?.id)
  const [editPrefilled, setEditPrefilled] = useState<number | null>(null)
  if (editing && editPrefilled !== editing.id && (!editing.bhavBooking || editBooking)) {
    setEditPrefilled(editing.id)
    setSide(editing.side)
    setParty(editing.party)
    setMetal(editing.metal)
    setTxnDate(editing.txnDate)
    setBooking(editBooking ?? null)
    setRows(editing.lines.map((l) => ({ key: k(), weight: l.weight, rate: l.rate })))
    setF({ discount: editing.discount, cash: editing.cash, online: editing.online, bankAccountId: editing.bankAccount ? String(editing.bankAccount.id) : '', narration: editing.narration ?? '' })
    if (editing.payments?.length) { setSplit(true); setPays(payRowsFrom(editing.payments)) }
  }

  // open bookings for the picker: same side/metal/party, PENDING+PARTIAL (+ the edited trade's own booking)
  const { data: bookings } = useBhavBookings({ open: 'true', side, metal, partyId: party?.id })
  const openBookings = bookings?.items ?? []
  const bookingOptions = booking && !openBookings.some((b) => b.id === booking.id) ? [booking, ...openBookings] : openBookings

  const unit = metalRateUnitGrams(metal, settings)
  const setRow = (i: number, key: keyof Row, v: string) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [key]: v } : r)))
  // A blank rate falls back to today's fine rate for this side (shown as the placeholder); typing a rate overrides it.
  const spot = booking ? '' : fineRate(rates, metal, side, settings)
  const rateOf = (r: Row) => (r.rate !== '' ? r.rate : spot)
  const amountOf = (r: Row) => Number(metalToMoney(n(r.weight), n(rateOf(r)), unit))
  const totalWeight = rows.reduce((a, r) => a + n(r.weight), 0)
  const gross = rows.reduce((a, r) => a + amountOf(r), 0)
  const totalAmount = gross - n(f.discount)
  const paid = split ? payTotal(pays) : n(f.cash) + n(f.online)
  const advance = booking ? n(booking.advance) : 0 // nets like an order advance (party credit)
  const balance = totalAmount - paid - advance

  // selecting a booking locks every line to its rate (spec: deliver at the booking rate)
  const pickBooking = (id: string) => {
    const b = bookingOptions.find((x) => String(x.id) === id) ?? null
    setBooking(b)
    if (b) setRows((rs) => rs.map((r) => ({ ...r, rate: b.rate })))
  }

  const valid = branchReady && !!party && rows.every((r) => n(r.weight) > 0 && n(rateOf(r)) > 0) && totalWeight > 0 && (split ? payValid(pays) : n(f.online) === 0 || f.bankAccountId)

  const body = () => ({
    side, partyId: party!.id, metal, txnDate,
    lines: rows.map((r) => ({ weight: n(r.weight), rate: n(rateOf(r)) })),
    discount: n(f.discount), bhavBookingId: booking?.id,
    ...(split ? payBody(pays) : { cash: n(f.cash), online: n(f.online), bankAccountId: n(f.online) > 0 ? Number(f.bankAccountId) : undefined }),
    narration: f.narration || undefined,
  })
  const submit = async () => {
    if (editing) { setAskMpin(true); return }
    const saved = await create.mutateAsync(body())
    navigate('/app/buy_sell')
    toast(t('trade.bs.toast_saved', { no: saved.buySellNo }), { action: { label: t('trade.bs.print_slip'), onClick: () => navigate(`/app/buy_sell/${saved.id}/print`) } })
  }
  const saveEdit = async (mpin: string) => {
    await update.mutateAsync({ id: editing!.id, mpin, body: body() })
    navigate('/app/buy_sell')
  }
  const pending = create.isPending || update.isPending

  return (
    <div className="space-y-8">
      {!branchReady && <SelectBranchForTxn note={t('trade.bs.branch_note')} />}
      {editing && (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6 text-sm">
            <span>{t('trade.bs.editing', { no: editing.buySellNo })}</span>
            <Button asChild variant="outline" size="sm"><Link to="/app/buy_sell">{t('trade.cancel_edit')}</Link></Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>{t('trade.bs.details')}</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1.5">
            <Label>{t('trade.side')}</Label>
            <Select value={side} onValueChange={(v) => { setSide(v); setBooking(null) }}>
              <SelectTrigger aria-label="Side"><SelectValue /></SelectTrigger>
              <SelectContent>{TRADE_SIDES.map((s) => <SelectItem key={s} value={s}>{s === 'BUY' ? t('trade.bs.side_buy') : t('trade.bs.side_sell')}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 lg:col-span-2"><Label htmlFor="bs-party">{t('udhari.party')}</Label><PartyPicker value={party} onChange={(p) => { setParty(p); setBooking(null) }} placeholder={t('bill.search_party')} id="bs-party" ariaLabel="Party" /><PartyBalanceChip partyId={party?.id} /></div>
          <div className="space-y-1.5">
            <Label>{t('udhari.metal')}</Label>
            <Select value={metal} onValueChange={(v) => { setMetal(v); setBooking(null) }}>
              <SelectTrigger aria-label="Metal"><SelectValue /></SelectTrigger>
              <SelectContent>{METALS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label htmlFor="bs-date">{t('udhari.date')}</Label><Input id="bs-date" type="date" value={txnDate} onChange={(e) => setTxnDate(e.target.value)} /></div>
          {!!bookingOptions.length && (
            <div className="space-y-1.5 lg:col-span-2">
              <Label>{t('trade.bs.deliver_against')}</Label>
              <Select value={booking ? String(booking.id) : 'none'} onValueChange={(v) => pickBooking(v === 'none' ? '' : v)}>
                <SelectTrigger aria-label="Bhav booking"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('trade.bs.no_booking')}</SelectItem>
                  {bookingOptions.map((b) => <SelectItem key={b.id} value={String(b.id)}>{t('trade.bs.booking_option', { no: b.bookingNo, wt: b.pendingWeight, rate: b.rate })}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-xl">{t('trade.bs.line_items')}</h2>
        <Card className="overflow-x-auto p-2">
          <Table>
            <TableHeader><TableRow><TableHead>{t('udhari.weight_g')}</TableHead><TableHead>{t('trade.rate_unit', { unit: metal === 'GOLD' ? '/10g' : '/kg' })}</TableHead><TableHead>{t('bill.amount')}</TableHead><TableHead /></TableRow></TableHeader>
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
          <Button variant="outline" size="sm" onClick={() => setRows((rs) => [...rs, blankRow(booking?.rate ?? '')])}>{t('jbill.add_line')}</Button>
          {spot && <p className="text-xs text-muted-foreground tabular-nums">{t('trade.bs.spot_hint', { side: side === 'BUY' ? t('trade.side_buy_lc') : t('trade.side_sell_lc'), rate: spot, unit: metal === 'GOLD' ? '/10g' : '/kg' })}</p>}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>{t('trade.payment')}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5"><Label htmlFor="bs-disc">{t('girvi.discount_inr')}</Label><Input id="bs-disc" type="number" value={f.discount} onChange={(e) => set('discount', e.target.value)} /></div>
              {!split && <>
                <div className="space-y-1.5"><Label htmlFor="bs-cash">{side === 'BUY' ? t('trade.cash_paid') : t('trade.cash_recd')}</Label><Input id="bs-cash" type="number" value={f.cash} onChange={(e) => set('cash', e.target.value)} /></div>
                <div className="space-y-1.5"><Label htmlFor="bs-online">{t('udhari.online')}</Label><Input id="bs-online" type="number" value={f.online} onChange={(e) => set('online', e.target.value)} /></div>
                {n(f.online) > 0 && (
                  <div className="space-y-1.5"><Label>{t('bill.bank')}</Label>
                    <Select value={f.bankAccountId} onValueChange={(v) => set('bankAccountId', v)}><SelectTrigger aria-label="Bank account"><SelectValue placeholder={t('bill.bank')} /></SelectTrigger>
                      <SelectContent>{banks?.map((b) => <SelectItem key={b.id} value={String(b.id)}>{b.bankName} · {b.accountNo}</SelectItem>)}</SelectContent></Select>
                  </div>
                )}
              </>}
            </div>
            <SplitToggle id="bs-split" checked={split} onChange={setSplit} />
            {split && <SplitPaymentTable rows={pays} onChange={setPays} />}
            <div className="space-y-1.5"><Label htmlFor="bs-narr">{t('udhari.col_narration')}</Label><Input id="bs-narr" value={f.narration} onChange={(e) => set('narration', e.target.value)} /></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t('dash.col_summary')}</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm tabular-nums">
            <div className="flex justify-between"><span className="text-muted-foreground">{t('trade.total_weight')}</span><span>{totalWeight.toFixed(3)} g</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">{t('stock.col_gross')}</span><span>{inr(gross)}</span></div>
            <div className="flex justify-between border-t pt-1 font-semibold"><span>{t('bill.amount')}</span><span>{inr(totalAmount)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">{t('bill.paid')}</span><span>{inr(paid)}</span></div>
            {!!advance && <div className="flex justify-between"><span className="text-muted-foreground">{t('trade.booking_advance')}</span><span>−{inr(advance)}</span></div>}
            <div className="flex justify-between font-medium"><span>{t('trade.balance_who', { who: side === 'BUY' ? t('trade.shop_owes') : t('trade.party_owes') })}</span><span>{inr(Math.abs(balance))}</span></div>
            <div className="flex justify-end pt-2">
              <Button className="w-full" disabled={!valid || pending} onClick={() => void submit().catch(() => {})}>
                {pending ? t('bill.saving') : editing ? t('party.save_changes') : t('trade.save_kind', { kind: side === 'BUY' ? t('trade.kind_purchase') : t('trade.kind_sale') })}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      <MpinDialog open={askMpin} title={t('trade.bs.save_changes_title', { no: editing?.buySellNo ?? '' })} onConfirm={saveEdit} onClose={() => setAskMpin(false)} />
    </div>
  )
}
