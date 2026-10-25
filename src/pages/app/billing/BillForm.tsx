import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

import { PartyPicker } from '@/components/PartyPicker'
import { SelectBranchForTxn } from '@/components/SelectBranchForTxn'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useBankAccounts, useKarats, useSettings } from '@/lib/appQueries'
import { useAuth } from '@/lib/auth'
import { ApiException } from '@/lib/errors'
import { lineRateUnitGrams, metalRateUnitGrams, useCreateBill, useNextBillNo, usePartyBalance } from '@/lib/billingQueries'
import { useItemNames, useStock } from '@/lib/inventoryQueries'
import {
  BILL_TYPES,
  CHARGE_UNITS,
  DISCOUNT_UNITS,
  KEEP_BALANCE_AS,
  METALS,
  STOCK_CLASSES,
  computeBill,
  computeLine,
  metalToMoney,
  moneyToMetal,
  type BillKind,
  type PartyRefDto,
  type StockItemDto,
} from '@/shared'

let uid = 0
const nextKey = () => `k${uid++}`
const today = () => new Date().toISOString().slice(0, 10)
const inr = (s: string | number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(s))

interface Row {
  key: string
  stockItemId?: number
  itemNameId?: number
  description: string
  stockClass: string
  tagNo: string
  karatCode: string
  pcs: string
  gross: string
  less: string
  tunch: string
  wastage: string
  stoneCharge: string
  rate: string
  labour: string
  labourUnit: string
  other: string
  discount: string
  discountUnit: string
  /** TAG stock item → weights come from the item, grid is read-only */
  locked: boolean
}
const blankRow = (over: Partial<Row>): Row => ({
  key: nextKey(), description: '', stockClass: 'GOLD', tagNo: '', karatCode: '', pcs: '1', gross: '', less: '0', tunch: '',
  wastage: '0', stoneCharge: '0', rate: '0', labour: '0', labourUnit: 'PER_GRAM', other: '0', discount: '0', discountUnit: 'FIXED', locked: false, ...over,
})
const rowFromStock = (it: StockItemDto): Row =>
  blankRow({
    stockItemId: it.id, itemNameId: it.itemName.id, description: it.itemName.name, stockClass: it.stockClass, tagNo: it.tagNo ?? '',
    karatCode: it.karatCode ?? '', pcs: String(it.pcs), gross: it.gross, less: it.less, tunch: it.tunch, wastage: it.wastage,
    stoneCharge: it.stoneCharge, labour: it.labour, labourUnit: it.labourUnit, other: it.other, locked: it.method === 'TAG',
  })

interface PayRow {
  key: string
  mode: string
  amount: string
  bankAccountId: string
  metal: string
  metalForm: string
  gross: string
  less: string
  tunch: string
  rate: string
  remark: string
}
const blankPay = (mode: string): PayRow => ({ key: nextKey(), mode, amount: '', bankAccountId: '', metal: 'GOLD', metalForm: 'BULLION', gross: '', less: '0', tunch: '', rate: '', remark: '' })

