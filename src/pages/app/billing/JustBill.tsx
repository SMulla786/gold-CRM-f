import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { PartyPicker } from '@/components/PartyPicker'
import { SelectBranchForTxn } from '@/components/SelectBranchForTxn'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useBankAccounts, useSettings } from '@/lib/appQueries'
import { useAuth } from '@/lib/auth'
import { metalRateUnitGrams } from '@/lib/billingQueries'
import { useCreateJustBill, useJustBillNextNo } from '@/lib/justbillQueries'
import { CHARGE_UNITS, DISCOUNT_UNITS, METALS, QTY_UNITS, computeBill, computeJustLine, metalToMoney, type PartyRefDto } from '@/shared'

let uid = 0
const k = () => `j${uid++}`
const today = () => new Date().toISOString().slice(0, 10)
const inr = (s: string | number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(s))
const n = (s: string) => Number(s) || 0

interface Row { key: string; name: string; karat: string; purity: string; quantity: string; unit: string; rate: string; making: string; makingUnit: string; other: string }
const blankRow = (): Row => ({ key: k(), name: '', karat: '', purity: '', quantity: '', unit: 'GRAM', rate: '0', making: '0', makingUnit: 'PER_GRAM', other: '0' })
interface PayRow { key: string; mode: string; amount: string; bankAccountId: string; metal: string; metalForm: string; gross: string; less: string; tunch: string; rate: string }
const blankPay = (mode: string): PayRow => ({ key: k(), mode, amount: '', bankAccountId: '', metal: 'GOLD', metalForm: 'KACHA', gross: '', less: '0', tunch: '', rate: '' })

