import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { PartyPicker } from '@/components/PartyPicker'
import { SelectBranchForTxn } from '@/components/SelectBranchForTxn'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useBankAccounts, useCurrentRates, useKarats, useSettings } from '@/lib/appQueries'
import { useAuth } from '@/lib/auth'
import { lineRateUnitGrams, metalRateUnitGrams } from '@/lib/billingQueries'
import { useItemNames } from '@/lib/inventoryQueries'
import { useCreateOrder } from '@/lib/ordersQueries'
import { CHARGE_UNITS, METALS, computeLine, metalToMoney, type PartyRefDto } from '@/shared'

let uid = 0
const k = () => `o${uid++}`
const today = () => new Date().toISOString().slice(0, 10)
const inr = (s: string | number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(s))
const n = (s: string) => Number(s) || 0

interface Row { key: string; itemNameId: string; metal: string; karatCode: string; touch: string; size: string; pcs: string; gross: string; less: string; wastage: string; making: string; makingUnit: string; other: string }
const blankRow = (): Row => ({ key: k(), itemNameId: '', metal: 'GOLD', karatCode: '', touch: '', size: '', pcs: '1', gross: '', less: '0', wastage: '0', making: '0', makingUnit: 'PER_GRAM', other: '0' })
interface PayRow { key: string; mode: string; amount: string; bankAccountId: string; metal: string; metalForm: string; gross: string; less: string; tunch: string; rate: string }
const blankPay = (mode: string): PayRow => ({ key: k(), mode, amount: '', bankAccountId: '', metal: 'GOLD', metalForm: 'BULLION', gross: '', less: '0', tunch: '', rate: '' })

