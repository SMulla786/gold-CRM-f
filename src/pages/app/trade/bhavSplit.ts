import type { BhavBookingDto } from '@/shared'

type Bk = Pick<BhavBookingDto, 'side' | 'weight' | 'rate' | 'amount' | 'advance' | 'entryType' | 'settlement'>

/** BUY / SELL column groups (parity list): a booking fills only its own side's weight / rate / amount. */
export const sideFigures = (b: Bk, side: 'BUY' | 'SELL') => (b.side === side ? { weight: b.weight, rate: b.rate, amount: b.amount } : null)

/**
 * GIVEN / RECEIVED (TRD-04): a BUY booking's money is GIVEN (the shop pays the party), a SELL booking's RECEIVED — the
 * direction bhav.ts postAdvance posts it. The advance and the payments made on delivery (settlement) are separate figures;
 * the bill total is never added to them. An ONLY_ENTRY advance posted nothing (record only). null = nothing to show.
 */
export function moneyFlow(b: Bk) {
  const advance = Number(b.advance) > 0 ? b.advance : null
  const settlement = Number(b.settlement) > 0 ? b.settlement : null
  return { kind: b.side === 'BUY' ? ('GIVEN' as const) : ('RECEIVED' as const), advance, recordOnly: advance != null && b.entryType === 'ONLY_ENTRY', settlement }
}
