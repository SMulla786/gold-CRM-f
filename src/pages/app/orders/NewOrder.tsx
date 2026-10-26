import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { PartyPicker } from '@/components/PartyPicker'
import { SelectBranchForTxn } from '@/components/SelectBranchForTxn'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useBankAccounts, useCurrentRates, useKarats, useSettings } from '@/lib/appQueries'
import { useAuth } from '@/lib/auth'
import { lineRateUnitGrams, metalRateUnitGrams, usePartyBalance } from '@/lib/billingQueries'
import { useItemNames, useJewelleryTypes } from '@/lib/inventoryQueries'
import { useCreateOrder, useNextOrderNo, useUploadOrderDesign } from '@/lib/ordersQueries'
import { businessDayISO, CHARGE_UNITS, METALS, computeLine, metalToMoney, type PartyRefDto } from '@/shared'

let uid = 0
const k = () => `o${uid++}`
const today = businessDayISO
const inr = (s: string | number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(s))
const n = (s: string) => Number(s) || 0

interface Row { key: string; itemNameId: string; metal: string; karatCode: string; touch: string; size: string; pcs: string; gross: string; less: string; wastage: string; making: string; makingUnit: string; other: string; labour: string; wastageGm: string; jewelleryTypeId: string }
const blankRow = (): Row => ({ key: k(), itemNameId: '', metal: 'GOLD', karatCode: '', touch: '', size: '', pcs: '1', gross: '', less: '0', wastage: '0', making: '0', makingUnit: 'PER_GRAM', other: '0', labour: '0', wastageGm: '0', jewelleryTypeId: '' })
interface PayRow { key: string; mode: string; amount: string; bankAccountId: string; metal: string; metalForm: string; gross: string; less: string; tunch: string; rate: string }
const blankPay = (mode: string): PayRow => ({ key: k(), mode, amount: '', bankAccountId: '', metal: 'GOLD', metalForm: 'BULLION', gross: '', less: '0', tunch: '', rate: '' })

