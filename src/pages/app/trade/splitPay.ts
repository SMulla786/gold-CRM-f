import type { TradePaymentDto } from '@/shared'

/** One editable split-payment row (strings while typing). */
export interface PayRow { key: string; mode: 'CASH' | 'ONLINE'; bankAccountId: string; amount: string; reference: string }

let uid = 0
const n = (s: string) => Number(s) || 0

export const blankPay = (mode: PayRow['mode'] = 'CASH'): PayRow => ({ key: `p${uid++}`, mode, bankAccountId: '', amount: '', reference: '' })
export const payTotal = (rows: PayRow[]) => rows.reduce((a, r) => a + n(r.amount), 0)
/** Rows with an amount; every ONLINE one needs a bank. */
export const payValid = (rows: PayRow[]) => rows.some((r) => n(r.amount) > 0) && rows.every((r) => !(n(r.amount) > 0) || r.mode === 'CASH' || !!r.bankAccountId)
/** Body fields for the split path: payments[] replaces cash / online (sent as 0). */
export const payBody = (rows: PayRow[]) => ({
  cash: 0, online: 0, bankAccountId: undefined,
  payments: rows.filter((r) => n(r.amount) > 0).map((r) => ({ mode: r.mode, amount: n(r.amount), bankAccountId: r.mode === 'ONLINE' ? Number(r.bankAccountId) : undefined, reference: r.reference || undefined })),
})
/** Prefill rows from a saved document (edit). */
export const payRowsFrom = (ps: TradePaymentDto[] | undefined): PayRow[] =>
  (ps ?? []).filter((p) => p.mode !== 'METAL').map((p) => ({ ...blankPay(p.mode === 'ONLINE' ? 'ONLINE' : 'CASH'), amount: p.amount, bankAccountId: p.bankAccount ? String(p.bankAccount.id) : '', reference: p.reference ?? '' }))
