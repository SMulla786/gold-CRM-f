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
import { useCreateExchange, useExchange, useUpdateExchange } from '@/lib/tradeQueries'
import { businessDayISO, METALS, TRADE_SIDES, computeLine, metalToMoney, type PartyRefDto } from '@/shared'

import { blankPay, payBody, payRowsFrom, payTotal, payValid, type PayRow } from './splitPay'
import { SplitPaymentTable, SplitToggle } from './TradeExtras'
import { fineRate } from './tradeRates'

let uid = 0
const k = () => `e${uid++}`
const today = businessDayISO
const inr = (s: string | number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(s))
const n = (s: string) => Number(s) || 0

interface Row { key: string; weight: string; touch: string; serialNo: string }
const blankRow = (): Row => ({ key: k(), weight: '', touch: '', serialNo: '' })
const fineOf = (r: Row) => Number(computeLine({ gross: n(r.weight), tunch: n(r.touch) }).fine)

export function NewExchange() {
  const navigate = useNavigate()
  const { activeBranch } = useAuth()
  const branchReady = activeBranch !== '' && activeBranch !== 'all'
  const { data: settings } = useSettings()
  const { data: banks } = useBankAccounts()
  const { data: rates } = useCurrentRates()
  const create = useCreateExchange()
  const update = useUpdateExchange()

  const [side, setSide] = useState('BUY')
  const [party, setParty] = useState<PartyRefDto | null>(null)
  const [metal, setMetal] = useState('GOLD')
  const [txnDate, setTxnDate] = useState(today())
  const [rows, setRows] = useState<Row[]>([blankRow()])
  const [f, setF] = useState({ diffFine: '0', rate: '0', charges: '0', discount: '0', cash: '0', online: '0', bankAccountId: '', remark: '' })
  const set = (key: keyof typeof f, v: string) => setF((s) => ({ ...s, [key]: v }))
  const [split, setSplit] = useState(false)
  const [pays, setPays] = useState<PayRow[]>(() => [blankPay()])
  const [askMpin, setAskMpin] = useState(false)

  // ?edit=<id> opens this form prefilled with a saved exchange; saving replaces it (same number) after MPIN.
  const [params] = useSearchParams()
  const editParam = Number(params.get('edit'))
  const editId = Number.isInteger(editParam) && editParam > 0 && editParam <= 2_147_483_647 ? editParam : 0
  const { data: editing } = useExchange(editId)
  const [prefilled, setPrefilled] = useState<number | null>(null)
  if (editing && prefilled !== editing.id) {
    setPrefilled(editing.id)
    setSide(editing.side)
    setParty(editing.party)
    setMetal(editing.metal)
    setTxnDate(editing.txnDate)
    setRows(editing.lines.map((l) => ({ key: k(), weight: l.weight, touch: l.touch, serialNo: l.serialNo ?? '' })))
    setF({ diffFine: editing.diffFine, rate: editing.rate, charges: editing.charges, discount: editing.discount, cash: editing.cash, online: editing.online, bankAccountId: editing.bankAccount ? String(editing.bankAccount.id) : '', remark: editing.remark ?? '' })
    if (editing.payments?.length) { setSplit(true); setPays(payRowsFrom(editing.payments)) }
  }

  const setRow = (i: number, key: keyof Row, v: string) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [key]: v } : r)))
  const totalFine = rows.reduce((a, r) => a + fineOf(r), 0)
  const afterFine = totalFine + n(f.diffFine)
  const moneyMode = n(f.rate) > 0
  const todayRate = fineRate(rates, metal, side, settings) // hint only; the rate field stays manual
  const finalAmount = moneyMode ? Number(metalToMoney(afterFine, n(f.rate), metalRateUnitGrams(metal, settings))) + n(f.charges) - n(f.discount) : 0
  const splitOn = split && moneyMode
  const paid = splitOn ? payTotal(pays) : n(f.cash) + n(f.online)
  const balance = finalAmount - paid

  const valid = branchReady && !!party && rows.every((r) => n(r.weight) > 0 && n(r.touch) > 0) && afterFine > 0
    && (moneyMode || (paid === 0 && n(f.charges) === 0 && n(f.discount) === 0))
    && (splitOn ? payValid(pays) : n(f.online) === 0 || f.bankAccountId)
    && !(editing && editing.processed)

  const body = () => ({
    side, partyId: party!.id, metal, txnDate,
    lines: rows.map((r) => ({ weight: n(r.weight), touch: n(r.touch), serialNo: r.serialNo || undefined })),
    diffFine: n(f.diffFine), rate: n(f.rate), charges: n(f.charges), discount: n(f.discount),
    ...(splitOn ? payBody(pays) : { cash: n(f.cash), online: n(f.online), bankAccountId: n(f.online) > 0 ? Number(f.bankAccountId) : undefined }),
    remark: f.remark || undefined,
  })
  const submit = async () => {
    if (editing) { setAskMpin(true); return }
    const saved = await create.mutateAsync(body())
    navigate(`/app/exchange`)
    toast(`Exchange #${saved.exchangeNo} receipt is ready`, { action: { label: 'Print receipt', onClick: () => navigate(`/app/exchange/${saved.id}/print`) } })
  }
  const saveEdit = async (mpin: string) => {
    await update.mutateAsync({ id: editing!.id, mpin, body: body() })
    navigate('/app/exchange')
  }
  const pending = create.isPending || update.isPending

  return (
    <div className="space-y-8">
      {!branchReady && <SelectBranchForTxn note="An exchange is booked at one branch. Select a branch." />}
      {editing && (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6 text-sm">
            <span>Editing exchange #{editing.exchangeNo}. Saving replaces its entries (same number) and needs your MPIN.{editing.processed && ' It was sent to melt / refine, so revert that processing before editing.'}</span>
            <Button asChild variant="outline" size="sm"><Link to="/app/exchange">Cancel edit</Link></Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Transaction details</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Side</Label>
            <Select value={side} onValueChange={setSide}>
              <SelectTrigger aria-label="Side"><SelectValue /></SelectTrigger>
              <SelectContent>{TRADE_SIDES.map((s) => <SelectItem key={s} value={s}>{s === 'BUY' ? 'Buy (old metal in)' : 'Sell (kacha out)'}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 lg:col-span-2"><Label htmlFor="ex-party">Party</Label><PartyPicker value={party} onChange={setParty} placeholder="Search name / mobile" id="ex-party" ariaLabel="Party" /></div>
          <div className="space-y-1.5">
            <Label>Metal</Label>
            <Select value={metal} onValueChange={setMetal}>
              <SelectTrigger aria-label="Metal"><SelectValue /></SelectTrigger>
              <SelectContent>{METALS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label htmlFor="ex-date">Date</Label><Input id="ex-date" type="date" value={txnDate} onChange={(e) => setTxnDate(e.target.value)} /></div>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-xl">Metal lines</h2>
        <Card className="overflow-x-auto p-2">
          <Table>
            <TableHeader><TableRow><TableHead>Weight (g)</TableHead><TableHead>Touch %</TableHead><TableHead>Fine</TableHead><TableHead>Serial</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {rows.map((r, i) => (
                <TableRow key={r.key}>
                  <TableCell><Input className="w-24" type="number" step="0.001" aria-label="Weight" value={r.weight} onChange={(e) => setRow(i, 'weight', e.target.value)} /></TableCell>
                  <TableCell><Input className="w-20" type="number" step="0.01" aria-label="Touch" value={r.touch} onChange={(e) => setRow(i, 'touch', e.target.value)} /></TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">{fineOf(r).toFixed(3)}</TableCell>
                  <TableCell><Input className="w-28" aria-label="Serial" value={r.serialNo} onChange={(e) => setRow(i, 'serialNo', e.target.value)} /></TableCell>
                  <TableCell><Button variant="ghost" size="sm" aria-label="Remove line" disabled={rows.length === 1} onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}>✕</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
        <Button variant="outline" size="sm" onClick={() => setRows((rs) => [...rs, blankRow()])}>+ Add line</Button>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Settlement</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5"><Label htmlFor="ex-diff">± Fine adjust</Label><Input id="ex-diff" type="number" step="0.001" value={f.diffFine} onChange={(e) => set('diffFine', e.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="ex-rate">Rate ({metal === 'GOLD' ? '/10g' : '/kg'})</Label><Input id="ex-rate" type="number" value={f.rate} onChange={(e) => set('rate', e.target.value)} />
              {todayRate && <p className="text-xs text-muted-foreground tabular-nums">Today's fine {side === 'BUY' ? 'buy' : 'sell'} rate: {todayRate}</p>}
            </div>
            {moneyMode && <>
              <div className="space-y-1.5"><Label htmlFor="ex-charges">Charges ₹</Label><Input id="ex-charges" type="number" value={f.charges} onChange={(e) => set('charges', e.target.value)} /></div>
              <div className="space-y-1.5"><Label htmlFor="ex-disc">Discount ₹</Label><Input id="ex-disc" type="number" value={f.discount} onChange={(e) => set('discount', e.target.value)} /></div>
              <div className="sm:col-span-2 lg:col-span-3"><SplitToggle id="ex-split" checked={split} onChange={setSplit} /></div>
              {split ? (
                <div className="sm:col-span-2 lg:col-span-3"><SplitPaymentTable rows={pays} onChange={setPays} /></div>
              ) : <>
                <div className="space-y-1.5"><Label htmlFor="ex-cash">{side === 'BUY' ? 'Cash paid ₹' : 'Cash recd ₹'}</Label><Input id="ex-cash" type="number" value={f.cash} onChange={(e) => set('cash', e.target.value)} /></div>
                <div className="space-y-1.5"><Label htmlFor="ex-online">Online ₹</Label><Input id="ex-online" type="number" value={f.online} onChange={(e) => set('online', e.target.value)} /></div>
                {n(f.online) > 0 && (
                  <div className="space-y-1.5 sm:col-span-2"><Label>Bank</Label>
                    <Select value={f.bankAccountId} onValueChange={(v) => set('bankAccountId', v)}><SelectTrigger aria-label="Bank account"><SelectValue placeholder="Bank" /></SelectTrigger>
                      <SelectContent>{banks?.map((b) => <SelectItem key={b.id} value={String(b.id)}>{b.bankName} · {b.accountNo}</SelectItem>)}</SelectContent></Select>
                  </div>
                )}
              </>}
            </>}
            <div className="space-y-1.5 sm:col-span-2 lg:col-span-3"><Label htmlFor="ex-remark">Remark</Label><Input id="ex-remark" value={f.remark} onChange={(e) => set('remark', e.target.value)} /></div>
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader><CardTitle>Summary</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm tabular-nums">
            <div className="flex justify-between"><span className="text-muted-foreground">Total fine</span><span>{totalFine.toFixed(3)} g</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">After adjust</span><span className="font-medium">{afterFine.toFixed(3)} g</span></div>
            {moneyMode ? (
              <>
                <div className="flex justify-between border-t pt-2 text-base font-semibold"><span>Final amount</span><span>{inr(finalAmount)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Paid</span><span>{inr(paid)}</span></div>
                <div className="flex justify-between font-medium"><span>Balance ({side === 'BUY' ? 'shop owes' : 'party owes'})</span><span>{inr(Math.abs(balance))}</span></div>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">Rate 0 → settled as metal: {side === 'BUY' ? 'shop owes' : 'party owes'} {afterFine.toFixed(3)} g {metal} on the party account.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button className="w-full sm:w-auto" disabled={!valid || pending} onClick={() => void submit().catch(() => {})}>
          {pending ? 'Saving…' : editing ? 'Save changes' : `Save ${side === 'BUY' ? 'purchase' : 'sale'}`}
        </Button>
      </div>
      <MpinDialog open={askMpin} title={`Save changes to exchange #${editing?.exchangeNo ?? ''}`} onConfirm={saveEdit} onClose={() => setAskMpin(false)} />
    </div>
  )
}
