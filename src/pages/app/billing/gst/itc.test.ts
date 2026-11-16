import { describe, expect, it } from 'vitest'

import type { GstRegisterRowDto } from '@/shared'

import { cells, itcSplit } from './itc'

const S1 = { id: 1, name: 'Supp A', gstin: '27AAPFU0939F1ZV' }
const S2 = { id: 2, name: 'Supp B', gstin: '29AAGCB7383J1Z4' }
const UNREG = { id: 3, name: 'Walk-in seller', gstin: null }
const row = (billId: number, party: GstRegisterRowDto['party'], billDate: string, taxable: number, o: Partial<GstRegisterRowDto> = {}): GstRegisterRowDto => ({
  billId, billNo: `P-${billId}`, billDate, party, hsnCodes: ['7113'], taxable: String(taxable), cgst: String(taxable * 0.015), sgst: String(taxable * 0.015), igst: '0',
  total: String(taxable * 1.03), ...o,
})

describe('itcSplit (GST-02 ITC summary)', () => {
  const rows = [
    row(1, S1, '2026-09-10', 1000),
    row(2, S1, '2026-10-05', 2000, { itcEligibility: 'ELIGIBLE' }),
    row(3, S2, '2026-10-20', 10000),
    row(4, S2, '2026-10-21', 500, { itcEligibility: 'BLOCKED_17_5', itcBlockReason: 'Motor vehicle' }),
    row(5, S1, '2026-10-22', 300, { itcEligibility: 'BLOCKED_17_5', itcBlockReason: null }),
    row(6, S2, '2026-10-23', 700, { itcEligibility: 'INELIGIBLE' }),
    row(7, UNREG, '2026-10-24', 9999), // no GSTIN, no RCM → never claimable
    row(8, UNREG, '2026-10-25', 400, { reverseCharge: true, igst: '12', cgst: '0', sgst: '0' }), // RCM → claimable
  ]
  const s = itcSplit(rows, '(no reason)')

  it('claimable = GSTIN or reverse charge; a missing eligibility counts as ELIGIBLE', () => {
    expect(s.claimable.map((r) => r.billId)).toEqual([1, 2, 3, 4, 5, 6, 8])
    expect(s.eligible.map((r) => r.billId)).toEqual([1, 2, 3, 8])
    expect(s.taxable).toBe(13400)
  })

  it('eligible by month (ascending) and by supplier (largest ITC first)', () => {
    expect(s.byMonth.map((b) => [b.key, b.bills, b.taxable])).toEqual([['2026-09', 1, 1000], ['2026-10', 3, 12400]])
    expect(s.bySupplier.map((b) => b.label)).toEqual(['Supp B', 'Supp A', 'Walk-in seller'])
    expect(cells(s.bySupplier[0]!)).toEqual([1, 10000, 150, 150, 0, 300])
  })

  it('blocked u/s 17(5) grouped by reason (blank → placeholder); ineligible by supplier; neither counts as eligible', () => {
    expect(s.blocked.map((b) => [b.label, b.bills, b.taxable])).toEqual([['(no reason)', 1, 300], ['Motor vehicle', 1, 500]])
    expect(s.ineligible.map((b) => [b.label, b.gstin, b.taxable])).toEqual([['Supp B', S2.gstin, 700]])
  })

  it('cells round each figure to paise and total = cgst + sgst + igst', () => {
    const [b] = itcSplit([row(9, S1, '2026-10-01', 333.333)], '').byMonth
    expect(cells(b!)).toEqual([1, 333.33, 5, 5, 0, 10])
  })
})