export function JustBill() {
  const navigate = useNavigate()
  const { activeBranch } = useAuth()
  const branchReady = activeBranch !== '' && activeBranch !== 'all'
  const { data: settings } = useSettings()
  const { data: banks } = useBankAccounts()
  const create = useCreateJustBill()
  const { data: nextNo } = useJustBillNextNo(branchReady)

  const [party, setParty] = useState<PartyRefDto | null>(null)
  const [custName, setCustName] = useState('')
  const [custMobile, setCustMobile] = useState('')
  const [billDate, setBillDate] = useState(today())
  const [rows, setRows] = useState<Row[]>([blankRow()])
  const [discount, setDiscount] = useState('0')
  const [discountUnit, setDiscountUnit] = useState('FIXED')
  const [gstPercent, setGstPercent] = useState('0')
  const [pays, setPays] = useState<PayRow[]>([])
  const [remark, setRemark] = useState('')

  const setRow = (i: number, key: keyof Row, v: string) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [key]: v } : r)))

  const lineOf = (r: Row) => {
    try {
      return computeJustLine({ quantity: n(r.quantity), unit: r.unit as 'GRAM', rate: n(r.rate), making: n(r.making), makingUnit: r.makingUnit as 'PER_GRAM', other: n(r.other) })
    } catch {
      return { amount: '0.00', making: '0.00', total: '0.00' } // PER_GRAM making on a PCS line — switch the unit
    }
  }

  const payAmount = (p: PayRow): number => {
    if (p.mode === 'METAL') {
      const net = (n(p.gross) - n(p.less))
      return Number(metalToMoney((net * n(p.tunch)) / 100, n(p.rate), metalRateUnitGrams(p.metal, settings)))
    }
    return n(p.amount)
  }

  const bill = useMemo(
    () => computeBill({ lineTotals: rows.map((r) => lineOf(r).total), discount: n(discount), discountUnit: discountUnit as 'FIXED', gstPercent: n(gstPercent), interState: false, roundTo: 1 }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, discount, discountUnit, gstPercent],
  )
  const paid = pays.reduce((a, p) => a + payAmount(p), 0)
  const balanceDue = Number(bill.final) - paid

  const valid = branchReady && (!!party || !!custName.trim()) && rows.length > 0 && rows.every((r) => r.name.trim() && n(r.quantity) > 0)

  const submit = async () => {
    const body = {
      partyId: party?.id, customerName: party ? undefined : custName.trim() || undefined, mobile: party ? undefined : custMobile || undefined, billDate,
      items: rows.map((r) => ({ name: r.name.trim(), karat: r.karat || undefined, purity: r.purity !== '' ? n(r.purity) : undefined, quantity: n(r.quantity), unit: r.unit, rate: n(r.rate), making: n(r.making), makingUnit: r.makingUnit, other: n(r.other) })),
      discount: n(discount), discountUnit, gstPercent: n(gstPercent),
      payments: pays.map((p) =>
        p.mode === 'METAL'
          ? { mode: 'METAL', metal: p.metal, metalForm: p.metalForm, gross: n(p.gross), less: n(p.less), tunch: n(p.tunch), rate: n(p.rate) }
          : p.mode === 'ONLINE'
            ? { mode: 'ONLINE', amount: n(p.amount), bankAccountId: Number(p.bankAccountId) }
            : { mode: 'CASH', amount: n(p.amount) },
      ),
      remark: remark || undefined,
    }
    const saved = await create.mutateAsync(body)
    navigate(`/app/billing/just/view/${saved.id}`)
  }

  return (
    <div className="space-y-5">
      {!branchReady && <SelectBranchForTxn note="A Just Bill posts to one branch. Select a branch." />}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5 lg:col-span-2">
          <Label htmlFor="jb-party">Customer</Label>
          <PartyPicker value={party} onChange={setParty} placeholder="Search name / mobile" id="jb-party" ariaLabel="Customer" />
          {!party && (
            <div className="flex gap-2 pt-1">
              <Input placeholder="Walk-in name" aria-label="Walk-in name" value={custName} onChange={(e) => setCustName(e.target.value)} />
              <Input placeholder="Mobile" aria-label="Walk-in mobile" value={custMobile} onChange={(e) => setCustMobile(e.target.value)} />
            </div>
          )}
        </div>
        <div className="space-y-1.5"><Label>Bill no.</Label><Input value={nextNo?.billNo ?? '—'} readOnly aria-label="Bill number" /></div>
        <div className="space-y-1.5"><Label htmlFor="jb-date">Date</Label><Input id="jb-date" type="date" value={billDate} onChange={(e) => setBillDate(e.target.value)} /></div>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-40">Item</TableHead><TableHead>Karat</TableHead><TableHead>Purity</TableHead><TableHead>Qty</TableHead><TableHead>Unit</TableHead>
              <TableHead>Rate</TableHead><TableHead>Making</TableHead><TableHead>Unit</TableHead><TableHead>Other</TableHead><TableHead>Total</TableHead><TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={r.key}>
                <TableCell><Input className="w-40" aria-label="Item name" value={r.name} onChange={(e) => setRow(i, 'name', e.target.value)} /></TableCell>
                <TableCell><Input className="w-20" aria-label="Karat" value={r.karat} onChange={(e) => setRow(i, 'karat', e.target.value)} /></TableCell>
                <TableCell><Input className="w-16" type="number" aria-label="Purity" value={r.purity} onChange={(e) => setRow(i, 'purity', e.target.value)} /></TableCell>
                <TableCell><Input className="w-20" type="number" aria-label="Quantity" value={r.quantity} onChange={(e) => setRow(i, 'quantity', e.target.value)} /></TableCell>
                <TableCell>
                  <Select value={r.unit} onValueChange={(v) => setRow(i, 'unit', v)}>
                    <SelectTrigger className="w-20" aria-label="Quantity unit"><SelectValue /></SelectTrigger>
                    <SelectContent>{QTY_UNITS.map((u) => <SelectItem key={u} value={u}>{u === 'GRAM' ? 'g' : 'pcs'}</SelectItem>)}</SelectContent>
                  </Select>
                </TableCell>
                <TableCell><Input className="w-24" type="number" aria-label="Rate" value={r.rate} onChange={(e) => setRow(i, 'rate', e.target.value)} /></TableCell>
                <TableCell><Input className="w-20" type="number" aria-label="Making" value={r.making} onChange={(e) => setRow(i, 'making', e.target.value)} /></TableCell>
                <TableCell>
                  <Select value={r.makingUnit} onValueChange={(v) => setRow(i, 'makingUnit', v)}>
                    <SelectTrigger className="w-28" aria-label="Making unit"><SelectValue /></SelectTrigger>
                    <SelectContent>{CHARGE_UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                  </Select>
                </TableCell>
                <TableCell><Input className="w-20" type="number" aria-label="Other" value={r.other} onChange={(e) => setRow(i, 'other', e.target.value)} /></TableCell>
                <TableCell className="whitespace-nowrap font-medium tabular-nums">{lineOf(r).total}</TableCell>
                <TableCell><Button variant="ghost" size="sm" aria-label="Remove line" disabled={rows.length === 1} onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}>✕</Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Button variant="outline" size="sm" onClick={() => setRows((rs) => [...rs, blankRow()])}>+ Add line</Button>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold">Payments</h2>
            <div className="ml-auto flex gap-1">
              <Button type="button" size="sm" variant="outline" onClick={() => setPays((p) => [...p, blankPay('CASH')])}>+ Cash</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setPays((p) => [...p, blankPay('ONLINE')])}>+ Online</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setPays((p) => [...p, blankPay('METAL')])}>+ Old gold/metal</Button>
            </div>
          </div>
          {pays.map((p, i) => (
            <div key={p.key} className="flex flex-wrap items-end gap-2 rounded-md border p-2 tabular-nums">
              <span className="text-xs font-medium text-muted-foreground">{p.mode === 'METAL' ? 'OLD METAL' : p.mode}</span>
              {p.mode === 'METAL' ? (
                <>
                  <Select value={p.metal} onValueChange={(v) => setPays((ps) => ps.map((x, j) => j === i ? { ...x, metal: v } : x))}>
                    <SelectTrigger className="w-24" aria-label="Metal"><SelectValue /></SelectTrigger>
                    <SelectContent>{METALS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input className="w-20" type="number" placeholder="Gross" aria-label="Gross" value={p.gross} onChange={(e) => setPays((ps) => ps.map((x, j) => j === i ? { ...x, gross: e.target.value } : x))} />
                  <Input className="w-16" type="number" placeholder="Less" aria-label="Less" value={p.less} onChange={(e) => setPays((ps) => ps.map((x, j) => j === i ? { ...x, less: e.target.value } : x))} />
                  <Input className="w-16" type="number" placeholder="Tunch" aria-label="Tunch" value={p.tunch} onChange={(e) => setPays((ps) => ps.map((x, j) => j === i ? { ...x, tunch: e.target.value } : x))} />
                  <Input className="w-24" type="number" placeholder="Rate" aria-label="Rate" value={p.rate} onChange={(e) => setPays((ps) => ps.map((x, j) => j === i ? { ...x, rate: e.target.value } : x))} />
                  <span className="text-sm">= {inr(payAmount(p))}</span>
                </>
              ) : (
                <>
                  <Input className="w-28" type="number" placeholder="Amount" aria-label="Amount" value={p.amount} onChange={(e) => setPays((ps) => ps.map((x, j) => j === i ? { ...x, amount: e.target.value } : x))} />
                  {p.mode === 'ONLINE' && (
                    <Select value={p.bankAccountId} onValueChange={(v) => setPays((ps) => ps.map((x, j) => j === i ? { ...x, bankAccountId: v } : x))}>
                      <SelectTrigger className="w-44" aria-label="Bank account"><SelectValue placeholder="Bank" /></SelectTrigger>
                      <SelectContent>{banks?.map((b) => <SelectItem key={b.id} value={String(b.id)}>{b.bankName} · {b.accountNo}</SelectItem>)}</SelectContent>
                    </Select>
                  )}
                </>
              )}
              <Button variant="ghost" size="sm" className="ml-auto" aria-label="Remove payment" onClick={() => setPays((ps) => ps.filter((_, j) => j !== i))}>✕</Button>
            </div>
          ))}
          <div className="space-y-1.5"><Label htmlFor="jb-remark">Remark</Label><Input id="jb-remark" value={remark} onChange={(e) => setRemark(e.target.value)} /></div>
        </div>

        <div className="space-y-2 rounded-md border p-4 text-sm tabular-nums">
          <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{inr(bill.sub)}</span></div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Discount</span>
            <Input className="ml-auto w-24" type="number" aria-label="Bill discount" value={discount} onChange={(e) => setDiscount(e.target.value)} />
            <Select value={discountUnit} onValueChange={setDiscountUnit}>
              <SelectTrigger className="w-16" aria-label="Bill discount unit"><SelectValue /></SelectTrigger>
              <SelectContent>{DISCOUNT_UNITS.map((u) => <SelectItem key={u} value={u}>{u === 'FIXED' ? '₹' : '%'}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">GST %</span>
            <Input className="ml-auto w-24" type="number" aria-label="GST percent" value={gstPercent} onChange={(e) => setGstPercent(e.target.value)} />
          </div>
          <div className="flex justify-between border-t pt-2 text-base font-semibold"><span>Final</span><span>{inr(bill.final)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Paid</span><span>{inr(paid)}</span></div>
          <div className="flex justify-between font-medium"><span>Balance</span><span className={balanceDue < 0 ? 'text-green-600 dark:text-green-500' : ''}>{inr(balanceDue)}</span></div>
          {!party && balanceDue !== 0 && <p className="text-xs text-destructive">A walk-in bill must be fully paid — link a party to carry a balance.</p>}
          <Button className="w-full" disabled={!valid || create.isPending} onClick={() => void submit().catch(() => {})}>
            {create.isPending ? 'Saving…' : 'Save Just Bill'}
          </Button>
        </div>
      </div>
    </div>
  )
}
