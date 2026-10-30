import { ChevronDown, Columns3, Copy } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

import { JamaPayDialog } from '@/components/JamaPayDialog'
import { MpinDialog } from '@/components/MpinDialog'
import { NewPartyDialog } from '@/components/NewPartyDialog'
import { PartyPicker } from '@/components/PartyPicker'
import { SampleLookupButton } from '@/components/SamplePicker'
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
import { useBankAccounts, useKarats, useSaveSetting, useSettings } from '@/lib/appQueries'
import { useAuth } from '@/lib/auth'
import { useT } from '@/lib/i18n'
import { fetchDraftByNo, useDrafts } from '@/lib/draftsQueries'
import { ApiException } from '@/lib/errors'
import { lineRateUnitGrams, metalRateUnitGrams, useCreateBill, useNextBillNo, usePartyBalance, useUpdateBill } from '@/lib/billingQueries'
import { allCols, clearPersonalCols, COL_PRESETS, colsForKind, colsFromKeys, epcOk, huidOk, jtypesForMetal, loadPersonalCols, metalPayBody, PURCHASE_ONLY_COLS, purchaseLineExtras, resolveCols, savePersonalCols, shopColsValue, stoneRowFromDto, syncStoneCharge, type StoneRow } from '@/pages/app/billing/billFormParts'
import { StonesDialog } from '@/pages/app/billing/StonesDialog'
import { SchemeEnrollmentSelect } from '@/pages/app/billing/SchemeEnrollmentSelect'
import { ItemNameDialog } from '@/pages/app/inventory/ItemMasters'
import { useItemGroups, useItemNames, useJewelleryTypes, useStock } from '@/lib/inventoryQueries'
import { qs } from '@/lib/queries'
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
  type ItemNameDto,
  type OrderDto,
  type PartyRefDto,
  type StockItemDto,
  type StockListPage,
} from '@/shared'

let uid = 0
const nextKey = () => `k${uid++}`
const today = businessDayISO
const inr = (s: string | number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(s))

