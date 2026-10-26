import { ChevronDown, Columns3 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

import { MpinDialog } from '@/components/MpinDialog'
import { NewPartyDialog } from '@/components/NewPartyDialog'
import { PartyPicker } from '@/components/PartyPicker'
import { TABLE_EDGES } from '@/components/SectionCard'
import { SelectBranchForTxn } from '@/components/SelectBranchForTxn'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { api } from '@/lib/api'
import { useBankAccounts, useKarats, useSettings } from '@/lib/appQueries'
import { useAuth } from '@/lib/auth'
import { useT } from '@/lib/i18n'
import { fetchDraftByNo } from '@/lib/draftsQueries'
import { ApiException } from '@/lib/errors'
import { shareOnWhatsApp } from '@/lib/share'
import { lineRateUnitGrams, metalRateUnitGrams, useCreateBill, useNextBillNo, usePartyBalance, useUpdateBill } from '@/lib/billingQueries'
import { useItemNames, useStock } from '@/lib/inventoryQueries'
import { useOrder, useOrders } from '@/lib/ordersQueries'
import {
  BILL_TYPES,
  businessDayISO,
  CHARGE_UNITS,
  DISCOUNT_UNITS,
  KEEP_BALANCE_AS,
  METALS,
  STOCK_CLASSES,
  computeBill,
  computeLine,
  metalToMoney,
  moneyToMetal,
  type BillDto,
  type BillKind,
  type BillLineDto,
  type BillPaymentDto,
  type OrderDto,
  type PartyRefDto,
  type StockItemDto,
} from '@/shared'

let uid = 0
const nextKey = () => `k${uid++}`
const today = businessDayISO
const inr = (s: string | number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(s))

// TASK-86 bill-grid column customizer. Item/Gross/Total/actions stay fixed (needed for a valid bill);
// the rest are show/hide, remembered per browser. Default all-on → grid is unchanged out of the box.
// `label` stays English (checkbox aria-label); `tk` is the i18n key for the visible text.
const OPTIONAL_COLS = [
  { key: 'karat', label: 'Karat', tk: 'stock.col_karat' }, { key: 'pcs', label: 'Pcs', tk: 'stock.col_pcs' }, { key: 'less', label: 'Less', tk: 'bill.col_less' },
  { key: 'tunch', label: 'Tunch', tk: 'bill.col_tunch' }, { key: 'wastage', label: 'Wst%', tk: 'bill.col_wastage' }, { key: 'net', label: 'Net', tk: 'stock.col_net' },
  { key: 'fine', label: 'Fine', tk: 'stock.col_fine' }, { key: 'stone', label: 'Stone', tk: 'class.STONE' }, { key: 'rate', label: 'Rate', tk: 'udhari.rate' },
  { key: 'labour', label: 'Labour', tk: 'bill.col_labour' }, { key: 'unit', label: 'Unit', tk: 'bill.col_unit' }, { key: 'other', label: 'Other', tk: 'bill.col_other' },
  { key: 'disc', label: 'Disc', tk: 'bill.col_disc' },
] as const
// Columns-menu presets (original: All / Simple / Tunch); 'All' doubles as reset.
const COL_PRESETS = {
  simple: ['karat', 'pcs', 'net', 'rate', 'labour', 'unit', 'disc'],
  tunch: ['karat', 'pcs', 'less', 'tunch', 'wastage', 'net', 'fine', 'rate', 'labour', 'unit'],
} as const
const COLS_LS = 'ju.billcols'
const loadCols = (): Record<string, boolean> => {
  try { const s = localStorage.getItem(COLS_LS); if (s) return { ...Object.fromEntries(OPTIONAL_COLS.map((c) => [c.key, true])), ...JSON.parse(s) } } catch { /* ignore */ }
  return Object.fromEntries(OPTIONAL_COLS.map((c) => [c.key, true]))
}

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

// ── edit-mode prefill: map a saved bill's lines/payments back into editable rows ──
const rowFromLine = (it: BillLineDto): Row =>
  blankRow({
    stockItemId: it.stockItemId ?? undefined, itemNameId: it.itemNameId ?? undefined, description: it.description, stockClass: it.stockClass,
    tagNo: it.tagNo ?? '', karatCode: it.karatCode ?? '', pcs: String(it.pcs), gross: it.gross, less: it.less, tunch: it.tunch, wastage: it.wastage,
    stoneCharge: it.stoneCharge, rate: it.rate, labour: it.labour, labourUnit: it.labourUnit, other: it.other, discount: it.discount, discountUnit: it.discountUnit,
    locked: !!it.stockItemId && !!it.tagNo, // TAG stock line → weights from the item
  })
const payFromDto = (p: BillPaymentDto): PayRow => ({
  key: nextKey(), mode: p.mode, amount: p.mode === 'METAL' ? '' : p.amount, bankAccountId: p.bankAccount ? String(p.bankAccount.id) : '',
  metal: p.metal ?? 'GOLD', metalForm: p.metalForm ?? 'BULLION',
  gross: p.gross ?? '', less: p.gross && p.net ? String(Number(p.gross) - Number(p.net)) : '0', tunch: p.tunch ?? '', rate: p.rate ?? '', remark: p.remark ?? '',
})

const ITC_OPTS = [['ELIGIBLE', 'Eligible'], ['BLOCKED_17_5', 'Blocked u/s 17(5)'], ['INELIGIBLE', 'Ineligible']] as const
const SUPPLY_OPTS = [['TAXABLE', 'Taxable'], ['ZERO_RATED', 'Zero rated (export / SEZ)'], ['NIL_EXEMPT', 'Nil rated / exempt'], ['NON_GST', 'Non-GST supply']] as const

export function BillForm({ kind, editBill }: { kind: BillKind; editBill?: BillDto }) {
  const t = useT()
  const navigate = useNavigate()
  const { activeBranch, can } = useAuth()
  const branchReady = !!editBill || (activeBranch !== '' && activeBranch !== 'all') // a bill posts to one branch; edit keeps the bill's branch
  const { data: settings } = useSettings()
  const { data: banks } = useBankAccounts()
  const { data: karats } = useKarats()
  const create = useCreateBill()
  const update = useUpdateBill()

  const [searchParams] = useSearchParams()
  const [billType, setBillType] = useState<string>(editBill ? editBill.billType : searchParams.get('type') === 'ROUGH' ? 'ROUGH' : 'GST')
  const [party, setParty] = useState<PartyRefDto | null>(editBill ? editBill.party : null)
  const [billDate, setBillDate] = useState(editBill ? editBill.billDate.slice(0, 10) : today())
  const [dueDate, setDueDate] = useState(editBill?.dueDate ? editBill.dueDate.slice(0, 10) : '')
  const [rows, setRows] = useState<Row[]>(editBill ? editBill.items.map(rowFromLine) : [])
  const [discount, setDiscount] = useState(editBill ? editBill.discount : '0')
  const [discountUnit, setDiscountUnit] = useState<string>(editBill ? editBill.discountUnit : 'FIXED')
  const [gstPercent, setGstPercent] = useState(editBill ? editBill.gstPercent : '3')
  const [pays, setPays] = useState<PayRow[]>(editBill ? editBill.payments.filter((p) => p.isActive).map(payFromDto) : [])
  const [keepAs, setKeepAs] = useState<string>(editBill ? editBill.keepBalanceAs : 'MONEY')
  const [keepRate, setKeepRate] = useState(editBill?.keepRate ?? '')
  // TASK-97 GST reporting fields (no calc effect); the block is collapsed and its inputs are only mounted when opened
  const [gstOpen, setGstOpen] = useState(false)
  const [gst, setGst] = useState({
    itcEligibility: editBill?.itcEligibility ?? 'ELIGIBLE', itcBlockReason: editBill?.itcBlockReason ?? '', supplierInvoiceNo: editBill?.supplierInvoiceNo ?? '',
    supplyCategory: editBill?.supplyCategory ?? 'TAXABLE', reverseCharge: editBill?.reverseCharge ?? false,
  })
  const [rateLimitLine, setRateLimitLine] = useState<number | null>(null)
  const [panOpen, setPanOpen] = useState(false)
  const [pan, setPan] = useState('')
  const [mpinOpen, setMpinOpen] = useState(false) // edit requires X-MPIN
  const [editMpin, setEditMpin] = useState('')
  const [draftId, setDraftId] = useState<number | null>(null) // set when billing from an approved showroom draft
  const [draftNo, setDraftNo] = useState('')
  const [orderId, setOrderId] = useState<number | null>(null) // set when billing a READY order (?orderId=)
  const [orderLoaded, setOrderLoaded] = useState(false)
  const orderIdParam = searchParams.get('orderId')
  const { data: orderData } = useOrder(!editBill && orderIdParam ? Number(orderIdParam) : undefined)
  const [orderSearch, setOrderSearch] = useState(false) // TASK-86: inline "bill a ready order" picker
  // shortcut: lists first 50 READY orders (orders list API has no free-text q); add server-side search when a shop outgrows one page
  const [orderQ, setOrderQ] = useState('')
  const { data: readyOrders } = useOrders({ status: 'READY', q: orderQ || undefined, page: 1, pageSize: 50 }, kind === 'SELL' && !editBill && orderSearch)
  const [cols, setCols] = useState<Record<string, boolean>>(loadCols)
  const saveCols = (n: Record<string, boolean>) => { try { localStorage.setItem(COLS_LS, JSON.stringify(n)) } catch { /* ignore */ } return n }
  const toggleCol = (k: string) => setCols((v) => saveCols({ ...v, [k]: !v[k] }))
  const applyPreset = (keys: readonly string[] | 'all') => setCols(saveCols(Object.fromEntries(OPTIONAL_COLS.map((c) => [c.key, keys === 'all' || keys.includes(c.key)]))))

  // Billing a READY order: prefill its party + reserved finished pieces as lines, carry orderId on the bill.
  const applyOrder = (order: OrderDto) => {
    setParty(order.party)
    setOrderId(order.id)
    void Promise.all(order.items.filter((it) => it.stockItemId).map((it) => api.get<StockItemDto>(`/app/stock/${it.stockItemId}`)))
      .then((items) => setRows(items.map(rowFromStock)))
      .catch(() => toast.error(t('bill.err_order_items')))
  }
  useEffect(() => {
    if (!orderData || orderLoaded) return
    setOrderLoaded(true)
    applyOrder(orderData)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderData, orderLoaded])
  const [walkInDraft, setWalkInDraft] = useState<{ name: string; mobile: string } | null>(null) // walk-in draft needs a party before billing

  const retrieveDraft = async () => {
    const no = Number(draftNo)
    if (!no) return
    try {
      const draft = await fetchDraftByNo(no)
      const items = await Promise.all(draft.items.map((it) => api.get<StockItemDto>(`/app/stock/${it.stockItemId}`)))
      setRows(items.map(rowFromStock))
      if (draft.approvedDiscount != null) { setDiscount(draft.approvedDiscount); setDiscountUnit(draft.approvedDiscountUnit ?? 'FIXED') }
      setDraftId(draft.id)
      if (draft.party) {
        setParty(draft.party)
        toast.success(t('bill.draft_loaded', { no: draft.draftNo }))
      } else {
        // walk-in draft: a sell bill needs a party — offer to create one from the draft's name/mobile (or pick via the picker)
        setWalkInDraft({ name: draft.customerName, mobile: draft.mobile ?? '' })
        toast.info(t('bill.draft_loaded_walkin', { no: draft.draftNo }))
      }
    } catch (e) {
      toast.error(e instanceof ApiException ? e.message : t('bill.err_draft'))
    }
  }

  const { data: balance } = usePartyBalance(party?.id)
  const { data: nextNo } = useNextBillNo(kind, billType, !editBill && branchReady) // edit shows the saved number

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
    if (rows.some((r) => r.stockItemId === it.id)) { toast.error(t('bill.item_already')); return }
    setRows((rs) => [...rs, rowFromStock(it)])
    setStockQ('')
  }
  const addPurchaseRow = () => {
    const n = buyNames?.items.find((x) => String(x.id) === buyItemId)
    if (!n) { toast.error(t('bill.pick_item_name')); return }
    setRows((rs) => [...rs, blankRow({ itemNameId: n.id, description: n.name, stockClass: buyClass })])
  }

  const valid = branchReady && !!party && rows.length > 0 && rows.every((r) => Number(r.gross) > 0 && (r.stockItemId || r.itemNameId || (r.description && r.stockClass)))

  const submit = async (panValue?: string, mpinValue?: string) => {
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
      draftId: !editBill && kind === 'SELL' ? draftId ?? undefined : undefined,
      orderId: !editBill && kind === 'SELL' ? orderId ?? undefined : undefined,
      ...(billType !== 'GST' ? {} : kind === 'PURCHASE'
        ? { itcEligibility: gst.itcEligibility, itcBlockReason: gst.itcEligibility === 'ELIGIBLE' ? '' : gst.itcBlockReason, supplierInvoiceNo: gst.supplierInvoiceNo, reverseCharge: gst.reverseCharge }
        : { supplyCategory: gst.supplyCategory }),
    }
    try {
      const saved = editBill
        ? await update.mutateAsync({ id: editBill.id, body, mpin: mpinValue ?? editMpin })
        : await create.mutateAsync(body)
      // Settings → print.defaults.postSaveShareDialog: offer WhatsApp share right from the success toast (non-blocking)
      const offerShare = !editBill && settings?.['print.defaults'].postSaveShareDialog && saved.party.mobile
      toast.success(editBill ? t('bill.updated') : t('bill.saved'), offerShare ? {
        duration: 10_000,
        action: { label: t('bill.share'), onClick: () => shareOnWhatsApp(saved.party.mobile, `${kind === 'SELL' ? 'Bill' : 'Purchase'} ${saved.billNo} · Total ${inr(saved.final)} · Balance ${inr(saved.balance)}`) },
      } : undefined)
      navigate(`/app/billing/view/${saved.id}`)
    } catch (e) {
      if (e instanceof ApiException && e.code === 'VALIDATION') {
        const d = e.details as { code?: string; line?: number } | undefined
        if (d?.code === 'PAN_REQUIRED') { setPanOpen(true); return } // keeps editMpin for the resubmit
        if (d?.code === 'RATE_LIMIT') { setRateLimitLine(d.line ?? null); toast.error(t('bill.rate_limit', { line: (d.line ?? 0) + 1 })); return }
      }
      toast.error(e instanceof ApiException ? e.message : editBill ? t('bill.err_update') : t('bill.err_save'))
    }
  }

  const pending = create.isPending || update.isPending
  const onSaveClick = () => (editBill ? setMpinOpen(true) : void submit())

  const metalRow = (r: Row) => r.stockClass === 'GOLD' || r.stockClass === 'SILVER'

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        {editBill
          ? t('bill.sub_edit')
          : kind === 'SELL'
            ? t('bill.sub_sell')
            : t('bill.sub_purchase')}
      </p>
      {!branchReady && <SelectBranchForTxn note={t('bill.branch_note')} />}

      {/* Header */}
      <Card className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5 lg:col-span-2">
          <Label htmlFor="bf-party">{kind === 'SELL' ? t('bill.customer') : t('bill.supplier')}</Label>
          <PartyPicker value={party} onChange={setParty} placeholder={t('bill.search_party')} id="bf-party" ariaLabel={kind === 'SELL' ? 'Customer' : 'Supplier'} />
          {party && can('udhari.entry', 'edit') && (
            // take an old udhar payment (jama) for this party without leaving billing
            <Link to={`/app/udhari?partyId=${party.id}`} target="_blank" rel="noreferrer" className="float-right text-xs font-semibold text-brand-strong hover:underline">{t('bill.jama_udhar')}</Link>
          )}
          {party && (
            <p className="w-fit rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
              {party.mobile}
              {balance && `${t('bill.party_balance', { amount: balance.amount })}${Number(balance.gold) ? ` · ${balance.gold}g Au` : ''}${Number(balance.silver) ? ` · ${balance.silver}g Ag` : ''}`}
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label>{t('bill.type')}</Label>
          <Select value={billType} onValueChange={setBillType} disabled={!!editBill}>
            <SelectTrigger aria-label="Bill type"><SelectValue /></SelectTrigger>
            <SelectContent>{BILL_TYPES.map((bt) => <SelectItem key={bt} value={bt}>{bt}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>{t('bill.bill_no')}</Label>
          <Input value={editBill ? editBill.billNo : nextNo?.billNo ?? '—'} readOnly aria-label="Bill number" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bf-date">{t('bill.bill_date')}</Label>
          <Input id="bf-date" type="date" value={billDate} onChange={(e) => setBillDate(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bf-due">{t('bill.due_date')}</Label>
          <Input id="bf-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
      </Card>

      {/* Add-line controls. No overflow clipping or hover lift on this card: the stock dropdown overflows it. */}
      <Card className="p-6">
      {kind === 'SELL' ? (
        <div className="relative max-w-md">
          <Label htmlFor="bf-stock-search">{t('bill.add_item')}</Label>
          <Input id="bf-stock-search" value={stockQ} onChange={(e) => setStockQ(e.target.value)} placeholder={t('bill.stock_search_ph')} />
          {stockQ && stockHits?.items.length ? (
            <ul className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-md border bg-popover shadow-md">
              {stockHits.items.map((it) => (
                <li key={it.id}>
                  <button type="button" className="flex w-full justify-between px-3 py-2 text-left text-sm hover:bg-accent focus-visible:bg-accent focus-visible:outline-none" onClick={() => addStock(it)}>
                    <span>{it.tagNo ?? it.itemName.name} · {it.group.name}</span>
                    <span className="text-muted-foreground">{it.net}g {it.karatCode ?? ''}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="mt-2 flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setRows((rs) => [...rs, blankRow({})])}>{t('bill.direct_line')}</Button>
            {!editBill && (
              <>
                {/* QR scanners type the draft no. + Enter here (the slip QR is the bare no.) */}
                <Input className="w-32" placeholder={t('bill.draft_no_ph')} aria-label="Draft number" aria-describedby="bf-draft-help" value={draftNo} onChange={(e) => setDraftNo(e.target.value.replace(/[\s#]/g, ''))} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void retrieveDraft() } }} />
                <Button type="button" variant="outline" size="sm" onClick={() => void retrieveDraft()}>{t('bill.retrieve_draft')}</Button>
              </>
            )}
          </div>
          {!editBill && <p id="bf-draft-help" className="mt-1 text-xs text-muted-foreground">Scan the draft slip QR or type the draft no.</p>}
          {draftId && <p className="text-xs text-muted-foreground">{t('bill.from_draft')}</p>}
          {!editBill && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Checkbox id="bf-ordersearch" checked={orderSearch} onCheckedChange={(v) => setOrderSearch(!!v)} />
              <Label htmlFor="bf-ordersearch" className="font-normal">{t('bill.bill_ready_order')}</Label>
              {orderSearch && (
                <Input className="w-48" placeholder={t('bill.order_search_ph')} aria-label="Search ready orders" value={orderQ} onChange={(e) => setOrderQ(e.target.value)} />
              )}
              {orderSearch && (
                <Select value={orderId ? String(orderId) : ''} onValueChange={(v) => { const o = readyOrders?.items.find((x) => String(x.id) === v); if (o) applyOrder(o) }}>
                  <SelectTrigger className="w-64" aria-label="Ready order"><SelectValue placeholder={t('bill.select_ready_order')} /></SelectTrigger>
                  <SelectContent>
                    {readyOrders?.items.length
                      ? readyOrders.items.map((o) => <SelectItem key={o.id} value={String(o.id)}>#{o.orderNo} · {o.party.name}</SelectItem>)
                      : <div className="px-3 py-2 text-sm text-muted-foreground">{t('bill.no_ready_orders')}</div>}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label>{t('bill.stock_class')}</Label>
            <Select value={buyClass} onValueChange={(v) => { setBuyClass(v); setBuyItemId('') }}>
              <SelectTrigger className="w-40" aria-label="Stock class"><SelectValue /></SelectTrigger>
              <SelectContent>{STOCK_CLASSES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t('bill.item_name')}</Label>
            <Select value={buyItemId} onValueChange={setBuyItemId}>
              <SelectTrigger className="w-56" aria-label="Item name"><SelectValue placeholder={t('bill.select')} /></SelectTrigger>
              <SelectContent>{buyNames?.items.map((n) => <SelectItem key={n.id} value={String(n.id)}>{n.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button type="button" variant="outline" onClick={addPurchaseRow}>{t('bill.add_row')}</Button>
        </div>
      )}
      </Card>

      {/* Item grid: must stay the first <table> on the page and before payments (specs use tbody tr / Rate .first()). */}
      <Card className="overflow-hidden">
      <div className="flex justify-end border-b bg-muted/40 px-6 py-3">
        <Popover>
          <PopoverTrigger asChild><Button type="button" variant="outline" size="sm"><Columns3 aria-hidden />{t('bill.columns')}</Button></PopoverTrigger>
          <PopoverContent align="end" className="w-56 space-y-2">
            <div className="flex flex-wrap gap-1 border-b pb-2">
              <Button type="button" size="sm" variant="ghost" className="h-7 px-2" onClick={() => applyPreset('all')}>{t('bill.cols_all')}</Button>
              <Button type="button" size="sm" variant="ghost" className="h-7 px-2" onClick={() => applyPreset(COL_PRESETS.simple)}>{t('bill.cols_simple')}</Button>
              <Button type="button" size="sm" variant="ghost" className="h-7 px-2" onClick={() => applyPreset(COL_PRESETS.tunch)}>{t('bill.cols_tunch')}</Button>
            </div>
            {OPTIONAL_COLS.map((c) => (
              <label key={c.key} className="flex items-center gap-2 text-sm">
                <Checkbox checked={cols[c.key]} onCheckedChange={() => toggleCol(c.key)} aria-label={c.label} /> {t(c.tk)}
              </label>
            ))}
          </PopoverContent>
        </Popover>
      </div>
      <div className={`overflow-x-auto ${TABLE_EDGES}`}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-44">{t('bill.col_item')}</TableHead>
              {cols.karat && <TableHead>{t('stock.col_karat')}</TableHead>}
              {cols.pcs && <TableHead>{t('stock.col_pcs')}</TableHead>}
              <TableHead>{t('stock.col_gross')}</TableHead>
              {cols.less && <TableHead>{t('bill.col_less')}</TableHead>}
              {cols.tunch && <TableHead>{t('bill.col_tunch')}</TableHead>}
              {cols.wastage && <TableHead>{t('bill.col_wastage')}</TableHead>}
              {cols.net && <TableHead>{t('stock.col_net')}</TableHead>}
              {cols.fine && <TableHead>{t('stock.col_fine')}</TableHead>}
              {cols.stone && <TableHead>{t('class.STONE')}</TableHead>}
              {cols.rate && <TableHead>{t('udhari.rate')}</TableHead>}
              {cols.labour && <TableHead>{t('bill.col_labour')}</TableHead>}
              {cols.unit && <TableHead>{t('bill.col_unit')}</TableHead>}
              {cols.other && <TableHead>{t('bill.col_other')}</TableHead>}
              {cols.disc && <TableHead>{t('bill.col_disc')}</TableHead>}
              <TableHead>{t('bill.col_total')}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={4 + OPTIONAL_COLS.filter((c) => cols[c.key]).length} className="h-20 text-center text-muted-foreground">{t('bill.no_items')}</TableCell></TableRow>
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
                        <div className="font-semibold">{r.stockItemId ? r.tagNo || r.description : r.description}</div>
                        {r.stockItemId ? <div className="text-xs text-muted-foreground">{r.description}</div> : (
                          // purchase: optional own tag no. (blank → server auto-tags)
                          <Input className="mt-1 h-8 w-32" placeholder={t('bill.tag_no_ph')} aria-label="Tag number" value={r.tagNo} onChange={(e) => setRow(i, 'tagNo', e.target.value)} />
                        )}
                      </div>
                    ) : (
                      <div className="flex gap-1">
                        <Input className="w-32" placeholder={t('bill.description')} value={r.description} onChange={(e) => setRow(i, 'description', e.target.value)} />
                        <Select value={r.stockClass} onValueChange={(v) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, stockClass: v, itemNameId: undefined } : x)))}>
                          <SelectTrigger className="w-24" aria-label="Class"><SelectValue /></SelectTrigger>
                          <SelectContent>{STOCK_CLASSES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                        </Select>
                        <DirectItemName
                          stockClass={r.stockClass}
                          value={r.itemNameId}
                          onPick={(n) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, itemNameId: n?.id, description: n ? n.name : x.description } : x)))}
                        />
                      </div>
                    )}
                  </TableCell>
                  {cols.karat && <TableCell>
                    {metalRow(r) ? (
                      <Select value={r.karatCode} onValueChange={(v) => setRow(i, 'karatCode', v)} disabled={fixedRO}>
                        <SelectTrigger className="w-20" aria-label="Karat"><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>{karats?.map((k) => <SelectItem key={k.id} value={k.code}>{k.title}</SelectItem>)}</SelectContent>
                      </Select>
                    ) : '—'}
                  </TableCell>}
                  {cols.pcs && <TableCell><Input className="w-14" type="number" value={r.pcs} disabled={weightRO} onChange={(e) => setRow(i, 'pcs', e.target.value)} /></TableCell>}
                  <TableCell><Input className="w-20" type="number" step="0.001" value={r.gross} disabled={weightRO} onChange={(e) => setRow(i, 'gross', e.target.value)} /></TableCell>
                  {cols.less && <TableCell><Input className="w-16" type="number" step="0.001" value={r.less} disabled={weightRO} onChange={(e) => setRow(i, 'less', e.target.value)} /></TableCell>}
                  {cols.tunch && <TableCell><Input className="w-16" type="number" step="0.01" value={r.tunch} disabled={fixedRO} onChange={(e) => setRow(i, 'tunch', e.target.value)} /></TableCell>}
                  {cols.wastage && <TableCell><Input className="w-14" type="number" step="0.01" value={r.wastage} disabled={fixedRO} onChange={(e) => setRow(i, 'wastage', e.target.value)} /></TableCell>}
                  {cols.net && <TableCell className="whitespace-nowrap text-muted-foreground">{lr.net}</TableCell>}
                  {cols.fine && <TableCell className="whitespace-nowrap text-muted-foreground">{lr.fine}</TableCell>}
                  {cols.stone && <TableCell><Input className="w-20" type="number" aria-label="Stone charge" value={r.stoneCharge} onChange={(e) => setRow(i, 'stoneCharge', e.target.value)} /></TableCell>}
                  {cols.rate && <TableCell><Input className="w-24" type="number" aria-label="Rate" value={r.rate} onChange={(e) => setRow(i, 'rate', e.target.value)} /></TableCell>}
                  {cols.labour && <TableCell><Input className="w-20" type="number" aria-label="Labour" value={r.labour} onChange={(e) => setRow(i, 'labour', e.target.value)} /></TableCell>}
                  {cols.unit && <TableCell>
                    <Select value={r.labourUnit} onValueChange={(v) => setRow(i, 'labourUnit', v)}>
                      <SelectTrigger className="w-28" aria-label="Labour unit"><SelectValue /></SelectTrigger>
                      <SelectContent>{CHARGE_UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                    </Select>
                  </TableCell>}
                  {cols.other && <TableCell><Input className="w-20" type="number" aria-label="Other" value={r.other} onChange={(e) => setRow(i, 'other', e.target.value)} /></TableCell>}
                  {cols.disc && <TableCell>
                    <div className="flex gap-1">
                      <Input className="w-16" type="number" aria-label="Discount" value={r.discount} onChange={(e) => setRow(i, 'discount', e.target.value)} />
                      <Select value={r.discountUnit} onValueChange={(v) => setRow(i, 'discountUnit', v)}>
                        <SelectTrigger className="w-16" aria-label="Discount unit"><SelectValue /></SelectTrigger>
                        <SelectContent>{DISCOUNT_UNITS.map((u) => <SelectItem key={u} value={u}>{u === 'FIXED' ? '₹' : '%'}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </TableCell>}
                  <TableCell className="whitespace-nowrap font-medium">{lr.total}</TableCell>
                  <TableCell><Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" aria-label="Remove line" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))} title="Remove">✕</Button></TableCell>
                </TableRow>
              )
            })}
          </TableBody>
          {/* totals row in <tfoot> so `tbody tr` (specs) still hits the first line */}
          {rows.length > 1 && (() => {
            const lines = rows.map(lineOf)
            const sum = (f: (i: number) => number, dp: number) => rows.reduce((a, _r, i) => a + f(i), 0).toFixed(dp)
            const blank = <TableCell />
            return (
              <TableFooter>
                <TableRow className="font-semibold tabular-nums">
                  <TableCell>{t('bill.totals_row', { n: rows.length })}</TableCell>
                  {cols.karat && blank}
                  {cols.pcs && <TableCell>{sum((i) => Number(rows[i]!.pcs) || 0, 0)}</TableCell>}
                  <TableCell>{sum((i) => Number(rows[i]!.gross) || 0, 3)}</TableCell>
                  {cols.less && <TableCell>{sum((i) => Number(rows[i]!.less) || 0, 3)}</TableCell>}
                  {cols.tunch && blank}
                  {cols.wastage && blank}
                  {cols.net && <TableCell>{sum((i) => Number(lines[i]!.net) || 0, 3)}</TableCell>}
                  {cols.fine && <TableCell>{sum((i) => Number(lines[i]!.fine) || 0, 3)}</TableCell>}
                  {cols.stone && blank}
                  {cols.rate && blank}
                  {cols.labour && blank}
                  {cols.unit && blank}
                  {cols.other && blank}
                  {cols.disc && blank}
                  <TableCell className="whitespace-nowrap">{sum((i) => Number(lines[i]!.total) || 0, 2)}</TableCell>
                  {blank}
                </TableRow>
              </TableFooter>
            )
          })()}
        </Table>
      </div>
      </Card>

      {/* Payments + summary (payments first in the DOM) */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 border-b bg-muted/40 px-6 py-4">
            <h2 className="text-lg font-bold">{t('bill.payments')}</h2>
            <div className="ml-auto flex flex-wrap gap-1">
              <Button type="button" size="sm" variant="outline" onClick={() => setPays((p) => [...p, blankPay('CASH')])}>{t('bill.add_cash')}</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setPays((p) => [...p, blankPay('ONLINE')])}>{t('bill.add_online')}</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setPays((p) => [...p, blankPay('METAL')])}>{t('bill.add_metal')}</Button>
            </div>
          </div>
          <div className="space-y-3 p-6">
          {pays.map((p, i) => (
            <div key={p.key} className="flex flex-wrap items-center gap-2 rounded-2xl border bg-muted/40 p-3">
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${p.mode === 'METAL' ? 'bg-brand/15 text-brand-strong' : 'bg-muted text-muted-foreground'}`}>{p.mode}</span>
              {p.mode === 'METAL' ? (
                <>
                  <Select value={p.metal} onValueChange={(v) => setPays((ps) => ps.map((x, j) => j === i ? { ...x, metal: v } : x))}>
                    <SelectTrigger className="w-24" aria-label="Metal"><SelectValue /></SelectTrigger>
                    <SelectContent>{METALS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={p.metalForm} onValueChange={(v) => setPays((ps) => ps.map((x, j) => j === i ? { ...x, metalForm: v } : x))}>
                    <SelectTrigger className="w-28" aria-label="Metal form"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="BULLION">{t('bill.form_bullion')}</SelectItem><SelectItem value="KACHA">{t('bill.form_kacha')}</SelectItem></SelectContent>
                  </Select>
                  <Input className="w-20" type="number" placeholder={t('stock.col_gross')} aria-label="Gross" value={p.gross} onChange={(e) => setPays((ps) => ps.map((x, j) => j === i ? { ...x, gross: e.target.value } : x))} />
                  <Input className="w-16" type="number" placeholder={t('bill.col_less')} aria-label="Less" value={p.less} onChange={(e) => setPays((ps) => ps.map((x, j) => j === i ? { ...x, less: e.target.value } : x))} />
                  <Input className="w-16" type="number" placeholder={t('bill.col_tunch')} aria-label="Tunch" value={p.tunch} onChange={(e) => setPays((ps) => ps.map((x, j) => j === i ? { ...x, tunch: e.target.value } : x))} />
                  <Input className="w-24" type="number" placeholder={t('udhari.rate')} aria-label="Rate" value={p.rate} onChange={(e) => setPays((ps) => ps.map((x, j) => j === i ? { ...x, rate: e.target.value } : x))} />
                  <span className="text-sm tabular-nums">
                    <span className="text-muted-foreground">{t('bill.pay_fine', { g: (((Number(p.gross) || 0) - (Number(p.less) || 0)) * (Number(p.tunch) || 0) / 100).toFixed(3) })}</span> = {inr(payAmount(p))}
                  </span>
                </>
              ) : (
                <>
                  <Input className="w-28" type="number" placeholder={t('bill.amount')} aria-label="Amount" value={p.amount} onChange={(e) => setPays((ps) => ps.map((x, j) => j === i ? { ...x, amount: e.target.value } : x))} />
                  {p.mode === 'ONLINE' && (
                    <Select value={p.bankAccountId} onValueChange={(v) => setPays((ps) => ps.map((x, j) => j === i ? { ...x, bankAccountId: v } : x))}>
                      <SelectTrigger className="w-44" aria-label="Bank account"><SelectValue placeholder={t('bill.bank')} /></SelectTrigger>
                      <SelectContent>{banks?.map((b) => <SelectItem key={b.id} value={String(b.id)}>{b.bankName} · {b.accountNo}</SelectItem>)}</SelectContent>
                    </Select>
                  )}
                </>
              )}
              <Input className="w-full sm:w-40" placeholder={t('bill.pay_remark')} aria-label="Payment remark" value={p.remark} onChange={(e) => setPays((ps) => ps.map((x, j) => j === i ? { ...x, remark: e.target.value } : x))} />
              <Button variant="ghost" size="sm" className="ml-auto" aria-label="Remove payment" onClick={() => setPays((ps) => ps.filter((_, j) => j !== i))}>✕</Button>
            </div>
          ))}

          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1.5">
              <Label>{t('bill.keep_balance_as')}</Label>
              <Select value={keepAs} onValueChange={setKeepAs}>
                <SelectTrigger className="w-32" aria-label="Keep balance as"><SelectValue /></SelectTrigger>
                <SelectContent>{KEEP_BALANCE_AS.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {keepAs !== 'MONEY' && (
              <div className="space-y-1.5">
                <Label htmlFor="bf-keeprate">{t('bill.keep_rate')}</Label>
                <Input id="bf-keeprate" className="w-28" type="number" value={keepRate} onChange={(e) => setKeepRate(e.target.value)} />
              </div>
            )}
            {keepMetalWeight && <span className="pb-2 text-sm text-muted-foreground">≈ {keepMetalWeight} g</span>}
          </div>
          </div>
        </Card>

        <Card className="space-y-2 self-start p-6 text-sm tabular-nums lg:sticky lg:top-6">
          <Row2 label={t('bill.subtotal')} value={inr(bill.sub)} />
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">{t('bill.discount')}</span>
            <Input className="ml-auto w-24" type="number" aria-label="Bill discount" value={discount} onChange={(e) => setDiscount(e.target.value)} />
            <Select value={discountUnit} onValueChange={setDiscountUnit}>
              <SelectTrigger className="w-16" aria-label="Bill discount unit"><SelectValue /></SelectTrigger>
              <SelectContent>{DISCOUNT_UNITS.map((u) => <SelectItem key={u} value={u}>{u === 'FIXED' ? '₹' : '%'}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {billType === 'GST' && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">{t('bill.gst_pct')}</span>
              <Input className="ml-auto w-24" type="number" aria-label="GST percent" value={gstPercent} onChange={(e) => setGstPercent(e.target.value)} />
            </div>
          )}
          {billType === 'GST' && <Row2 label="CGST + SGST / IGST" value={`${inr(bill.cgst)} + ${inr(bill.sgst)} / ${inr(bill.igst)}`} muted />}
          <Row2 label={t('bill.round_off')} value={bill.round} muted />
          <div className="flex justify-between border-t-2 border-brand pt-3 text-lg font-extrabold"><span>{t('bill.final')}</span><span>{inr(bill.final)}</span></div>
          <Row2 label={t('bill.paid')} value={inr(paid)} />
          <div className={`-mx-3 flex justify-between rounded-xl px-3 py-2 font-semibold ${balanceDue < 0 ? 'bg-green-500/10' : 'bg-muted/50'}`}><span>{t('bill.balance')}</span><span className={balanceDue < 0 ? 'text-green-600 dark:text-green-500' : ''}>{inr(balanceDue)}{balanceDue < 0 ? t('bill.advance') : ''}</span></div>
          <p className="text-xs text-muted-foreground">{t('bill.live_preview')}</p>
          <Button size="lg" className="mt-2 hidden w-full lg:inline-flex" disabled={!valid || pending} onClick={onSaveClick}>
            {pending ? t('bill.saving') : editBill ? t('bill.update_mpin') : kind === 'SELL' ? t('bill.save_sell') : t('bill.save_purchase')}
          </Button>
        </Card>
      </div>

      {billType === 'GST' && (
        <Card className="p-0">
          <button type="button" className="flex w-full items-center gap-2 px-6 py-4 text-left text-sm font-semibold" aria-expanded={gstOpen} aria-controls="bf-gst-details" onClick={() => setGstOpen((o) => !o)}>
            GST details
            <ChevronDown className={`ml-auto size-4 text-muted-foreground transition-transform ${gstOpen ? 'rotate-180' : ''}`} aria-hidden />
          </button>
          {gstOpen && (
            <div id="bf-gst-details" className="flex flex-wrap items-end gap-4 border-t px-6 py-4">
              {kind === 'PURCHASE' ? (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="bf-itc">ITC eligibility</Label>
                    <Select value={gst.itcEligibility} onValueChange={(v) => setGst((g) => ({ ...g, itcEligibility: v as typeof g.itcEligibility }))}>
                      <SelectTrigger id="bf-itc" className="w-48"><SelectValue /></SelectTrigger>
                      <SelectContent>{ITC_OPTS.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  {gst.itcEligibility !== 'ELIGIBLE' && (
                    <div className="space-y-1.5">
                      <Label htmlFor="bf-itc-reason">Block reason</Label>
                      <Input id="bf-itc-reason" className="w-56" maxLength={200} placeholder="e.g. personal use" value={gst.itcBlockReason} onChange={(e) => setGst((g) => ({ ...g, itcBlockReason: e.target.value }))} />
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <Label htmlFor="bf-sup-inv">Supplier invoice no.</Label>
                    <Input id="bf-sup-inv" className="w-44" maxLength={40} value={gst.supplierInvoiceNo} onChange={(e) => setGst((g) => ({ ...g, supplierInvoiceNo: e.target.value }))} />
                  </div>
                  <div className="flex items-center gap-2 pb-2">
                    <Checkbox id="bf-rcm" checked={gst.reverseCharge} onCheckedChange={(v) => setGst((g) => ({ ...g, reverseCharge: !!v }))} />
                    <Label htmlFor="bf-rcm">Reverse charge</Label>
                  </div>
                </>
              ) : (
                <div className="space-y-1.5">
                  <Label htmlFor="bf-supply">Supply category</Label>
                  <Select value={gst.supplyCategory} onValueChange={(v) => setGst((g) => ({ ...g, supplyCategory: v as typeof g.supplyCategory }))}>
                    <SelectTrigger id="bf-supply" className="w-56"><SelectValue /></SelectTrigger>
                    <SelectContent>{SUPPLY_OPTS.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {/* Mobile sticky totals + Save bar (desktop uses the Save in the summary card). */}
      <div className="sticky bottom-0 z-10 -mx-6 flex items-center gap-3 border-t bg-card/95 px-6 pt-3 shadow-[0_-4px_16px_rgb(0_0_0/0.06)] pb-[calc(0.75rem+env(safe-area-inset-bottom))] tabular-nums backdrop-blur lg:hidden">
        <div className="text-sm">
          <div className="font-semibold">{inr(bill.final)}</div>
          <div className="text-xs text-muted-foreground">{t('bill.bal_short', { amount: inr(balanceDue) })}</div>
        </div>
        <Button className="ml-auto" disabled={!valid || pending} onClick={onSaveClick}>
          {pending ? t('bill.saving') : editBill ? t('bill.update_mpin_short') : t('bill.save_bill')}
        </Button>
      </div>

      <Dialog open={panOpen} onOpenChange={(o) => !o && setPanOpen(false)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('bill.pan_required')}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{t('bill.pan_desc')}</p>
          <Input value={pan} onChange={(e) => setPan(e.target.value.toUpperCase())} placeholder="ABCDE1234F" aria-label="PAN" />
          <DialogFooter>
            <Button disabled={!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan) || pending} onClick={() => { setPanOpen(false); void submit(pan, editBill ? editMpin : undefined) }}>{t('bill.save_with_pan')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MpinDialog open={mpinOpen} title={t('bill.auth_edit')} onConfirm={async (mpin) => { setEditMpin(mpin); setMpinOpen(false); await submit(undefined, mpin) }} onClose={() => setMpinOpen(false)} />

      {walkInDraft && (
        <NewPartyDialog
          open
          defaultType="CUSTOMER"
          defaultName={walkInDraft.name}
          defaultMobile={walkInDraft.mobile}
          onSaved={(p) => { setParty(p); setWalkInDraft(null) }}
          onClose={() => setWalkInDraft(null)}
        />
      )}
    </div>
  )
}

/** Direct (non-stock) line: optionally tie it to an item-master name of its class (custom text otherwise). */
function DirectItemName({ stockClass, value, onPick }: { stockClass: string; value?: number; onPick: (n: { id: number; name: string } | null) => void }) {
  const t = useT()
  const { data } = useItemNames({ stockClass, page: 1 })
  return (
    <Select value={value ? String(value) : 'custom'} onValueChange={(v) => onPick(v === 'custom' ? null : data?.items.find((n) => String(n.id) === v) ?? null)}>
      <SelectTrigger className="w-32" aria-label="Direct line item"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="custom">{t('bill.custom_item')}</SelectItem>
        {data?.items.map((n) => <SelectItem key={n.id} value={String(n.id)}>{n.name}</SelectItem>)}
      </SelectContent>
    </Select>
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
