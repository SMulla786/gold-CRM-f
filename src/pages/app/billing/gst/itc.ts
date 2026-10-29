import type { GstRegisterRowDto } from '@/shared'

const r2 = (n: number) => Math.round(n * 100) / 100

export interface Bucket { key: string; label: string; gstin: string; bills: number; taxable: number; cgst: number; sgst: number; igst: number }

function group(rows: GstRegisterRowDto[], keyOf: (r: GstRegisterRowDto) => [string, string, string]): Bucket[] {
  const m = new Map<string, Bucket>()
  for (const r of rows) {
    const [key, label, gstin] = keyOf(r)
    const b = m.get(key) ?? { key, label, gstin, bills: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0 }
    b.bills++; b.taxable += Number(r.taxable); b.cgst += Number(r.cgst); b.sgst += Number(r.sgst); b.igst += Number(r.igst)
    m.set(key, b)
  }
  return [...m.values()]
}

/** [bills, taxable, cgst, sgst, igst, total ITC] rounded to paise — table cells and CSV/Excel rows. */
export const cells = (b: Bucket) => [b.bills, r2(b.taxable), r2(b.cgst), r2(b.sgst), r2(b.igst), r2(b.cgst + b.sgst + b.igst)]

/**
 * TASK-97 ITC summary: claimable = purchase bills from suppliers with a GSTIN (or reverse charge) — the GSTR-3B rule;
 * split by the bill's ITC eligibility into eligible (by month / supplier), blocked u/s 17(5) (by reason) and ineligible (by supplier).
 */
export function itcSplit(rows: GstRegisterRowDto[], noReason: string) {
  const claimable = rows.filter((r) => r.party.gstin || r.reverseCharge)
  const eligible = claimable.filter((r) => (r.itcEligibility ?? 'ELIGIBLE') === 'ELIGIBLE')
  const blocked = group(claimable.filter((r) => r.itcEligibility === 'BLOCKED_17_5'), (r) => [r.itcBlockReason || '', r.itcBlockReason || noReason, '']).sort((a, b) => a.label.localeCompare(b.label))
  const ineligible = group(claimable.filter((r) => r.itcEligibility === 'INELIGIBLE'), (r) => [String(r.party.id), r.party.name, r.party.gstin ?? '']).sort((a, b) => a.label.localeCompare(b.label))
  const byMonth = group(eligible, (r) => [r.billDate.slice(0, 7), r.billDate.slice(0, 7), '']).sort((a, b) => a.key.localeCompare(b.key))
  const bySupplier = group(eligible, (r) => [String(r.party.id), r.party.name, r.party.gstin ?? '']).sort((a, b) => b.cgst + b.sgst + b.igst - (a.cgst + a.sgst + a.igst))
  const taxable = eligible.reduce((a, r) => a + Number(r.taxable), 0)
  return { claimable, eligible, blocked, ineligible, byMonth, bySupplier, taxable }
}