export function BillForm({ kind }: { kind: BillKind }) {
  const navigate = useNavigate()
  const { activeBranch } = useAuth()
  const branchReady = activeBranch !== '' && activeBranch !== 'all' // a bill posts to one branch (X-Branch-Id)
  const { data: settings } = useSettings()
  const { data: banks } = useBankAccounts()
  const { data: karats } = useKarats()
  const create = useCreateBill()

  const [searchParams] = useSearchParams()
  const [billType, setBillType] = useState(searchParams.get('type') === 'ROUGH' ? 'ROUGH' : 'GST') // seed from Quick Billing deep-link
  const [party, setParty] = useState<PartyRefDto | null>(null)
  const [billDate, setBillDate] = useState(today())
  const [dueDate, setDueDate] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  const [discount, setDiscount] = useState('0')
  const [discountUnit, setDiscountUnit] = useState('FIXED')
  const [gstPercent, setGstPercent] = useState('3')
  const [pays, setPays] = useState<PayRow[]>([])
  const [keepAs, setKeepAs] = useState('MONEY')
  const [keepRate, setKeepRate] = useState('')
  const [rateLimitLine, setRateLimitLine] = useState<number | null>(null)
  const [panOpen, setPanOpen] = useState(false)
  const [pan, setPan] = useState('')

  const { data: balance } = usePartyBalance(party?.id)
  const { data: nextNo } = useNextBillNo(kind, billType, branchReady)

  // ── SELL: stock search to add lines ──
  const [stockQ, setStockQ] = useState('')
  const { data: stockHits } = useStock({ q: stockQ || undefined, status: 'AVAILABLE', pageSize: 8 })

  // ── PURCHASE: pick class + item name to add a line ──
  const [buyClass, setBuyClass] = useState('GOLD')
  const [buyItemId, setBuyItemId] = useState('')
  const { data: buyNames } = useItemNames({ stockClass: buyClass, page: 1 })

  const basis = (settings?.['calc.basis'][kind === 'SELL' ? 'sale' : 'purchase'] ?? 'NET')

  const setRow = (i: number, k: keyof Row, v: string) =>
    setRows((rs) => rs.map((r, j) => {
      if (j !== i) return r
      const next = { ...r, [k]: v }
      if (k === 'karatCode' && !r.tunch) next.tunch = karats?.find((kt) => kt.code === v)?.touch ?? ''
      return next
    }))

  const lineOf = (r: Row) =>
    computeLine({
      // blank tunch → 100 to match the server's fallback (karat pick already fills it); stock rows are prefilled.
      gross: Number(r.gross) || 0, less: Number(r.less) || 0, tunch: r.tunch !== '' ? Number(r.tunch) : 100, wastage: Number(r.wastage) || 0,
      stoneCharge: Number(r.stoneCharge) || 0, rate: Number(r.rate) || 0, rateUnitGrams: lineRateUnitGrams(kind, r.stockClass, settings),
      labour: Number(r.labour) || 0, labourUnit: r.labourUnit as 'PER_GRAM', other: Number(r.other) || 0,
      discount: Number(r.discount) || 0, discountUnit: r.discountUnit as 'FIXED', basis: basis as 'NET',
    })

  const payAmount = (p: PayRow): number => {
    if (p.mode === 'METAL') {
      const net = (Number(p.gross) || 0) - (Number(p.less) || 0)
      const fine = (net * (Number(p.tunch) || 0)) / 100
      return Number(metalToMoney(fine, Number(p.rate) || 0, metalRateUnitGrams(p.metal, settings)))
    }
    return Number(p.amount) || 0
  }

  const bill = useMemo(() => {
    const metalPaid = pays.filter((p) => p.mode === 'METAL').reduce((a, p) => a + payAmount(p), 0)
    const gstEx = settings?.[kind === 'SELL' ? 'invoice.sale' : 'invoice.purchase'].gstOnRemainingMetal ? metalPaid : 0
    return computeBill({
      lineTotals: rows.map((r) => lineOf(r).total), discount: Number(discount) || 0, discountUnit: discountUnit as 'FIXED',
      gstPercent: billType === 'ROUGH' ? 0 : Number(gstPercent) || 0, interState: false, gstExemptAmount: gstEx, roundTo: 1,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, discount, discountUnit, gstPercent, billType, pays, settings, kind])

  const paid = pays.reduce((a, p) => a + payAmount(p), 0)
  const balanceDue = Number(bill.final) - paid
  const keepMetalWeight = keepAs !== 'MONEY' && balanceDue > 0 ? moneyToMetal(balanceDue, Number(keepRate) || 0, metalRateUnitGrams(keepAs, settings)) : null

  const addStock = (it: StockItemDto) => {
    if (rows.some((r) => r.stockItemId === it.id)) { toast.error('Item already on the bill'); return }
    setRows((rs) => [...rs, rowFromStock(it)])
    setStockQ('')
  }
  const addPurchaseRow = () => {
    const n = buyNames?.items.find((x) => String(x.id) === buyItemId)
    if (!n) { toast.error('Pick an item name'); return }
    setRows((rs) => [...rs, blankRow({ itemNameId: n.id, description: n.name, stockClass: buyClass })])
  }

  const valid = branchReady && !!party && rows.length > 0 && rows.every((r) => Number(r.gross) > 0 && (r.stockItemId || r.itemNameId || (r.description && r.stockClass)))

  const submit = async (panValue?: string) => {
    if (!party) return
    setRateLimitLine(null)
    const body: Record<string, unknown> = {
      kind, billType, partyId: party.id, billDate, dueDate: dueDate || undefined,
      items: rows.map((r) => ({
        stockItemId: r.stockItemId, itemNameId: r.itemNameId,
        description: r.stockItemId ? undefined : r.description || undefined,
        stockClass: r.stockClass, tagNo: kind === 'PURCHASE' && r.tagNo ? r.tagNo : undefined,
        karatCode: r.karatCode || undefined, pcs: Number(r.pcs) || 1, gross: Number(r.gross) || 0, less: Number(r.less) || 0,
        tunch: r.tunch !== '' ? Number(r.tunch) : undefined, wastage: Number(r.wastage) || 0, stoneCharge: Number(r.stoneCharge) || 0,
        rate: Number(r.rate) || 0, labour: Number(r.labour) || 0, labourUnit: r.labourUnit, other: Number(r.other) || 0,
        discount: Number(r.discount) || 0, discountUnit: r.discountUnit,
      })),
      discount: Number(discount) || 0, discountUnit, gstPercent: Number(gstPercent) || 0,
      payments: pays.map((p) =>
        p.mode === 'METAL'
          ? { mode: 'METAL', metal: p.metal, metalForm: p.metalForm, gross: Number(p.gross) || 0, less: Number(p.less) || 0, tunch: Number(p.tunch) || 0, rate: Number(p.rate) || 0, remark: p.remark || undefined }
          : p.mode === 'ONLINE'
            ? { mode: 'ONLINE', amount: Number(p.amount) || 0, bankAccountId: Number(p.bankAccountId), remark: p.remark || undefined }
            : { mode: 'CASH', amount: Number(p.amount) || 0, remark: p.remark || undefined },
      ),
      keepBalanceAs: keepAs, keepRate: keepAs === 'MONEY' ? undefined : Number(keepRate) || undefined,
      pan: panValue || undefined,
    }
    try {
      const saved = await create.mutateAsync(body)
      toast.success('Bill saved')
      navigate(`/app/billing/view/${saved.id}`)
    } catch (e) {
      if (e instanceof ApiException && e.code === 'VALIDATION') {
        const d = e.details as { code?: string; line?: number } | undefined
        if (d?.code === 'PAN_REQUIRED') { setPanOpen(true); return }
        if (d?.code === 'RATE_LIMIT') { setRateLimitLine(d.line ?? null); toast.error(`Line ${(d.line ?? 0) + 1}: rate outside the allowed limit`); return }
      }
      toast.error(e instanceof ApiException ? e.message : 'Could not save bill')
    }
  }

  const metalRow = (r: Row) => r.stockClass === 'GOLD' || r.stockClass === 'SILVER'

  return (
    <div className="space-y-5">
      {!branchReady && <SelectBranchForTxn note="This bill posts to one branch. Select a branch to bill from." />}

      {/* Header */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5 lg:col-span-2">
          <Label>{kind === 'SELL' ? 'Customer' : 'Supplier'}</Label>
          <PartyPicker value={party} onChange={setParty} placeholder="Search name / mobile" />
          {party && (
            <p className="text-xs text-muted-foreground">
              {party.mobile}
              {balance && ` · balance ₹${balance.amount}${Number(balance.gold) ? ` · ${balance.gold}g Au` : ''}${Number(balance.silver) ? ` · ${balance.silver}g Ag` : ''}`}
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label>Type</Label>
          <Select value={billType} onValueChange={setBillType}>
            <SelectTrigger aria-label="Bill type"><SelectValue /></SelectTrigger>
            <SelectContent>{BILL_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Bill no.</Label>
          <Input value={nextNo?.billNo ?? '—'} readOnly aria-label="Bill number" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bf-date">Bill date</Label>
          <Input id="bf-date" type="date" value={billDate} onChange={(e) => setBillDate(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bf-due">Due date</Label>
          <Input id="bf-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
      </div>

      {/* Add-line controls */}
      {kind === 'SELL' ? (
        <div className="relative max-w-md">
          <Label>Add item — scan tag / search stock</Label>
          <Input value={stockQ} onChange={(e) => setStockQ(e.target.value)} placeholder="Tag no. or item name" />
          {stockQ && stockHits?.items.length ? (
            <ul className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-md border bg-popover shadow-md">
              {stockHits.items.map((it) => (
                <li key={it.id}>
                  <button type="button" className="flex w-full justify-between px-3 py-2 text-left text-sm hover:bg-accent" onClick={() => addStock(it)}>
                    <span>{it.tagNo ?? it.itemName.name} · {it.group.name}</span>
                    <span className="text-muted-foreground">{it.net}g {it.karatCode ?? ''}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => setRows((rs) => [...rs, blankRow({})])}>+ Direct line</Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label>Stock class</Label>
            <Select value={buyClass} onValueChange={(v) => { setBuyClass(v); setBuyItemId('') }}>
              <SelectTrigger className="w-40" aria-label="Stock class"><SelectValue /></SelectTrigger>
              <SelectContent>{STOCK_CLASSES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Item name</Label>
            <Select value={buyItemId} onValueChange={setBuyItemId}>
              <SelectTrigger className="w-56" aria-label="Item name"><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{buyNames?.items.map((n) => <SelectItem key={n.id} value={String(n.id)}>{n.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button type="button" variant="outline" onClick={addPurchaseRow}>+ Add row</Button>
        </div>
      )}

      {/* Item grid */}
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-44">Item</TableHead>
              <TableHead>Karat</TableHead>
              <TableHead>Pcs</TableHead>
              <TableHead>Gross</TableHead>
              <TableHead>Less</TableHead>
              <TableHead>Tunch</TableHead>
              <TableHead>Wst%</TableHead>
              <TableHead>Net</TableHead>
              <TableHead>Fine</TableHead>
              <TableHead>Stone</TableHead>
              <TableHead>Rate</TableHead>
              <TableHead>Labour</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead>Other</TableHead>
              <TableHead>Disc</TableHead>
              <TableHead>Total</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={17} className="h-20 text-center text-muted-foreground">No items yet.</TableCell></TableRow>
            )}
            {rows.map((r, i) => {
              const lr = lineOf(r)
              const weightRO = r.locked          // TAG stock item: pcs/gross/less come from the item
              const fixedRO = !!r.stockItemId    // any stock line: tunch/wastage/karat come from the item (server ignores edits)
              return (
                <TableRow key={r.key} className={rateLimitLine === i ? 'bg-destructive/10' : ''}>
                  <TableCell>
                    {r.stockItemId || kind === 'PURCHASE' ? (
                      <div className="text-sm">
                        <div className="font-medium">{r.tagNo || r.description}</div>
                        <div className="text-xs text-muted-foreground">{r.description}</div>
                      </div>
                    ) : (
                      <div className="flex gap-1">
                        <Input className="w-32" placeholder="Description" value={r.description} onChange={(e) => setRow(i, 'description', e.target.value)} />
                        <Select value={r.stockClass} onValueChange={(v) => setRow(i, 'stockClass', v)}>
                          <SelectTrigger className="w-24" aria-label="Class"><SelectValue /></SelectTrigger>
                          <SelectContent>{STOCK_CLASSES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {metalRow(r) ? (
                      <Select value={r.karatCode} onValueChange={(v) => setRow(i, 'karatCode', v)} disabled={fixedRO}>
                        <SelectTrigger className="w-20" aria-label="Karat"><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>{karats?.map((k) => <SelectItem key={k.id} value={k.code}>{k.title}</SelectItem>)}</SelectContent>
                      </Select>
                    ) : '—'}
                  </TableCell>
                  <TableCell><Input className="w-14" type="number" value={r.pcs} disabled={weightRO} onChange={(e) => setRow(i, 'pcs', e.target.value)} /></TableCell>
                  <TableCell><Input className="w-20" type="number" step="0.001" value={r.gross} disabled={weightRO} onChange={(e) => setRow(i, 'gross', e.target.value)} /></TableCell>
                  <TableCell><Input className="w-16" type="number" step="0.001" value={r.less} disabled={weightRO} onChange={(e) => setRow(i, 'less', e.target.value)} /></TableCell>
                  <TableCell><Input className="w-16" type="number" step="0.01" value={r.tunch} disabled={fixedRO} onChange={(e) => setRow(i, 'tunch', e.target.value)} /></TableCell>
                  <TableCell><Input className="w-14" type="number" step="0.01" value={r.wastage} disabled={fixedRO} onChange={(e) => setRow(i, 'wastage', e.target.value)} /></TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{lr.net}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{lr.fine}</TableCell>
                  <TableCell><Input className="w-20" type="number" aria-label="Stone charge" value={r.stoneCharge} onChange={(e) => setRow(i, 'stoneCharge', e.target.value)} /></TableCell>
                  <TableCell><Input className="w-24" type="number" aria-label="Rate" value={r.rate} onChange={(e) => setRow(i, 'rate', e.target.value)} /></TableCell>
                  <TableCell><Input className="w-20" type="number" aria-label="Labour" value={r.labour} onChange={(e) => setRow(i, 'labour', e.target.value)} /></TableCell>
                  <TableCell>
                    <Select value={r.labourUnit} onValueChange={(v) => setRow(i, 'labourUnit', v)}>
                      <SelectTrigger className="w-28" aria-label="Labour unit"><SelectValue /></SelectTrigger>
                      <SelectContent>{CHARGE_UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell><Input className="w-20" type="number" aria-label="Other" value={r.other} onChange={(e) => setRow(i, 'other', e.target.value)} /></TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Input className="w-16" type="number" aria-label="Discount" value={r.discount} onChange={(e) => setRow(i, 'discount', e.target.value)} />
                      <Select value={r.discountUnit} onValueChange={(v) => setRow(i, 'discountUnit', v)}>
                        <SelectTrigger className="w-16" aria-label="Discount unit"><SelectValue /></SelectTrigger>
                        <SelectContent>{DISCOUNT_UNITS.map((u) => <SelectItem key={u} value={u}>{u === 'FIXED' ? '₹' : '%'}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap font-medium">{lr.total}</TableCell>
                  <TableCell><Button variant="ghost" size="sm" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))} title="Remove">✕</Button></TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {/* Payments + summary */}
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold">Payments</h2>
            <div className="ml-auto flex gap-1">
              <Button type="button" size="sm" variant="outline" onClick={() => setPays((p) => [...p, blankPay('CASH')])}>+ Cash</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setPays((p) => [...p, blankPay('ONLINE')])}>+ Online</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setPays((p) => [...p, blankPay('METAL')])}>+ Metal</Button>
            </div>
          </div>
          {pays.map((p, i) => (
            <div key={p.key} className="flex flex-wrap items-end gap-2 rounded-md border p-2">
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
              <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setPays((ps) => ps.filter((_, j) => j !== i))}>✕</Button>
            </div>
          ))}

          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1.5">
              <Label>Keep balance as</Label>
              <Select value={keepAs} onValueChange={setKeepAs}>
                <SelectTrigger className="w-32" aria-label="Keep balance as"><SelectValue /></SelectTrigger>
                <SelectContent>{KEEP_BALANCE_AS.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {keepAs !== 'MONEY' && (
              <div className="space-y-1.5">
                <Label htmlFor="bf-keeprate">Keep rate</Label>
                <Input id="bf-keeprate" className="w-28" type="number" value={keepRate} onChange={(e) => setKeepRate(e.target.value)} />
              </div>
            )}
            {keepMetalWeight && <span className="pb-2 text-sm text-muted-foreground">≈ {keepMetalWeight} g</span>}
          </div>
        </div>

        <div className="space-y-2 rounded-md border p-4 text-sm">
          <Row2 label="Subtotal" value={inr(bill.sub)} />
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Discount</span>
            <Input className="ml-auto w-24" type="number" aria-label="Bill discount" value={discount} onChange={(e) => setDiscount(e.target.value)} />
            <Select value={discountUnit} onValueChange={setDiscountUnit}>
              <SelectTrigger className="w-16" aria-label="Bill discount unit"><SelectValue /></SelectTrigger>
              <SelectContent>{DISCOUNT_UNITS.map((u) => <SelectItem key={u} value={u}>{u === 'FIXED' ? '₹' : '%'}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {billType === 'GST' && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">GST %</span>
              <Input className="ml-auto w-24" type="number" aria-label="GST percent" value={gstPercent} onChange={(e) => setGstPercent(e.target.value)} />
            </div>
          )}
          {billType === 'GST' && <Row2 label="CGST + SGST / IGST" value={`${inr(bill.cgst)} + ${inr(bill.sgst)} / ${inr(bill.igst)}`} muted />}
          <Row2 label="Round off" value={bill.round} muted />
          <div className="flex justify-between border-t pt-2 text-base font-semibold"><span>Final</span><span>{inr(bill.final)}</span></div>
          <Row2 label="Paid" value={inr(paid)} />
          <div className="flex justify-between font-medium"><span>Balance</span><span className={balanceDue < 0 ? 'text-green-600 dark:text-green-500' : ''}>{inr(balanceDue)}{balanceDue < 0 ? ' (advance)' : ''}</span></div>
          <p className="text-xs text-muted-foreground">Live preview — the server recomputes every line and total authoritatively on save (GST split uses the party's state).</p>
          <Button className="hidden w-full lg:inline-flex" disabled={!valid || create.isPending} onClick={() => submit()}>
            {create.isPending ? 'Saving…' : `Save ${kind === 'SELL' ? 'sell' : 'purchase'} bill`}
          </Button>
        </div>
      </div>

      {/* Mobile sticky totals + Save bar (desktop uses the Save in the summary card). */}
      <div className="sticky bottom-0 z-10 -mx-6 flex items-center gap-3 border-t bg-background/95 px-6 py-3 backdrop-blur lg:hidden">
        <div className="text-sm">
          <div className="font-semibold">{inr(bill.final)}</div>
          <div className="text-xs text-muted-foreground">Bal {inr(balanceDue)}</div>
        </div>
        <Button className="ml-auto" disabled={!valid || create.isPending} onClick={() => submit()}>
          {create.isPending ? 'Saving…' : 'Save bill'}
        </Button>
      </div>

      <Dialog open={panOpen} onOpenChange={(o) => !o && setPanOpen(false)}>
        <DialogContent>
          <DialogHeader><DialogTitle>PAN required</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Cash on this bill is at or above ₹2,00,000, so the customer's PAN is required. It will be saved to the party.</p>
          <Input value={pan} onChange={(e) => setPan(e.target.value.toUpperCase())} placeholder="ABCDE1234F" aria-label="PAN" />
          <DialogFooter>
            <Button disabled={!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan) || create.isPending} onClick={() => { setPanOpen(false); void submit(pan) }}>Save with PAN</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Row2({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={muted ? 'text-muted-foreground' : ''}>{value}</span>
    </div>
  )
}
