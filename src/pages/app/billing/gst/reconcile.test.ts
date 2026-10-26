import { describe, expect, it } from 'vitest'

import { isValidGstin, normInv, parse2b, reconcile, type BookRow } from './reconcile'

const A = '27AAPFU0939F1ZV' // valid check digit
const B = '29AAGCB7383J1Z4'
const book = (billNo: string, gstin: string | null, taxable: number, tax: number, billId = 1): BookRow =>
  ({ billId, billNo, billDate: '2026-10-01', party: 'P', gstin, taxable, tax, total: taxable + tax })

describe('isValidGstin', () => {
  it('checks format and check digit', () => {
    expect(isValidGstin(A)).toBe(true)
    expect(isValidGstin(B)).toBe(true)
    expect(isValidGstin('27AAPFU0939F1ZX')).toBe(false) // wrong check digit
    expect(isValidGstin('27AAPFU0939F1Z')).toBe(false)
  })
})

describe('normInv', () => {
  it('ignores case, separators and leading zeros', () => {
    expect(normInv('inv/007')).toBe(normInv('INV-007'))
    expect(normInv('0042')).toBe('42')
    expect(normInv('0')).toBe('0')
  })
})

describe('parse2b', () => {
  it('reads portal items and 2A-style itm_det', () => {
    const rows = parse2b({ data: { docdata: { b2b: [
      { ctin: A.toLowerCase(), inv: [{ inum: 'S/1', dt: '01-10-2026', val: 103, items: [{ txval: 100, cgst: 1.5, sgst: 1.5 }] }] },
      { ctin: B, inv: [{ inum: '9', val: 103, itms: [{ itm_det: { txval: 100, iamt: 3 } }] }] },
    ] } } })
    expect(rows).toEqual([
      { gstin: A, inv: 'S/1', date: '01-10-2026', value: 103, taxable: 100, tax: 3 },
      { gstin: B, inv: '9', date: '', value: 103, taxable: 100, tax: 3 },
    ])
    expect(parse2b(null)).toEqual([])
  })
})

describe('reconcile', () => {
  it('buckets matched / mismatch / 2B-only / books-only / duplicates / invalid', () => {
    const twoB = parse2b({ b2b: [{ ctin: A, inv: [
      { inum: 'S-1', items: [{ txval: 100, cgst: 1.5, sgst: 1.5 }] },
      { inum: 'S-2', items: [{ txval: 500, igst: 15 }] },
      { inum: 'S-3', items: [{ txval: 10 }] },
    ] }] })
    const r = reconcile(twoB, [
      book('s/1', A, 100.4, 3), // within ₹1
      book('S2', A, 200, 6, 2), // amount differs
      book('X-9', A, 50, 1.5, 3),
      book('X9', A, 50, 1.5, 4), // duplicate of X-9
      book('B1', '27AAPFU0939F1ZX', 1, 0, 5), // bad check digit
      book('C1', null, 1, 0, 6),
    ])
    expect(r.matched.map((p) => p.b2.inv)).toEqual(['S-1'])
    expect(r.mismatch.map((p) => p.b2.inv)).toEqual(['S-2'])
    expect(r.only2b.map((x) => x.inv)).toEqual(['S-3'])
    expect(r.onlyBooks.map((x) => x.billId)).toEqual([3, 5])
    expect(r.duplicates.map((x) => x.billId)).toEqual([3, 4])
    expect(r.invalidGstin.map((x) => x.billId)).toEqual([5])
    expect(r.noGstin).toBe(1)
  })

  it('matches on the supplier invoice no. when recorded, else our bill no.', () => {
    const twoB = parse2b({ b2b: [{ ctin: A, inv: [{ inum: 'SUP/77', items: [{ txval: 100, igst: 3 }] }, { inum: 'P-2', items: [{ txval: 50 }] }] }] })
    const r = reconcile(twoB, [
      { ...book('P-1', A, 100, 3), supplierInvoiceNo: 'sup-77' },
      book('P-2', A, 50, 0, 2), // no supplier inv no. → falls back to bill no.
      { ...book('SUP/77', A, 1, 0, 3), supplierInvoiceNo: 'OTHER' }, // our bill no. is ignored once a supplier inv no. exists
    ])
    expect(r.matched.map((p) => p.book.billId)).toEqual([1, 2])
    expect(r.onlyBooks.map((x) => x.billId)).toEqual([3])
  })
})
