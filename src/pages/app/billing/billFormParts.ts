// Pure pieces of BillForm (column presets, purchase-line extras, METAL pay) kept here so they can be unit-tested.
import { stoneTotal, type BillKind, type StockStoneDto } from '@/shared'

// TASK-86 bill-grid column customizer. Item/Gross/Total/actions stay fixed (needed for a valid bill);
// the rest are show/hide. Default all-on (purchase also shows the purchase-only columns, as the original does).
// `label` stays English (checkbox aria-label); `tk` is the i18n key for the visible text.
export const OPTIONAL_COLS = [
  { key: 'hsn', label: 'HSN', tk: 'bill98.col_hsn' },
  { key: 'karat', label: 'Karat', tk: 'stock.col_karat' }, { key: 'pcs', label: 'Pcs', tk: 'stock.col_pcs' }, { key: 'less', label: 'Less', tk: 'bill.col_less' },
  { key: 'tunch', label: 'Tunch', tk: 'bill.col_tunch' }, { key: 'wastage', label: 'Wst%', tk: 'bill.col_wastage' }, { key: 'net', label: 'Net', tk: 'stock.col_net' },
  { key: 'fine', label: 'Fine', tk: 'stock.col_fine' }, { key: 'stone', label: 'Stone', tk: 'class.STONE' }, { key: 'rate', label: 'Rate', tk: 'udhari.rate' },
  { key: 'labour', label: 'Labour', tk: 'bill.col_labour' }, { key: 'unit', label: 'Unit', tk: 'bill.col_unit' }, { key: 'other', label: 'Other', tk: 'bill.col_other' },
  { key: 'disc', label: 'Disc', tk: 'bill.col_disc' },
  { key: 'suppItem', label: 'Supp item', tk: 'bill.col_supp_item' }, { key: 'suppTag', label: 'Supp tag', tk: 'bill.col_supp_tag' },
  { key: 'remark', label: 'Remark', tk: 'bill.col_remark' }, { key: 'huid', label: 'HUID', tk: 'bill.col_huid' }, { key: 'rfid', label: 'RFID', tk: 'bill.col_rfid' },
] as const
// purchase lines only: they describe the stock item the purchase creates
export const PURCHASE_ONLY_COLS: ReadonlySet<string> = new Set(['suppItem', 'suppTag', 'remark', 'huid', 'rfid'])
// Columns-menu presets (original: All / Simple / Tunch); 'All' doubles as reset.
export const COL_PRESETS = {
  simple: ['karat', 'pcs', 'net', 'rate', 'labour', 'unit', 'disc'],
  tunch: ['karat', 'pcs', 'less', 'tunch', 'wastage', 'net', 'fine', 'rate', 'labour', 'unit'],
} as const

export const colsFromKeys = (keys: readonly string[]) => Object.fromEntries(OPTIONAL_COLS.map((c) => [c.key, keys.includes(c.key)]))
export const allCols = () => colsFromKeys(OPTIONAL_COLS.map((c) => c.key))
/** Columns the menu offers for this bill kind (sell bills never show the purchase-only ones). */
export const colsForKind = (kind: BillKind) => OPTIONAL_COLS.filter((c) => kind === 'PURCHASE' || !PURCHASE_ONLY_COLS.has(c.key))
/** Visible columns: personal selection (this browser) → shop default (setting billing.columns, per kind) → all. */
export const resolveCols = (personal: Record<string, boolean> | null, shop: readonly string[] | undefined) =>
  personal ?? (shop ? colsFromKeys(shop) : allCols())

// Personal selection, per kind in this browser; the old shared 'ju.billcols' is still read as a fallback.
// Storage is passed as a getter: touching localStorage itself can throw (blocked site data).
type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
const colsLs = (kind: BillKind) => `ju.billcols.${kind}`
/** null = no personal selection, so the shop default applies */
export const loadPersonalCols = (ls: () => Store, kind: BillKind): Record<string, boolean> | null => {
  try { const s = ls().getItem(colsLs(kind)) ?? ls().getItem('ju.billcols'); return s ? { ...allCols(), ...JSON.parse(s) } : null } catch { return null }
}
export const savePersonalCols = (ls: () => Store, kind: BillKind, cols: Record<string, boolean>) => {
  try { ls().setItem(colsLs(kind), JSON.stringify(cols)) } catch { /* ignore: the choice still applies for this session */ }
}
/** Reset: forget this kind's personal selection. The old shared copy goes too, or it would come back as the fallback. */
export const clearPersonalCols = (ls: () => Store, kind: BillKind) => {
  try { ls().removeItem(colsLs(kind)); ls().removeItem('ju.billcols') } catch { /* ignore */ }
}
/** New `billing.columns` setting value: this kind's visible columns replace its list; the other kind's list is kept. */
export const shopColsValue = (current: { sell?: string[]; purchase?: string[] } | undefined, kind: BillKind, cols: Record<string, boolean>) => ({
  ...current, [kind === 'SELL' ? 'sell' : 'purchase']: colsForKind(kind).filter((c) => cols[c.key]).map((c) => c.key),
})