export function NewOrder() {
  const navigate = useNavigate()
  const { activeBranch } = useAuth()
  const branchReady = activeBranch !== '' && activeBranch !== 'all'
  const { data: settings } = useSettings()
  const { data: banks } = useBankAccounts()
  const { data: karats } = useKarats()
  const { data: rates } = useCurrentRates()
  const { data: names } = useItemNames({ page: 1, pageSize: 100 })
  const create = useCreateOrder()

  const [party, setParty] = useState<PartyRefDto | null>(null)
  const [orderDate, setOrderDate] = useState(today())
  const [deliveryDate, setDeliveryDate] = useState('')
  const [rateType, setRateType] = useState('ON_DELIVERY')
  const [isUrgent, setIsUrgent] = useState(false)
  const [remark, setRemark] = useState('')
  const [rows, setRows] = useState<Row[]>([blankRow()])
  const [pays, setPays] = useState<PayRow[]>([])

  const setRow = (i: number, key: keyof Row, v: string) =>
    setRows((rs) => rs.map((r, j) => {
      if (j !== i) return r
      const next = { ...r, [key]: v }
      if (key === 'karatCode' && !r.touch) next.touch = karats?.find((kt) => kt.code === v)?.touch ?? ''
      return next
    }))

  const rateFor = (r: Row) => {
    const rows2 = r.metal === 'GOLD' ? rates?.gold.rows : rates?.silver.rows
    return Number(rows2?.find((x) => x.karatCode === r.karatCode)?.sellRate ?? 0)
  }
  const lineOf = (r: Row) =>
    computeLine({
      gross: n(r.gross), less: n(r.less), tunch: r.touch !== '' ? n(r.touch) : 100, wastage: n(r.wastage),
      rate: rateFor(r), rateUnitGrams: lineRateUnitGrams('SELL', r.metal, settings),
      labour: n(r.making), labourUnit: r.makingUnit as 'PER_GRAM', other: n(r.other),
      basis: (settings?.['calc.basis'].sale ?? 'NET') as 'NET',
    })
  const payAmount = (p: PayRow) => (p.mode === 'METAL' ? Number(metalToMoney(((n(p.gross) - n(p.less)) * n(p.tunch)) / 100, n(p.rate), metalRateUnitGrams(p.metal, settings))) : n(p.amount))
  const estTotal = rows.reduce((a, r) => a + Number(lineOf(r).total), 0)
  const advance = pays.reduce((a, p) => a + payAmount(p), 0)

  const valid = branchReady && !!party && rows.length > 0 && rows.every((r) => r.itemNameId && n(r.gross) > 0)

  const submit = async () => {
    const body = {
      partyId: party!.id, orderDate, deliveryDate: deliveryDate || undefined, rateType, isUrgent, remark: remark || undefined,
      items: rows.map((r) => ({ itemNameId: Number(r.itemNameId), metal: r.metal, karatCode: r.karatCode || undefined, touch: r.touch !== '' ? n(r.touch) : undefined, size: r.size || undefined, pcs: Number(r.pcs) || 1, gross: n(r.gross), less: n(r.less), wastage: n(r.wastage), making: n(r.making), makingUnit: r.makingUnit, other: n(r.other) })),
      payments: pays.map((p) => (p.mode === 'METAL' ? { mode: 'METAL', metal: p.metal, metalForm: p.metalForm, gross: n(p.gross), less: n(p.less), tunch: n(p.tunch), rate: n(p.rate) } : p.mode === 'ONLINE' ? { mode: 'ONLINE', amount: n(p.amount), bankAccountId: Number(p.bankAccountId) } : { mode: 'CASH', amount: n(p.amount) })),
    }
    const saved = await create.mutateAsync(body)
    navigate(`/app/orders/${saved.id}`)
  }

  return (
    <div className="space-y-5">
      {!branchReady && <SelectBranchForTxn note="An order is placed at one branch. Select a branch." />}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5 lg:col-span-2">
          <Label htmlFor="no-party">Customer</Label>
          <PartyPicker value={party} onChange={setParty} placeholder="Search name / mobile" id="no-party" ariaLabel="Customer" />
        </div>
        <div className="space-y-1.5"><Label htmlFor="no-date">Order date</Label><Input id="no-date" type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} /></div>
        <div className="space-y-1.5"><Label htmlFor="no-deliv">Delivery date</Label><Input id="no-deliv" type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} /></div>
        <div className="space-y-1.5">
          <Label>Rate type</Label>
          <Select value={rateType} onValueChange={setRateType}>
            <SelectTrigger aria-label="Rate type"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="ON_DELIVERY">On delivery</SelectItem><SelectItem value="FIXED">Fixed (today)</SelectItem></SelectContent>
          </Select>
        </div>
        <label className="flex items-center gap-2 pt-6 text-sm"><Checkbox checked={isUrgent} onCheckedChange={(c) => setIsUrgent(Boolean(c))} /> Urgent</label>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Metal</TableHead><TableHead className="min-w-40">Item</TableHead><TableHead>Karat</TableHead><TableHead>Size</TableHead><TableHead>Pcs</TableHead>
              <TableHead>Gross</TableHead><TableHead>Less</TableHead><TableHead>Touch</TableHead><TableHead>Wst%</TableHead><TableHead>Net</TableHead><TableHead>Fine</TableHead>
              <TableHead>Making</TableHead><TableHead>Unit</TableHead><TableHead>Other</TableHead><TableHead>Est.</TableHead><TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, i) => {
              const lr = lineOf(r)
              const itemOpts = (names?.items ?? []).filter((it) => it.group.stockClass === r.metal)
              return (
                <TableRow key={r.key}>
                  <TableCell>
                    <Select value={r.metal} onValueChange={(v) => setRow(i, 'metal', v)}>
                      <SelectTrigger className="w-24" aria-label="Metal"><SelectValue /></SelectTrigger>
                      <SelectContent>{METALS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select value={r.itemNameId} onValueChange={(v) => setRow(i, 'itemNameId', v)}>
                      <SelectTrigger className="w-40" aria-label="Item name"><SelectValue placeholder="Item" /></SelectTrigger>
                      <SelectContent>{itemOpts.map((it) => <SelectItem key={it.id} value={String(it.id)}>{it.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select value={r.karatCode} onValueChange={(v) => setRow(i, 'karatCode', v)}>
                      <SelectTrigger className="w-20" aria-label="Karat"><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>{karats?.filter((kt) => kt.metal === r.metal).map((kt) => <SelectItem key={kt.id} value={kt.code}>{kt.title}</SelectItem>)}</SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell><Input className="w-16" aria-label="Size" value={r.size} onChange={(e) => setRow(i, 'size', e.target.value)} /></TableCell>
                  <TableCell><Input className="w-14" type="number" aria-label="Pcs" value={r.pcs} onChange={(e) => setRow(i, 'pcs', e.target.value)} /></TableCell>
                  <TableCell><Input className="w-20" type="number" step="0.001" aria-label="Gross" value={r.gross} onChange={(e) => setRow(i, 'gross', e.target.value)} /></TableCell>
                  <TableCell><Input className="w-16" type="number" step="0.001" aria-label="Less" value={r.less} onChange={(e) => setRow(i, 'less', e.target.value)} /></TableCell>
                  <TableCell><Input className="w-16" type="number" step="0.01" aria-label="Touch" value={r.touch} onChange={(e) => setRow(i, 'touch', e.target.value)} /></TableCell>
                  <TableCell><Input className="w-14" type="number" step="0.01" aria-label="Wastage" value={r.wastage} onChange={(e) => setRow(i, 'wastage', e.target.value)} /></TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground tabular-nums">{lr.net}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground tabular-nums">{lr.fine}</TableCell>
                  <TableCell><Input className="w-20" type="number" aria-label="Making" value={r.making} onChange={(e) => setRow(i, 'making', e.target.value)} /></TableCell>
                  <TableCell>
                    <Select value={r.makingUnit} onValueChange={(v) => setRow(i, 'makingUnit', v)}>
                      <SelectTrigger className="w-28" aria-label="Making unit"><SelectValue /></SelectTrigger>
                      <SelectContent>{CHARGE_UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell><Input className="w-20" type="number" aria-label="Other" value={r.other} onChange={(e) => setRow(i, 'other', e.target.value)} /></TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums">{lr.total}</TableCell>
                  <TableCell><Button variant="ghost" size="sm" aria-label="Remove line" disabled={rows.length === 1} onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}>✕</Button></TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
      <Button variant="outline" size="sm" onClick={() => setRows((rs) => [...rs, blankRow()])}>+ Add item</Button>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold">Advance</h2>
            <div className="ml-auto flex gap-1">
              <Button type="button" size="sm" variant="outline" onClick={() => setPays((p) => [...p, blankPay('CASH')])}>+ Cash</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setPays((p) => [...p, blankPay('ONLINE')])}>+ Online</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setPays((p) => [...p, blankPay('METAL')])}>+ Metal</Button>
            </div>
          </div>
          {pays.map((p, i) => (
            <div key={p.key} className="flex flex-wrap items-end gap-2 rounded-md border p-2 tabular-nums">
              <span className="text-xs font-medium text-muted-foreground">{p.mode}</span>
              {p.mode === 'METAL' ? (
                <>
                  <Select value={p.metal} onValueChange={(v) => setPays((ps) => ps.map((x, j) => j === i ? { ...x, metal: v } : x))}>
                    <SelectTrigger className="w-24" aria-label="Metal"><SelectValue /></SelectTrigger>
                    <SelectContent>{METALS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input className="w-20" type="number" placeholder="Gross" aria-label="Gross" value={p.gross} onChange={(e) => setPays((ps) => ps.map((x, j) => j === i ? { ...x, gross: e.target.value } : x))} />
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
              <Button variant="ghost" size="sm" className="ml-auto" aria-label="Remove advance" onClick={() => setPays((ps) => ps.filter((_, j) => j !== i))}>✕</Button>
            </div>
          ))}
          <div className="space-y-1.5"><Label htmlFor="no-remark">Remark</Label><Input id="no-remark" value={remark} onChange={(e) => setRemark(e.target.value)} /></div>
        </div>

        <div className="space-y-2 rounded-md border p-4 text-sm tabular-nums">
          <div className="flex justify-between"><span className="text-muted-foreground">Estimated total</span><span className="font-semibold">{inr(estTotal)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Advance</span><span>{inr(advance)}</span></div>
          <p className="text-xs text-muted-foreground">Estimate uses today's rate; the server recomputes on create ({rateType === 'FIXED' ? 'rate fixed now' : 'final rate on delivery'}).</p>
          <Button className="w-full" disabled={!valid || create.isPending} onClick={() => void submit().catch(() => {})}>
            {create.isPending ? 'Saving…' : 'Create order'}
          </Button>
        </div>
      </div>
    </div>
  )
}