export function NewOrder() {
  const navigate = useNavigate()
  const { activeBranch, can } = useAuth()
  const branchReady = activeBranch !== '' && activeBranch !== 'all'
  // TASK-98 preview of the next order no. (a peek, not reserved); hidden without permission or on error
  const nextNo = useNextOrderNo(branchReady && can('orders.create', 'view'), activeBranch)
  const { data: settings } = useSettings()
  const { data: banks } = useBankAccounts()
  const { data: karats } = useKarats()
  const { data: rates } = useCurrentRates()
  const { data: names } = useItemNames({ page: 1, pageSize: 100 })
  const { data: jewelleryTypes } = useJewelleryTypes()
  const create = useCreateOrder()
  const uploadDesign = useUploadOrderDesign()

  const [party, setParty] = useState<PartyRefDto | null>(null)
  const [orderDate, setOrderDate] = useState(today())
  const [deliveryDate, setDeliveryDate] = useState('')
  const [rateType, setRateType] = useState('ON_DELIVERY')
  const [isUrgent, setIsUrgent] = useState(false)
  const [remark, setRemark] = useState('')
  const [rows, setRows] = useState<Row[]>([blankRow()])
  const [pays, setPays] = useState<PayRow[]>([])
  const [miscCharges, setMiscCharges] = useState('')
  const [goldOverride, setGoldOverride] = useState('')
  const [silverOverride, setSilverOverride] = useState('')
  const [design, setDesign] = useState<File | null>(null)

  const setRow = (i: number, key: keyof Row, v: string) =>
    setRows((rs) => rs.map((r, j) => {
      if (j !== i) return r
      const next = { ...r, [key]: v }
      if (key === 'karatCode' && !r.touch) next.touch = karats?.find((kt) => kt.code === v)?.touch ?? ''
      return next
    }))

  const override = (metal: string) => (metal === 'GOLD' ? goldOverride : silverOverride)
  const todayRate = (metal: string) => (metal === 'GOLD' ? rates?.gold.rows[0]?.sellRate : rates?.silver.rows[0]?.sellRate) ?? ''
  // same as the server: one override per metal, else today's sell rate for the karat (first row when no karat match)
  const rateFor = (r: Row) => {
    if (override(r.metal) !== '') return n(override(r.metal))
    const rows2 = r.metal === 'GOLD' ? rates?.gold.rows : rates?.silver.rows
    return Number((rows2?.find((x) => x.karatCode === r.karatCode) ?? rows2?.[0])?.sellRate ?? 0)
  }
  const basis = settings?.['calc.basis'].sale ?? 'NET'
  const lineOf = (r: Row) => {
    const rate = rateFor(r)
    const unit = lineRateUnitGrams('SELL', r.metal, settings)
    const base = computeLine({
      gross: n(r.gross), less: n(r.less), tunch: r.touch !== '' ? n(r.touch) : 100, wastage: n(r.wastage),
      rate, rateUnitGrams: unit,
      labour: n(r.making), labourUnit: r.makingUnit as 'PER_GRAM', other: n(r.other),
      basis: basis as 'NET',
    })
    // server's orderLineExtras: wastage g adds to fine (and to the metal value only on a FINE sale basis); labour is a flat ₹
    const wGm = n(r.wastageGm)
    const wMetal = basis === 'FINE' && unit > 0 ? (wGm * rate) / unit : 0
    return { ...base, fine: (Number(base.fine) + wGm).toFixed(3), total: (Number(base.total) + wMetal + n(r.labour)).toFixed(2) }
  }
  const payAmount = (p: PayRow) => (p.mode === 'METAL' ? Number(metalToMoney(((n(p.gross) - n(p.less)) * n(p.tunch)) / 100, n(p.rate), metalRateUnitGrams(p.metal, settings))) : n(p.amount))
  const payFine = (p: PayRow) => ((n(p.gross) - n(p.less)) * n(p.tunch)) / 100
  const estTotal = rows.reduce((a, r) => a + Number(lineOf(r).total), 0) + n(miscCharges)
  const advance = pays.reduce((a, p) => a + payAmount(p), 0)
  const balanceAfterAdvance = estTotal - advance
  // read-only totals panel (display only; the server recomputes on create)
  const totalPcs = rows.reduce((a, r) => a + (Number(r.pcs) || 0), 0)
  const totalMaking = rows.reduce((a, r) => a + Number(lineOf(r).labourAmount), 0)
  const totalLabour = rows.reduce((a, r) => a + n(r.labour), 0)
  const fineOf = (metal: string) => rows.filter((r) => r.metal === metal).reduce((a, r) => a + Number(lineOf(r).fine), 0)
  const { data: partyBal } = usePartyBalance(party?.id)

  const valid = branchReady && !!party && rows.length > 0 && rows.every((r) => r.itemNameId && n(r.gross) > 0)

  const submit = async () => {
    const body = {
      partyId: party!.id, orderDate, deliveryDate: deliveryDate || undefined, rateType, isUrgent, remark: remark || undefined,
      items: rows.map((r) => ({ itemNameId: Number(r.itemNameId), metal: r.metal, karatCode: r.karatCode || undefined, touch: r.touch !== '' ? n(r.touch) : undefined, size: r.size || undefined, pcs: Number(r.pcs) || 1, gross: n(r.gross), less: n(r.less), wastage: n(r.wastage), making: n(r.making), makingUnit: r.makingUnit, other: n(r.other), labour: n(r.labour) || undefined, wastageGm: n(r.wastageGm) || undefined, jewelleryTypeId: r.jewelleryTypeId ? Number(r.jewelleryTypeId) : undefined })),
      miscCharges: n(miscCharges) || undefined,
      goldRate: goldOverride !== '' ? n(goldOverride) : undefined,
      silverRate: silverOverride !== '' ? n(silverOverride) : undefined,
      payments: pays.map((p) => (p.mode === 'METAL' ? { mode: 'METAL', metal: p.metal, metalForm: p.metalForm, gross: n(p.gross), less: n(p.less), tunch: n(p.tunch), rate: n(p.rate) } : p.mode === 'ONLINE' ? { mode: 'ONLINE', amount: n(p.amount), bankAccountId: Number(p.bankAccountId) } : { mode: 'CASH', amount: n(p.amount) })),
    }
    const saved = await create.mutateAsync(body)
    // the order exists now: a failed design upload (toast shown) must not block navigation or invite a duplicate create
    if (design) await uploadDesign.mutateAsync({ id: saved.id, file: design }).catch(() => {})
    navigate(`/app/orders/${saved.id}`)
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl">Place an order</h2>
          <p className="text-sm text-muted-foreground">Book a made-to-order piece, take an advance and confirm the estimate.</p>
        </div>
        {nextNo.data && !nextNo.isError && (
          <div id="no-next-no" className="rounded-2xl bg-muted px-4 py-2 text-right" aria-live="polite">
            <div className="text-sm font-semibold tabular-nums">Order no. #{nextNo.data.nextNo} (preview)</div>
            <p className="text-xs text-muted-foreground">The final number is assigned on save.</p>
          </div>
        )}
      </div>

      {!branchReady && <SelectBranchForTxn note="An order is placed at one branch. Select a branch." />}

      <Card>
        <CardHeader><CardTitle>Order details</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="no-party">Customer</Label>
            <PartyPicker value={party} onChange={setParty} placeholder="Search name / mobile" id="no-party" ariaLabel="Customer" />
            {party && (
              <p className="w-fit rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground tabular-nums">
                Existing udhar: {partyBal ? `${inr(partyBal.amount)}${Number(partyBal.amount) < 0 ? ' (advance)' : ''} · ${partyBal.gold}g gold · ${partyBal.silver}g silver` : '—'}
              </p>
            )}
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
          <label className="flex items-center gap-2 text-sm sm:pt-6"><Checkbox checked={isUrgent} onCheckedChange={(c) => setIsUrgent(Boolean(c))} /> Urgent</label>
          <div className="space-y-1.5"><Label htmlFor="no-misc">Misc charges ₹</Label><Input id="no-misc" type="number" min="0" placeholder="0" value={miscCharges} onChange={(e) => setMiscCharges(e.target.value)} /></div>
          {/* labels must not contain the word "rate": e2e uses getByRole(..., { name: 'Rate' }) substring matches */}
          <div className="space-y-1.5"><Label htmlFor="no-gold-override">Gold ₹/unit override</Label><Input id="no-gold-override" type="number" min="0" placeholder={todayRate('GOLD')} value={goldOverride} onChange={(e) => setGoldOverride(e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="no-silver-override">Silver ₹/unit override</Label><Input id="no-silver-override" type="number" min="0" placeholder={todayRate('SILVER')} value={silverOverride} onChange={(e) => setSilverOverride(e.target.value)} /></div>
          <div className="space-y-1.5 sm:col-span-2 lg:col-span-3"><Label htmlFor="no-remark">Remark</Label><Input id="no-remark" value={remark} onChange={(e) => setRemark(e.target.value)} /></div>
          <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
            <Label htmlFor="no-design">Design file (optional)</Label>
            <Input id="no-design" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => setDesign(e.target.files?.[0] ?? null)} />
            <p className="text-xs text-muted-foreground">Image or PDF, up to 2 MB. Uploaded right after the order is created.</p>
          </div>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-xl">Pieces to make</h2>
        <Card className="overflow-x-auto p-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Metal</TableHead><TableHead className="min-w-40">Item</TableHead><TableHead>Type</TableHead><TableHead>Karat</TableHead><TableHead>Size</TableHead><TableHead>Pcs</TableHead>
                <TableHead>Gross</TableHead><TableHead>Less</TableHead><TableHead>Touch</TableHead><TableHead>Wst%</TableHead><TableHead>Wst g</TableHead><TableHead>Net</TableHead><TableHead>Fine</TableHead>
                <TableHead>Making</TableHead><TableHead>Unit</TableHead><TableHead>Other</TableHead><TableHead>Labour ₹</TableHead><TableHead>Est.</TableHead><TableHead />
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
                      <Select value={r.jewelleryTypeId || 'none'} onValueChange={(v) => setRow(i, 'jewelleryTypeId', v === 'none' ? '' : v)}>
                        <SelectTrigger className="w-32" aria-label="Jewellery type"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">—</SelectItem>
                          {jewelleryTypes?.filter((jt) => !jt.stockClass || jt.stockClass === r.metal).map((jt) => <SelectItem key={jt.id} value={String(jt.id)}>{jt.name}</SelectItem>)}
                        </SelectContent>
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
                    <TableCell><Input className="w-16" type="number" step="0.001" min="0" aria-label="Wastage g" value={r.wastageGm} onChange={(e) => setRow(i, 'wastageGm', e.target.value)} /></TableCell>
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
                    <TableCell><Input className="w-20" type="number" min="0" aria-label="Labour ₹" value={r.labour} onChange={(e) => setRow(i, 'labour', e.target.value)} /></TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">{lr.total}</TableCell>
                    <TableCell><Button variant="ghost" size="sm" aria-label="Remove line" disabled={rows.length === 1} onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}>✕</Button></TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </Card>
        <Button variant="outline" size="sm" onClick={() => setRows((rs) => [...rs, blankRow()])}>+ Add item</Button>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="space-y-3 pt-6">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl">Advance</h2>
              <div className="ml-auto flex flex-wrap gap-1">
                <Button type="button" size="sm" variant="outline" onClick={() => setPays((p) => [...p, blankPay('CASH')])}>+ Cash</Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setPays((p) => [...p, blankPay('ONLINE')])}>+ Online</Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setPays((p) => [...p, blankPay('METAL')])}>+ Metal</Button>
              </div>
            </div>
            {pays.map((p, i) => (
              <div key={p.key} className="flex flex-wrap items-end gap-2 rounded-2xl border bg-muted/40 p-3 tabular-nums">
                <span className="text-xs font-medium text-muted-foreground">{p.mode}</span>
                {p.mode === 'METAL' ? (
                  <>
                    <Select value={p.metal} onValueChange={(v) => setPays((ps) => ps.map((x, j) => j === i ? { ...x, metal: v } : x))}>
                      <SelectTrigger className="w-24" aria-label="Metal"><SelectValue /></SelectTrigger>
                      <SelectContent>{METALS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={p.metalForm} onValueChange={(v) => setPays((ps) => ps.map((x, j) => j === i ? { ...x, metalForm: v } : x))}>
                      <SelectTrigger className="w-28" aria-label="Metal form"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="BULLION">Bullion</SelectItem><SelectItem value="KACHA">Kacha</SelectItem></SelectContent>
                    </Select>
                    <Input className="w-20" type="number" placeholder="Gross" aria-label="Gross" value={p.gross} onChange={(e) => setPays((ps) => ps.map((x, j) => j === i ? { ...x, gross: e.target.value } : x))} />
                    <Input className="w-16" type="number" step="0.001" placeholder="Less" aria-label="Metal less" value={p.less} onChange={(e) => setPays((ps) => ps.map((x, j) => j === i ? { ...x, less: e.target.value } : x))} />
                    <Input className="w-16" type="number" placeholder="Tunch" aria-label="Tunch" value={p.tunch} onChange={(e) => setPays((ps) => ps.map((x, j) => j === i ? { ...x, tunch: e.target.value } : x))} />
                    <Input className="w-24" type="number" placeholder="Rate" aria-label="Rate" value={p.rate} onChange={(e) => setPays((ps) => ps.map((x, j) => j === i ? { ...x, rate: e.target.value } : x))} />
                    <span className="text-xs text-muted-foreground">{payFine(p).toFixed(3)} g fine</span>
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
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 pt-6 text-sm tabular-nums">
            <div className="flex flex-wrap items-baseline justify-between gap-2"><span className="text-muted-foreground">Estimated total</span><span className="text-2xl font-extrabold tracking-tight sm:text-3xl">{inr(estTotal)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Total items</span><span>{rows.length} line{rows.length === 1 ? '' : 's'} · {totalPcs} pcs</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Total making</span><span>{inr(totalMaking)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Labour · misc charges</span><span>{inr(totalLabour)} · {inr(n(miscCharges))}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Total fine</span><span>{fineOf('GOLD').toFixed(3)} g gold · {fineOf('SILVER').toFixed(3)} g silver</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Advance</span><span>{inr(advance)}</span></div>
            <div className="flex justify-between border-t pt-3"><span className="text-muted-foreground">Balance after advance</span><span className="font-semibold">{inr(balanceAfterAdvance)}</span></div>
            <p className="text-xs text-muted-foreground">Estimate uses today's rate{goldOverride !== '' || silverOverride !== '' ? ' (or your override)' : ''}; the server recomputes on create ({rateType === 'FIXED' ? 'rate fixed now' : 'final rate on delivery'}).</p>
            <div className="flex justify-end pt-2">
              <Button disabled={!valid || create.isPending} onClick={() => void submit().catch(() => void nextNo.refetch())}>
                {create.isPending ? 'Saving…' : 'Create order'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