const browserStore = () => localStorage

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
  /** read-only HSN: stock item / item name code; group fallback resolved at render via groupId */
  hsn: string
  groupId?: number
  /** amount-based rate: the typed line total while the input is being edited (undefined = show computed) */
  totalIn?: string
  /** PURCHASE default sale value for the created stock item ('' = use the purchase values) */
  saleRate: string
  saleLabour: string
  saleLabourUnit: string
  saleOpen: boolean
  /** PURCHASE: supplier's item name / tag no. (bill line) + HUID / RFID EPC / remark (created stock item) */
  supplierItem: string
  supplierTag: string
  remarks: string
  huid: string
  epcCode: string
  /** PURCHASE (INV-12): stone elements for the created stock item */
  stones: StoneRow[]
}
const blankRow = (over: Partial<Row>): Row => ({
  key: nextKey(), description: '', stockClass: 'GOLD', tagNo: '', karatCode: '', pcs: '1', gross: '', less: '0', tunch: '',
  wastage: '0', stoneCharge: '0', rate: '0', labour: '0', labourUnit: 'PER_GRAM', other: '0', discount: '0', discountUnit: 'FIXED', locked: false,
  hsn: '', saleRate: '', saleLabour: '', saleLabourUnit: '', saleOpen: false,
  supplierItem: '', supplierTag: '', remarks: '', huid: '', epcCode: '', stones: [], ...over,
})
const rowFromStock = (it: StockItemDto): Row =>
  blankRow({
    stockItemId: it.id, itemNameId: it.itemName.id, description: it.itemName.name, stockClass: it.stockClass, tagNo: it.tagNo ?? '',
    karatCode: it.karatCode ?? '', pcs: String(it.pcs), gross: it.gross, less: it.less, tunch: it.tunch, wastage: it.wastage,
    stoneCharge: it.stoneCharge, labour: it.labour, labourUnit: it.labourUnit, other: it.other, locked: it.method === 'TAG',
    hsn: it.hsnCode ?? '', groupId: it.group.id,
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
  /** SCHEME pay rows (TASK-98) */
  enrollmentId: string
  /** METAL rows with calc.metalPayRate.fromAmount: ₹ amount the rate is worked back from ('' = rate typed directly) */
  amountIn: string
  /** METAL rows: jewellery type of the received metal ('' = none) */
  jewelleryTypeId: string
}
const blankPay = (mode: string): PayRow => ({ key: nextKey(), mode, amount: '', bankAccountId: '', metal: 'GOLD', metalForm: 'BULLION', gross: '', less: '0', tunch: '', rate: '', remark: '', enrollmentId: '', amountIn: '', jewelleryTypeId: '' })

// ── edit-mode prefill: map a saved bill's lines/payments back into editable rows ──
const rowFromLine = (it: BillLineDto): Row =>
  blankRow({
    stockItemId: it.stockItemId ?? undefined, itemNameId: it.itemNameId ?? undefined, description: it.description, stockClass: it.stockClass,
    tagNo: it.tagNo ?? '', karatCode: it.karatCode ?? '', pcs: String(it.pcs), gross: it.gross, less: it.less, tunch: it.tunch, wastage: it.wastage,
    stoneCharge: it.stoneCharge, rate: it.rate, labour: it.labour, labourUnit: it.labourUnit, other: it.other, discount: it.discount, discountUnit: it.discountUnit,
    locked: !!it.stockItemId && !!it.tagNo, // TAG stock line → weights from the item
    hsn: it.hsnCode ?? '',
    supplierItem: it.supplierItem ?? '', supplierTag: it.supplierTag ?? '', remarks: it.remarks ?? '', huid: it.huid ?? '', epcCode: it.epcCode ?? '',
    stones: (it.stones ?? []).map(stoneRowFromDto),
  })
const payFromDto = (p: BillPaymentDto): PayRow => ({
  key: nextKey(), mode: p.mode, amount: p.mode === 'METAL' ? '' : p.amount, bankAccountId: p.bankAccount ? String(p.bankAccount.id) : '',
  metal: p.metal ?? 'GOLD', metalForm: p.metalForm ?? 'BULLION',
  gross: p.gross ?? '', less: p.gross && p.net ? String(Number(p.gross) - Number(p.net)) : '0', tunch: p.tunch ?? '', rate: p.rate ?? '', remark: p.remark ?? '',
  enrollmentId: p.schemeEnrollmentId != null ? String(p.schemeEnrollmentId) : '',
  amountIn: '',
  jewelleryTypeId: p.jewelleryType ? String(p.jewelleryType.id) : '',
})

// [value, i18n key] for the GST details block
const ITC_OPTS = [['ELIGIBLE', 'gst.itc_eligible'], ['BLOCKED_17_5', 'gst.itc_blocked_us'], ['INELIGIBLE', 'gst.itc_ineligible']] as const
const SUPPLY_OPTS = [['TAXABLE', 'gst.taxable'], ['ZERO_RATED', 'gst.supply_zero_rated'], ['NIL_EXEMPT', 'gst.supply_nil_exempt'], ['NON_GST', 'gst.supply_non_gst']] as const

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
  // this session's personal choice (null = reset), tagged with its kind: sell and purchase share this component instance
  const [colsOverride, setColsOverride] = useState<{ kind: BillKind; cols: Record<string, boolean> | null } | null>(null)
  const browserCols = useMemo(() => loadPersonalCols(browserStore, kind), [kind])
  const personalCols = colsOverride?.kind === kind ? colsOverride.cols : browserCols
  const cols = resolveCols(personalCols, settings?.['billing.columns']?.[kind === 'SELL' ? 'sell' : 'purchase'])
  const optCols = colsForKind(kind)
  const show = (k: string) => !!cols[k] && (kind === 'PURCHASE' || !PURCHASE_ONLY_COLS.has(k))
  const setPersonalCols = (n: Record<string, boolean>) => { savePersonalCols(browserStore, kind, n); setColsOverride({ kind, cols: n }) }
  const toggleCol = (k: string) => setPersonalCols({ ...cols, [k]: !cols[k] })
  const applyPreset = (keys: readonly string[] | 'all') => setPersonalCols(keys === 'all' ? allCols() : colsFromKeys(keys))
  const resetCols = () => { clearPersonalCols(browserStore, kind); setColsOverride({ kind, cols: null }) }
  const saveSetting = useSaveSetting()
  const [colsMpinOpen, setColsMpinOpen] = useState(false)
  const [jamaOpen, setJamaOpen] = useState(false)
  const [stonesFor, setStonesFor] = useState<number | null>(null) // INV-12: row index whose Stones dialog is open
  const [sendWa, setSendWa] = useState<boolean | null>(null) // null = follow print.defaults.postSaveShareDialog
  const waOn = sendWa ?? !!settings?.['print.defaults'].postSaveShareDialog

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

  const [draftSearch, setDraftSearch] = useState(false) // TASK-98: find an APPROVED draft by customer name/mobile
  const retrieveDraft = async (pickedNo?: number) => {
    const no = pickedNo ?? Number(draftNo)
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
  // TASK-98 purchase entry type (filters item names by method; BOTH names fit either), repeat count, clear-after-add
  const [buyMethod, setBuyMethod] = useState<'ALL' | 'LOOSE' | 'TAG'>('ALL')
  const buyList = buyNames?.items.filter((n) => buyMethod === 'ALL' || n.method === buyMethod || n.method === 'BOTH')
  const [repeatN, setRepeatN] = useState('1')
  const [clearAfterAdd, setClearAfterAdd] = useState(false)
  const [newItemOpen, setNewItemOpen] = useState(false)
  const repeatCount = Math.min(50, Math.max(1, Math.floor(Number(repeatN)) || 1))

  // HSN column: item-name / stock code on the row, else its item group's code
  const { data: groups } = useItemGroups({ page: 1, pageSize: 100 })
  const groupHsn = useMemo(() => new Map((groups?.items ?? []).map((g) => [g.id, g.hsn?.code ?? ''])), [groups])
  const hsnOf = (r: Row) => r.hsn || (r.groupId != null ? groupHsn.get(r.groupId) : '') || ''

  const amountBased = kind === 'SELL' && !!settings?.['calc.amountBasedRate']?.enabled
  const metalFromAmount = !!settings?.['calc.metalPayRate']?.fromAmount

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

  // calc.amountBasedRate: line total is linear in rate (incl. % discount) → rate = (target − total(0)) / slope.
  // A large probe rate keeps the 2-dp rounding of computeLine's total out of the slope.
  const rateForTotal = (r: Row, target: number): string | null => {
    const PROBE = 100000
    const t0 = Number(lineOf({ ...r, rate: '0' }).total)
    const slope = (Number(lineOf({ ...r, rate: String(PROBE) }).total) - t0) / PROBE
    if (!(slope > 0) || !Number.isFinite(target)) return null
    return String(Math.max(0, Math.round(((target - t0) / slope) * 100) / 100))
  }
  const setLineTotal = (i: number, v: string) =>
    setRows((rs) => rs.map((r, j) => {
      if (j !== i) return r
      const rate = v === '' ? null : rateForTotal(r, Number(v))
      return { ...r, totalIn: v, ...(rate != null ? { rate } : {}) }
    }))

  // calc.metalPayRate.fromAmount: rate = amount × rate-unit grams / fine (re-derived when weights change)
  const payFine = (p: PayRow) => (((Number(p.gross) || 0) - (Number(p.less) || 0)) * (Number(p.tunch) || 0)) / 100
  const withAmountRate = (p: PayRow): PayRow => {
    if (p.mode !== 'METAL' || p.amountIn === '') return p
    const fine = payFine(p)
    if (!(fine > 0)) return p
    return { ...p, rate: String(Math.round((((Number(p.amountIn) || 0) * metalRateUnitGrams(p.metal, settings)) / fine) * 100) / 100) }
  }
  const patchPay = (i: number, patch: Partial<PayRow>) => setPays((ps) => ps.map((x, j) => (j === i ? withAmountRate({ ...x, ...patch }) : x)))

  // purchase tag no.: warn (advisory) when the tag already exists in stock or on another line
  const checkTag = async (i: number, raw: string) => {
    const tag = raw.trim().toUpperCase()
    if (!tag) return
    if (rows.some((r, j) => j !== i && r.tagNo.trim().toUpperCase() === tag)) { toast.warning(t('bill98.tag_dup_row', { tag })); return }
    try {
      const res = await api.get<StockListPage>(`/app/stock${qs({ q: tag, status: 'ALL', pageSize: 20 })}`)
      if (res.items.some((it) => (it.tagNo ?? '').toUpperCase() === tag)) toast.warning(t('bill98.tag_exists', { tag }))
    } catch { /* lookup is advisory only */ }
  }

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
    setRows((rs) => [...rs, ...Array.from({ length: repeatCount }, () => blankRow({ itemNameId: n.id, description: n.name, stockClass: buyClass, hsn: n.hsn?.code ?? '', groupId: n.group.id }))])
    if (clearAfterAdd) { setBuyItemId(''); setRepeatN('1') }
  }
  // purchase row "repeat": append the row N more times with the same values (own tag no. cleared — tags are unique)
  const repeatRow = (i: number) =>
    setRows((rs) => { const src = rs[i]; return src ? [...rs, ...Array.from({ length: repeatCount }, () => ({ ...src, key: nextKey(), tagNo: '', totalIn: undefined }))] : rs })

  const valid = branchReady && !!party && rows.length > 0 && rows.every((r) => Number(r.gross) > 0 && (r.stockItemId || r.itemNameId || (r.description && r.stockClass)) && (kind !== 'PURCHASE' || (huidOk(r.huid) && epcOk(r.epcCode))))

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
        ...(kind === 'PURCHASE' && !r.stockItemId ? {
          saleRate: r.saleRate !== '' ? Number(r.saleRate) || 0 : undefined,
          saleLabour: r.saleLabour !== '' ? Number(r.saleLabour) || 0 : undefined,
          saleLabourUnit: r.saleLabourUnit || undefined,
        } : {}),
        ...purchaseLineExtras(kind, r),
      })),
      discount: Number(discount) || 0, discountUnit, gstPercent: Number(gstPercent) || 0,
      payments: pays.map((p) =>
        p.mode === 'METAL'
          ? metalPayBody(p)
          : p.mode === 'ONLINE'
            ? { mode: 'ONLINE', amount: Number(p.amount) || 0, bankAccountId: Number(p.bankAccountId), remark: p.remark || undefined }
            : p.mode === 'SCHEME'
              ? { mode: 'SCHEME', enrollmentId: Number(p.enrollmentId), amount: Number(p.amount) || 0, remark: p.remark || undefined }
              : { mode: p.mode === 'UDHAR_ADVANCE' ? 'UDHAR_ADVANCE' : 'CASH', amount: Number(p.amount) || 0, remark: p.remark || undefined },
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
      toast.success(editBill ? t('bill.updated') : t('bill.saved'))
      // "Send on WhatsApp" (default: print.defaults.postSaveShareDialog) → BillView opens its share dialog
      navigate(`/app/billing/view/${saved.id}`, !editBill && waOn && saved.party.mobile ? { state: { share: true } } : undefined)
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
  // original header "RATE (G: /10GM, S: /1KG)"; purchase lines are per gram
  const unitLabel = (g: number) => (g >= 1000 ? `${g / 1000}KG` : `${g}GM`)
  const rateUnitHint = kind === 'SELL'
    ? `G: /${unitLabel(lineRateUnitGrams(kind, 'GOLD', settings))}, S: /${unitLabel(lineRateUnitGrams(kind, 'SILVER', settings))}`
    : '/GM'

  return (
    <div className="space-y-4">
      {editBill && <p className="text-sm text-muted-foreground">{t('bill.sub_edit')}</p>}
      {!branchReady && <SelectBranchForTxn note={t('bill.branch_note')} />}

      {/* Header + add-line controls in one card (compact: less scrolling). No overflow clipping: the stock dropdown overflows it. */}
      <Card className="space-y-4 p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <div className="space-y-1.5 lg:col-span-2">
          <Label htmlFor="bf-party">{kind === 'SELL' ? t('bill.customer') : t('bill.supplier')}</Label>
          <PartyPicker value={party} onChange={setParty} placeholder={t('bill.search_party')} id="bf-party" ariaLabel={kind === 'SELL' ? 'Customer' : 'Supplier'} />
          {party && (
            <div className="flex flex-wrap items-center gap-2">
              <p className="w-fit rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                {party.mobile}
                {balance && `${t('bill.party_balance', { amount: balance.amount })}${Number(balance.gold) ? ` · ${balance.gold}g Au` : ''}${Number(balance.silver) ? ` · ${balance.silver}g Ag` : ''}`}
              </p>
              {can('udhari.entry', 'edit') && (
                // take an old udhar payment (jama) for this party without leaving billing
                <Button type="button" variant="link" size="sm" className="ml-auto h-auto p-0 text-xs font-semibold" onClick={() => setJamaOpen(true)}>{t('jama.button')}</Button>
              )}
            </div>
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
      </div>

      <div className="border-t pt-3">
      {kind === 'SELL' ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-end gap-2">
          <div className="relative w-full space-y-1.5 sm:w-80">
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
          </div>
            <Button type="button" variant="outline" size="sm" onClick={() => setRows((rs) => [...rs, blankRow({})])}>{t('bill.direct_line')}</Button>
            {!editBill && (
              <>
                {/* QR scanners type the draft no. + Enter here (the slip QR is the bare no.) */}
                <Input className="w-32" placeholder={t('bill.draft_no_ph')} aria-label="Draft number" aria-describedby="bf-draft-help" value={draftNo} onChange={(e) => setDraftNo(e.target.value.replace(/[\s#]/g, ''))} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void retrieveDraft() } }} />
                <Button type="button" variant="outline" size="sm" onClick={() => void retrieveDraft()}>{t('bill.retrieve_draft')}</Button>
                <Button type="button" variant="ghost" size="sm" aria-expanded={draftSearch} onClick={() => setDraftSearch((o) => !o)}>{t('bill98.find_draft')}</Button>
              </>
            )}
          {!editBill && (
            <div className="flex flex-wrap items-center gap-2 pb-2">
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
          {!editBill && draftSearch && (
            <DraftByCustomer onPick={(no) => { setDraftNo(String(no)); void retrieveDraft(no) }} />
          )}
          {!editBill && <p id="bf-draft-help" className="text-xs text-muted-foreground">{t('bill.draft_scan_help')}</p>}
          {draftId && <p className="text-xs text-muted-foreground">{t('bill.from_draft')}</p>}
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
            <Label>{t('bill98.entry_type')}</Label>
            <Select value={buyMethod} onValueChange={(v) => { setBuyMethod(v as typeof buyMethod); setBuyItemId('') }}>
              <SelectTrigger className="w-28" aria-label="Entry type"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t('bill98.entry_both')}</SelectItem>
                <SelectItem value="LOOSE">{t('bill98.entry_loose')}</SelectItem>
                <SelectItem value="TAG">{t('bill98.entry_tag')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t('bill.item_name')}</Label>
            <Select value={buyItemId} onValueChange={setBuyItemId}>
              <SelectTrigger className="w-56" aria-label="Item name"><SelectValue placeholder={t('bill.select')} /></SelectTrigger>
              <SelectContent>{buyList?.map((n) => <SelectItem key={n.id} value={String(n.id)}>{n.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bf-repeat">{t('bill98.repeat')}</Label>
            <Input id="bf-repeat" className="w-20" type="number" min="1" max="50" aria-label="Repeat count" value={repeatN} onChange={(e) => setRepeatN(e.target.value)} />
          </div>
          <Button type="button" variant="outline" onClick={addPurchaseRow}>{t('bill.add_row')}</Button>
          {can('inventory.item_masters', 'edit') && (
            // original "CREATE ITEM": new item name without leaving the bill; picked straight away
            <Button type="button" variant="ghost" onClick={() => setNewItemOpen(true)}>{t('bill.create_item')}</Button>
          )}
          <div className="flex items-center gap-2 pb-2">
            <Checkbox id="bf-clear-after" checked={clearAfterAdd} onCheckedChange={(v) => setClearAfterAdd(!!v)} />
            <Label htmlFor="bf-clear-after" className="font-normal">{t('bill98.clear_after_add')}</Label>
          </div>
        </div>
      )}
      </div>
      </Card>

      {/* Item grid: must stay the first <table> on the page and before payments (specs use tbody tr / Rate .first()). */}
      <Card className="overflow-hidden">
      <div className="flex justify-end gap-2 border-b bg-muted/40 px-4 py-2">
        <SampleLookupButton />
        <Popover>
          <PopoverTrigger asChild><Button type="button" variant="outline" size="sm"><Columns3 aria-hidden />{t('bill.columns')}</Button></PopoverTrigger>
          <PopoverContent align="end" className="w-56 space-y-2">
            <div className="flex flex-wrap gap-1 border-b pb-2">
              <Button type="button" size="sm" variant="ghost" className="h-7 px-2" onClick={() => applyPreset('all')}>{t('bill.cols_all')}</Button>
              <Button type="button" size="sm" variant="ghost" className="h-7 px-2" onClick={() => applyPreset(COL_PRESETS.simple)}>{t('bill.cols_simple')}</Button>
              <Button type="button" size="sm" variant="ghost" className="h-7 px-2" onClick={() => applyPreset(COL_PRESETS.tunch)}>{t('bill.cols_tunch')}</Button>
              {/* drops the personal choice: back to the shop default (or all columns when the shop has none) */}
              <Button type="button" size="sm" variant="ghost" className="h-7 px-2" disabled={!personalCols} onClick={resetCols}>{t('bill.cols_reset')}</Button>
            </div>
            {optCols.map((c) => (
              <label key={c.key} className="flex items-center gap-2 text-sm">
                <Checkbox checked={cols[c.key]} onCheckedChange={() => toggleCol(c.key)} aria-label={c.label} /> {t(c.tk)}
              </label>
            ))}
            {can('settings.misc', 'edit') && (
              <Button type="button" size="sm" variant="outline" className="mt-1 w-full" onClick={() => setColsMpinOpen(true)}>{t('bill.cols_save_default')}</Button>
            )}
          </PopoverContent>
        </Popover>
      </div>
      <div className={`overflow-x-auto ${TABLE_EDGES}`}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-44">{t('bill.col_item')}</TableHead>
              {cols.hsn && <TableHead>{t('bill98.col_hsn')}</TableHead>}
              {show('suppItem') && <TableHead>{t('bill.col_supp_item')}</TableHead>}
              {show('suppTag') && <TableHead>{t('bill.col_supp_tag')}</TableHead>}
              {show('remark') && <TableHead>{t('bill.col_remark')}</TableHead>}
              {show('huid') && <TableHead>{t('bill.col_huid')}</TableHead>}
              {cols.karat && <TableHead>{t('stock.col_karat')}</TableHead>}
              {cols.pcs && <TableHead>{t('stock.col_pcs')}</TableHead>}
              <TableHead>{t('stock.col_gross')}</TableHead>
              {cols.less && <TableHead>{t('bill.col_less')}</TableHead>}
              {cols.tunch && <TableHead>{t('bill.col_tunch')}</TableHead>}
              {cols.wastage && <TableHead>{t('bill.col_wastage')}</TableHead>}
              {cols.net && <TableHead>{t('stock.col_net')}</TableHead>}
              {cols.fine && <TableHead>{t('stock.col_fine')}</TableHead>}
              {cols.stone && <TableHead>{t('class.STONE')}</TableHead>}
              {cols.rate && (
                <TableHead title={rateUnitHint}>
                  {t('udhari.rate')}
                  {/* unit hint is aria-hidden so the header's accessible name stays "Rate" (specs + screen readers get it via title) */}
                  {kind === 'SELL' && <span aria-hidden className="ml-1 text-xs font-normal text-muted-foreground">({rateUnitHint})</span>}
                </TableHead>
              )}
              {cols.labour && <TableHead>{t('bill.col_labour')}</TableHead>}
              {cols.unit && <TableHead>{t('bill.col_unit')}</TableHead>}
              {cols.other && <TableHead>{t('bill.col_other')}</TableHead>}
              {cols.disc && <TableHead>{t('bill.col_disc')}</TableHead>}
              {show('rfid') && <TableHead>{t('bill.col_rfid')}</TableHead>}
              <TableHead>{t('bill.col_total')}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={4 + optCols.filter((c) => cols[c.key]).length} className="h-12 text-center text-muted-foreground">{t('bill.no_items')}</TableCell></TableRow>
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
                          <Input className="mt-1 h-8 w-32" placeholder={t('bill.tag_no_ph')} aria-label="Tag number" value={r.tagNo} onChange={(e) => setRow(i, 'tagNo', e.target.value)} onBlur={(e) => void checkTag(i, e.target.value)} />
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
                          onPick={(n) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, itemNameId: n?.id, description: n ? n.name : x.description, hsn: n?.hsn?.code ?? '', groupId: n?.group.id } : x)))}
                        />
                      </div>
                    )}
                  </TableCell>
                  {cols.hsn && <TableCell className="whitespace-nowrap text-muted-foreground">{hsnOf(r) || '—'}</TableCell>}
                  {show('suppItem') && <TableCell><Input className="w-32" maxLength={120} aria-label="Supplier item" value={r.supplierItem} onChange={(e) => setRow(i, 'supplierItem', e.target.value)} /></TableCell>}
                  {show('suppTag') && <TableCell><Input className="w-24" maxLength={30} aria-label="Supplier tag" value={r.supplierTag} onChange={(e) => setRow(i, 'supplierTag', e.target.value)} /></TableCell>}
                  {show('remark') && <TableCell><Input className="w-32" maxLength={300} aria-label="Line remark" value={r.remarks} onChange={(e) => setRow(i, 'remarks', e.target.value)} /></TableCell>}
                  {show('huid') && <TableCell><Input className="w-24 uppercase" maxLength={6} placeholder="6 chars" aria-label="HUID" aria-invalid={!huidOk(r.huid)} value={r.huid} onChange={(e) => setRow(i, 'huid', e.target.value.toUpperCase())} /></TableCell>}
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
                  {cols.stone && <TableCell><Input className="w-20" type="number" aria-label="Stone charge" readOnly={r.stones.length > 0} title={r.stones.length ? t('bill.stones_hint') : undefined} value={r.stoneCharge} onChange={(e) => setRow(i, 'stoneCharge', e.target.value)} /></TableCell>}
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
                  {show('rfid') && <TableCell><Input className="w-32 uppercase" maxLength={64} placeholder="EPC (hex)" aria-label="RFID EPC" aria-invalid={!epcOk(r.epcCode)} value={r.epcCode} onChange={(e) => setRow(i, 'epcCode', e.target.value.toUpperCase())} /></TableCell>}
                  <TableCell className="whitespace-nowrap font-medium">
                    {amountBased ? (
                      // calc.amountBasedRate: type the total, the rate is worked back
                      <Input className="w-28" type="number" step="0.01" min="0" aria-label="Line total" title={t('bill98.line_total_hint')} value={r.totalIn ?? lr.total}
                        onChange={(e) => setLineTotal(i, e.target.value)} onBlur={() => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, totalIn: undefined } : x)))} />
                    ) : lr.total}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-start gap-1">
                      {kind === 'PURCHASE' && !r.stockItemId && (
                        <div className="space-y-1">
                          <div className="flex gap-1">
                            <Button type="button" variant="ghost" size="sm" aria-expanded={r.saleOpen} onClick={() => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, saleOpen: !x.saleOpen } : x)))}>
                              {t('bill98.sale_value')}<ChevronDown className={`size-3 transition-transform ${r.saleOpen ? 'rotate-180' : ''}`} aria-hidden />
                            </Button>
                            <Button type="button" variant="ghost" size="sm" aria-label="Repeat line" title={t('bill98.repeat_line', { n: repeatCount })} onClick={() => repeatRow(i)}><Copy aria-hidden /></Button>
                            <Button type="button" variant="ghost" size="sm" aria-label="Stones" onClick={() => setStonesFor(i)}>{t('bill.stones')}{r.stones.length ? ` (${r.stones.length})` : ''}</Button>
                          </div>
                          {r.saleOpen && (
                            <div className="flex gap-1">
                              <Input className="h-8 w-24" type="number" min="0" placeholder={t('bill98.sale_rate_ph')} aria-label="Default sale value" value={r.saleRate} onChange={(e) => setRow(i, 'saleRate', e.target.value)} />
                              <Input className="h-8 w-20" type="number" min="0" placeholder={t('bill98.sale_labour_ph')} aria-label="Default sale making" value={r.saleLabour} onChange={(e) => setRow(i, 'saleLabour', e.target.value)} />
                              <Select value={r.saleLabourUnit} onValueChange={(v) => setRow(i, 'saleLabourUnit', v)}>
                                <SelectTrigger className="h-8 w-28" aria-label="Default sale making unit"><SelectValue placeholder={t('bill98.sale_unit_ph')} /></SelectTrigger>
                                <SelectContent>{CHARGE_UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                              </Select>
                            </div>
                          )}
                        </div>
                      )}
                      <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" aria-label="Remove line" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))} title="Remove">✕</Button>
                    </div>
                  </TableCell>
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
                  {cols.hsn && blank}
                  {show('suppItem') && blank}
                  {show('suppTag') && blank}
                  {show('remark') && blank}
                  {show('huid') && blank}
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
                  {show('rfid') && blank}
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
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)]">
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 border-b bg-muted/40 px-4 py-2">
            <h2 className="text-base font-bold">{t('bill.payments')}</h2>
            <div className="ml-auto flex flex-wrap gap-1">
              <Button type="button" size="sm" variant="outline" onClick={() => setPays((p) => [...p, blankPay('CASH')])}>{t('bill.add_cash')}</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setPays((p) => [...p, blankPay('ONLINE')])}>{t('bill.add_online')}</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setPays((p) => [...p, blankPay('METAL')])}>{t('bill.add_metal')}</Button>
              {kind === 'SELL' && party && (
                <>
                  <Button type="button" size="sm" variant="outline" onClick={() => setPays((p) => [...p, blankPay('SCHEME')])}>{t('bill.add_scheme')}</Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => setPays((p) => [...p, blankPay('UDHAR_ADVANCE')])}>{t('bill.add_advance')}</Button>
                </>
              )}
            </div>
          </div>
          <div className="space-y-2 p-4">
          {pays.map((p, i) => (
            <div key={p.key} className="flex flex-wrap items-center gap-2 rounded-xl border bg-muted/40 p-2">
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${p.mode === 'METAL' ? 'bg-brand/15 text-brand-strong' : 'bg-muted text-muted-foreground'}`}>{p.mode}</span>
              {p.mode === 'METAL' ? (
                <>
                  <Select value={p.metal} onValueChange={(v) => patchPay(i, { metal: v, jewelleryTypeId: '' })}>
                    <SelectTrigger className="w-24" aria-label="Metal"><SelectValue /></SelectTrigger>
                    <SelectContent>{METALS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={p.metalForm} onValueChange={(v) => setPays((ps) => ps.map((x, j) => j === i ? { ...x, metalForm: v } : x))}>
                    <SelectTrigger className="w-28" aria-label="Metal form"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="BULLION">{t('bill.form_bullion')}</SelectItem><SelectItem value="KACHA">{t('bill.form_kacha')}</SelectItem></SelectContent>
                  </Select>
                  <PayJewelleryType metal={p.metal} value={p.jewelleryTypeId} onChange={(v) => patchPay(i, { jewelleryTypeId: v })} />
                  <Input className="w-20" type="number" placeholder={t('stock.col_gross')} aria-label="Gross" value={p.gross} onChange={(e) => patchPay(i, { gross: e.target.value })} />
                  <Input className="w-16" type="number" placeholder={t('bill.col_less')} aria-label="Less" value={p.less} onChange={(e) => patchPay(i, { less: e.target.value })} />
                  <span className="text-sm tabular-nums text-muted-foreground">{t('stock.col_net')} {((Number(p.gross) || 0) - (Number(p.less) || 0)).toFixed(3)}</span>
                  <Input className="w-16" type="number" placeholder={t('bill.col_tunch')} aria-label="Tunch" value={p.tunch} onChange={(e) => patchPay(i, { tunch: e.target.value })} />
                  <SampleLookupButton metal={p.metal} />
                  <Input className="w-24" type="number" placeholder={t('udhari.rate')} aria-label="Rate" value={p.rate} onChange={(e) => setPays((ps) => ps.map((x, j) => j === i ? { ...x, rate: e.target.value, amountIn: '' } : x))} />
                  {metalFromAmount && (
                    // calc.metalPayRate.fromAmount: rate = amount × rate unit / fine
                    <Input className="w-28" type="number" min="0" placeholder={t('bill98.metal_amount_ph')} title={t('bill98.metal_amount_hint')} aria-label="Metal value ₹" value={p.amountIn} onChange={(e) => patchPay(i, { amountIn: e.target.value })} />
                  )}
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
                  {p.mode === 'SCHEME' && party && (
                    // picking an enrollment prefills its value, capped at what is still due
                    <SchemeEnrollmentSelect className="w-60" partyId={party.id} value={p.enrollmentId}
                      onChange={(id, value) => setPays((ps) => ps.map((x, j) => j === i ? { ...x, enrollmentId: id, amount: x.amount || String(Math.max(0, Math.min(value, balanceDue))) } : x))} />
                  )}
                  {p.mode === 'UDHAR_ADVANCE' && (
                    <span className="text-xs text-muted-foreground">{t('bill.adv_available', { amount: inr(Math.max(0, -Number(balance?.amount ?? 0))) })}</span>
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

        <Card className="space-y-1.5 self-start p-4 text-sm tabular-nums lg:sticky lg:top-4">
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
          {/* live-preview note as a tooltip (compact: the original has no note) */}
          <div className="flex justify-between border-t-2 border-brand pt-3 text-lg font-extrabold" title={t('bill.live_preview')}><span>{t('bill.final')}</span><span>{inr(bill.final)}</span></div>
          <Row2 label={t('bill.paid')} value={inr(paid)} />
          <div className={`-mx-3 flex justify-between rounded-xl px-3 py-2 font-semibold ${balanceDue < 0 ? 'bg-green-500/10' : 'bg-muted/50'}`}><span>{t('bill.balance')}</span><span className={balanceDue < 0 ? 'text-green-600 dark:text-green-500' : ''}>{inr(balanceDue)}{balanceDue < 0 ? t('bill.advance') : ''}</span></div>
          {!editBill && party?.mobile && (
            <label className="flex items-center gap-2 rounded-xl border border-green-600/30 bg-green-500/5 px-3 py-2 text-sm font-medium">
              <Checkbox checked={waOn} onCheckedChange={(v) => setSendWa(v === true)} aria-label="Send on WhatsApp" />
              {t('bill.send_whatsapp')}
            </label>
          )}
          <Button size="lg" className="mt-2 hidden w-full lg:inline-flex" disabled={!valid || pending} onClick={onSaveClick}>
            {pending ? t('bill.saving') : editBill ? t('bill.update_mpin') : kind === 'SELL' ? t('bill.save_sell') : t('bill.save_purchase')}
          </Button>
        </Card>
      </div>

      {billType === 'GST' && (
        <Card className="p-0">
          <button type="button" className="flex w-full items-center gap-2 px-6 py-4 text-left text-sm font-semibold" aria-expanded={gstOpen} aria-controls="bf-gst-details" onClick={() => setGstOpen((o) => !o)}>
            {t('gst.details')}
            <ChevronDown className={`ml-auto size-4 text-muted-foreground transition-transform ${gstOpen ? 'rotate-180' : ''}`} aria-hidden />
          </button>
          {gstOpen && (
            <div id="bf-gst-details" className="flex flex-wrap items-end gap-4 border-t px-6 py-4">
              {kind === 'PURCHASE' ? (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="bf-itc">{t('gst.itc_eligibility')}</Label>
                    <Select value={gst.itcEligibility} onValueChange={(v) => setGst((g) => ({ ...g, itcEligibility: v as typeof g.itcEligibility }))}>
                      <SelectTrigger id="bf-itc" className="w-48"><SelectValue /></SelectTrigger>
                      <SelectContent>{ITC_OPTS.map(([v, l]) => <SelectItem key={v} value={v}>{t(l)}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  {gst.itcEligibility !== 'ELIGIBLE' && (
                    <div className="space-y-1.5">
                      <Label htmlFor="bf-itc-reason">{t('gst.block_reason')}</Label>
                      <Input id="bf-itc-reason" className="w-56" maxLength={200} placeholder={t('gst.block_reason_ph')} value={gst.itcBlockReason} onChange={(e) => setGst((g) => ({ ...g, itcBlockReason: e.target.value }))} />
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <Label htmlFor="bf-sup-inv">{t('gst.supplier_inv_no')}</Label>
                    <Input id="bf-sup-inv" className="w-44" maxLength={40} value={gst.supplierInvoiceNo} onChange={(e) => setGst((g) => ({ ...g, supplierInvoiceNo: e.target.value }))} />
                  </div>
                  <div className="flex items-center gap-2 pb-2">
                    <Checkbox id="bf-rcm" checked={gst.reverseCharge} onCheckedChange={(v) => setGst((g) => ({ ...g, reverseCharge: !!v }))} />
                    <Label htmlFor="bf-rcm">{t('gst.reverse_charge')}</Label>
                  </div>
                </>
              ) : (
                <div className="space-y-1.5">
                  <Label htmlFor="bf-supply">{t('gst.supply_category')}</Label>
                  <Select value={gst.supplyCategory} onValueChange={(v) => setGst((g) => ({ ...g, supplyCategory: v as typeof g.supplyCategory }))}>
                    <SelectTrigger id="bf-supply" className="w-56"><SelectValue /></SelectTrigger>
                    <SelectContent>{SUPPLY_OPTS.map(([v, l]) => <SelectItem key={v} value={v}>{t(l)}</SelectItem>)}</SelectContent>
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
      <MpinDialog
        open={colsMpinOpen}
        title={t('bill.cols_save_default')}
        onConfirm={async (mpin) => {
          await saveSetting.mutateAsync({ key: 'billing.columns', value: shopColsValue(settings?.['billing.columns'], kind, cols), mpin })
          setColsMpinOpen(false)
        }}
        onClose={() => setColsMpinOpen(false)}
      />
      {party && <JamaPayDialog party={party} open={jamaOpen} onClose={() => setJamaOpen(false)} />}
      {stonesFor != null && rows[stonesFor] && (
        <StonesDialog stones={rows[stonesFor].stones} onClose={() => setStonesFor(null)}
          onSave={(st) => { setRows((rs) => rs.map((x, j) => (j === stonesFor ? syncStoneCharge({ ...x, stones: st }) : x))); setStonesFor(null) }} />
      )}
      {newItemOpen && (
        <ItemNameDialog
          groups={(groups?.items ?? []).filter((g) => g.stockClass === buyClass)}
          stockClass={buyClass}
          onCreated={(n) => {
            if (n.group.stockClass !== buyClass) return
            if (buyMethod !== 'ALL' && n.method !== buyMethod && n.method !== 'BOTH') setBuyMethod('ALL') // else the picked name is hidden by the Loose/Tag filter
            setBuyItemId(String(n.id))
          }}
          onClose={() => setNewItemOpen(false)}
        />
      )}

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
function DirectItemName({ stockClass, value, onPick }: { stockClass: string; value?: number; onPick: (n: ItemNameDto | null) => void }) {
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

/** METAL pay row: jewellery type of the received metal (global + own list, filtered to the metal). Hidden if the list can't load (MASTERS view). */
function PayJewelleryType({ metal, value, onChange }: { metal: string; value: string; onChange: (v: string) => void }) {
  const t = useT()
  const { data, isError } = useJewelleryTypes() // unfiltered: the server's stockClass filter would drop class-less global types
  const opts = jtypesForMetal(data ?? [], metal)
  if (isError || !opts.length) return null
  return (
    <Select value={value || 'none'} onValueChange={(v) => onChange(v === 'none' ? '' : v)}>
      <SelectTrigger className="w-36" aria-label="Jewellery type"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="none">{t('bill.jtype_none')}</SelectItem>
        {opts.map((jt) => <SelectItem key={jt.id} value={String(jt.id)}>{jt.name}</SelectItem>)}
      </SelectContent>
    </Select>
  )
}

/** TASK-98: pick an APPROVED draft by customer name / mobile (server q); mounted only while open. */
function DraftByCustomer({ onPick }: { onPick: (draftNo: number) => void }) {
  const t = useT()
  const [query, setQuery] = useState('')
  const [q, setQ] = useState('')
  useEffect(() => {
    const timer = setTimeout(() => setQ(query.trim()), 250)
    return () => clearTimeout(timer)
  }, [query])
  const { data, isLoading, isError } = useDrafts({ status: 'APPROVED', q: q || undefined, page: 1, pageSize: 20 })
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <Input className="w-48" type="search" placeholder={t('bill98.draft_search_ph')} aria-label="Search approved drafts" value={query} onChange={(e) => setQuery(e.target.value)} />
      <Select value="" onValueChange={(v) => onPick(Number(v))}>
        <SelectTrigger className="w-72" aria-label="Approved draft"><SelectValue placeholder={isLoading ? t('bill98.loading') : t('bill98.pick_draft')} /></SelectTrigger>
        <SelectContent>
          {isError
            ? <div className="px-3 py-2 text-sm text-muted-foreground">{t('bill98.drafts_error')}</div>
            : data?.items.length
              ? data.items.map((d) => (
                <SelectItem key={d.id} value={String(d.draftNo)}>#{d.draftNo} · {d.party?.name ?? d.customerName}{d.mobile ? ` · ${d.mobile}` : ''} · {inr(d.estTotal)}</SelectItem>
              ))
              : <div className="px-3 py-2 text-sm text-muted-foreground">{t('bill98.no_drafts')}</div>}
        </SelectContent>
      </Select>
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
