// TASK-97 GSTR-2B ↔ purchase-register reconciliation. Pure (no React, no fetch) so it is unit-testable.
import type { GstRegisterRowDto } from '@/shared'

export interface TwoBInvoice { gstin: string; inv: string; date: string; value: number; taxable: number; tax: number }
export interface BookRow { billId: number; billNo: string; billDate: string; party: string; gstin: string | null; taxable: number; tax: number; total: number }
export interface Pair { b2: TwoBInvoice; book: BookRow }
export interface Reconciliation {
  matched: Pair[]
  mismatch: Pair[]
  only2b: TwoBInvoice[]
  onlyBooks: BookRow[]
  /** every books row whose GSTIN + invoice no. appears more than once */
  duplicates: BookRow[]
  invalidGstin: BookRow[]
  /** books rows from unregistered suppliers (no GSTIN) — not reconcilable, no ITC */
  noGstin: number
}

type Obj = Record<string, unknown>
const obj = (v: unknown): Obj => (v && typeof v === 'object' ? (v as Obj) : {})
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0)
const r2 = (n: number) => Math.round(n * 100) / 100

/**
 * Lenient GSTR-2B parse: accepts the portal file ({data:{docdata:{b2b}}}), a bare {docdata:{b2b}} or {b2b}.
 * Line amounts come from items[] (2B: txval/igst/cgst/sgst) or itms[].itm_det (2A: txval/iamt/camt/samt),
 * falling back to invoice-level fields when an invoice has no lines.
 */
export function parse2b(json: unknown): TwoBInvoice[] {
  const root = obj(json)
  const data = obj(root.data ?? root)
  const doc = obj(data.docdata ?? data)
  return arr(doc.b2b).flatMap((s) => {
    const sup = obj(s)
    const gstin = String(sup.ctin ?? '').trim().toUpperCase()
    return arr(sup.inv).map((i) => {
      const inv = obj(i)
      const lines = arr(inv.items ?? inv.itms)
      let taxable = 0
      let tax = 0
      for (const l of lines.length ? lines : [inv]) {
        const x = obj(obj(l).itm_det ?? l)
        taxable += num(x.txval)
        tax += num(x.igst ?? x.iamt) + num(x.cgst ?? x.camt) + num(x.sgst ?? x.samt)
      }
      return { gstin, inv: String(inv.inum ?? ''), date: String(inv.dt ?? inv.idt ?? ''), value: r2(num(inv.val)), taxable: r2(taxable), tax: r2(tax) }
    })
  })
}

/** Invoice no. compare key: case-insensitive, separators and leading zeros ignored ('inv/007' ≡ 'INV-007', '0042' ≡ '42'). */
export const normInv = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^0+(?=.)/, '')
const keyOf = (gstin: string, inv: string) => `${gstin.trim().toUpperCase()}|${normInv(inv)}`

const GSTIN_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/ // same pattern as the shared `gstin` schema
const B36 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'
/** Format + mod-36 check digit (15th char). */
export function isValidGstin(g: string): boolean {
  if (!GSTIN_RE.test(g)) return false
  let sum = 0
  for (let i = 0; i < 14; i++) {
    const p = B36.indexOf(g[i]) * (i % 2 ? 2 : 1)
    sum += Math.floor(p / 36) + (p % 36)
  }
  return B36[(36 - (sum % 36)) % 36] === g[14]
}

export const fromRegister = (rows: GstRegisterRowDto[]): BookRow[] =>
  rows.map((x) => ({
    billId: x.billId, billNo: x.billNo, billDate: x.billDate, party: x.party.name, gstin: x.party.gstin,
    taxable: Number(x.taxable), tax: r2(Number(x.cgst) + Number(x.sgst) + Number(x.igst)), total: Number(x.total),
  }))

/** Match by supplier GSTIN + invoice no.; amounts agree when taxable and total tax are each within `tol` rupees. */
export function reconcile(twoB: TwoBInvoice[], books: BookRow[], tol = 1): Reconciliation {
  const registered = books.filter((b) => b.gstin)
  const byKey = new Map<string, BookRow[]>()
  for (const b of registered) {
    const k = keyOf(b.gstin!, b.billNo)
    byKey.set(k, [...(byKey.get(k) ?? []), b])
  }
  const out: Reconciliation = {
    matched: [], mismatch: [], only2b: [], onlyBooks: [],
    duplicates: [...byKey.values()].filter((g) => g.length > 1).flat(),
    invalidGstin: registered.filter((b) => !isValidGstin(b.gstin!)),
    noGstin: books.length - registered.length,
  }
  const seen = new Set<string>()
  for (const r of twoB) {
    const k = keyOf(r.gstin, r.inv)
    const book = byKey.get(k)?.[0]
    // a repeated 2B invoice can't match the same books row twice
    if (!book || seen.has(k)) { out.only2b.push(r); continue }
    seen.add(k)
    const same = Math.abs(book.taxable - r.taxable) <= tol && Math.abs(book.tax - r.tax) <= tol
    ;(same ? out.matched : out.mismatch).push({ b2: r, book })
  }
  out.onlyBooks = [...byKey.entries()].filter(([k]) => !seen.has(k)).map(([, g]) => g[0])
  return out
}