/** INV-12 purchase stone element as typed in the Stones dialog. */
export interface StoneRow { name: string; pcs: string; weight: string; unit: 'CT' | 'GM'; rate: string; amount: string }
export const blankStone = (): StoneRow => ({ name: '', pcs: '0', weight: '0', unit: 'CT', rate: '0', amount: '0' })
export const stoneRowFromDto = (s: StockStoneDto): StoneRow => ({ name: s.name, pcs: String(s.pcs), weight: s.weight, unit: s.unit, rate: s.rate, amount: s.amount })
/** rows without a name are dropped; none left → omitted */
export const stonesBody = (stones: readonly StoneRow[]) => {
  const out = stones.filter((s) => s.name.trim()).map((s) => ({ name: s.name.trim(), pcs: Number(s.pcs) || 0, weight: Number(s.weight) || 0, unit: s.unit, rate: Number(s.rate) || 0, amount: Number(s.amount) || 0 }))
  return out.length ? out : undefined
}

/** INV-12: with stone rows the line's stone charge is their total (same rounding as the server); without rows the typed charge stays. */
export const syncStoneCharge = <R extends { stones: readonly StoneRow[]; stoneCharge: string }>(r: R): R =>
  r.stones.length ? { ...r, stoneCharge: stoneTotal(r.stones.map((s) => s.amount || 0)) } : r

/** BILL-08 / INV-12: purchase-line stock details (sent only on PURCHASE; trimmed, blank → omitted). */
export const purchaseLineExtras = (kind: BillKind, r: { supplierItem: string; supplierTag: string; remarks: string; huid: string; epcCode: string; stones: readonly StoneRow[] }) =>
  kind !== 'PURCHASE' ? {} : {
    supplierItem: r.supplierItem.trim() || undefined, supplierTag: r.supplierTag.trim() || undefined, remarks: r.remarks.trim() || undefined,
    huid: r.huid.trim() || undefined, epcCode: r.epcCode.trim() || undefined, stones: stonesBody(r.stones),
  }

// same rules as the stock contract (stockRowInput.huid / epcCode), so a bad value blocks Save instead of failing the whole bill
export const huidOk = (v: string) => !v.trim() || /^[A-Z0-9]{6}$/i.test(v.trim())
export const epcOk = (v: string) => !v.trim() || /^[0-9A-F]{8,64}$/i.test(v.trim())

/** BILL-07: jewellery types offered on a METAL pay row — class-less (global) types plus those of the received metal. */
export const jtypesForMetal = <T extends { stockClass?: string | null }>(list: readonly T[], metal: string) =>
  list.filter((jt) => jt.stockClass == null || jt.stockClass === metal)

/** METAL pay row → billPaymentInput (jewellery type optional). */
export const metalPayBody = (p: { metal: string; metalForm: string; gross: string; less: string; tunch: string; rate: string; remark: string; jewelleryTypeId: string }) => ({
  mode: 'METAL' as const, metal: p.metal, metalForm: p.metalForm, gross: Number(p.gross) || 0, less: Number(p.less) || 0, tunch: Number(p.tunch) || 0,
  rate: Number(p.rate) || 0, remark: p.remark || undefined, jewelleryTypeId: p.jewelleryTypeId ? Number(p.jewelleryTypeId) : undefined,
})

/** BILL-10 Jama/Pay: udhar receipt body (money IN from the party); null until amount > 0 and, for ONLINE, a bank is picked. */
export const jamaBody = (partyId: number, f: { mode: 'CASH' | 'ONLINE'; amount: string; bankId: string; txnDate: string; remark: string }) => {
  const amt = Number(f.amount) || 0
  if (!(amt > 0) || (f.mode === 'ONLINE' && !f.bankId)) return null
  return {
    partyId, txnDate: f.txnDate,
    ...(f.mode === 'CASH' ? { cashIn: amt } : { onlineIn: amt, inBankId: Number(f.bankId) }),
    remark: f.remark.trim() || undefined,
  }
}
