import { describe, expect, it } from 'vitest'

import { advanceFlow, sideFigures } from './bhavSplit'

const bk = (o: Partial<Parameters<typeof advanceFlow>[0]> = {}) => ({ side: 'BUY' as const, weight: '10.000', rate: '60000.00', amount: '60000.00', advance: '5000.00', entryType: 'LEDGER' as const, ...o })

describe('bhav list BUY / SELL split', () => {
  it('fills only the booking\'s own side', () => {
    expect(sideFigures(bk(), 'BUY')).toEqual({ weight: '10.000', rate: '60000.00', amount: '60000.00' })
    expect(sideFigures(bk(), 'SELL')).toBeNull()
    expect(sideFigures(bk({ side: 'SELL' }), 'BUY')).toBeNull()
  })
})

describe('GIVEN / RECEIVED', () => {
  it('a posted advance is RECEIVED on both sides; ONLY_ENTRY is record-only; no advance → NONE', () => {
    expect(advanceFlow(bk())).toEqual({ kind: 'RECEIVED', amount: '5000.00' })
    expect(advanceFlow(bk({ side: 'SELL' })).kind).toBe('RECEIVED')
    expect(advanceFlow(bk({ entryType: 'ONLY_ENTRY' })).kind).toBe('RECORD_ONLY')
    expect(advanceFlow(bk({ advance: '0.00' })).kind).toBe('NONE')
  })
})
