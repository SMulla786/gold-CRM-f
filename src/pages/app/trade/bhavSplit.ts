import type { BhavBookingDto } from '@/shared'

type Bk = Pick<BhavBookingDto, 'side' | 'weight' | 'rate' | 'amount' | 'advance' | 'entryType'>

/** BUY / SELL column groups (parity list): a booking fills only its own side's weight / rate / amount. */
export const sideFigures = (b: Bk, side: 'BUY' | 'SELL') => (b.side === side ? { weight: b.weight, rate: b.rate, amount: b.amount } : null)

/**
 * GIVEN / RECEIVED: the advance in the direction it was posted. The posting rule (docs/api-phase10.md, bhav.ts postAdvance)
 * is MONEY IN + party credit on BOTH sides, so a posted advance is always RECEIVED. ONLY_ENTRY posts nothing (record only).
 * There is no GIVEN advance until the owner decides how a BUY booking's advance should post.
 */
export function advanceFlow(b: Bk): { kind: 'RECEIVED' | 'RECORD_ONLY' | 'NONE'; amount: string } {
  if (!(Number(b.advance) > 0)) return { kind: 'NONE', amount: b.advance }
  return { kind: b.entryType === 'ONLY_ENTRY' ? 'RECORD_ONLY' : 'RECEIVED', amount: b.advance }
}
