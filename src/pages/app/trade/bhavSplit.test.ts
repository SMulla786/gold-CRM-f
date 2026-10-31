import { describe, expect, it } from 'vitest'

import { moneyFlow, sideFigures } from './bhavSplit'

const bk = (o: Partial<Parameters<typeof moneyFlow>[0]> = {}) => ({ side: 'BUY' as const, weight: '10.000', rate: '60000.00', amount: '60000.00', advance: '5000.00', entryType: 'LEDGER' as const, settlement: '0.00', ...o })

describe('bhav list BUY / SELL split', () => {
  it('fills only the booking\'s own side', () => {
    expect(sideFigures(bk(), 'BUY')).toEqual({ weight: '10.000', rate: '60000.00', amount: '60000.00' })
    expect(sideFigures(bk(), 'SELL')).toBeNull()
    expect(sideFigures(bk({ side: 'SELL' }), 'BUY')).toBeNull()
  })
})

describe('GIVEN / RECEIVED (TRD-04)', () => {
  it('BUY money is GIVEN, SELL money RECEIVED; advance and delivery settlement stay separate', () => {
    expect(moneyFlow(bk({ settlement: '55000.00' }))).toEqual({ kind: 'GIVEN', advance: '5000.00', recordOnly: false, settlement: '55000.00' })
    expect(moneyFlow(bk({ side: 'SELL' }))).toEqual({ kind: 'RECEIVED', advance: '5000.00', recordOnly: false, settlement: null })
  })

  it('ONLY_ENTRY advance is record-only; nothing paid → both null', () => {
    expect(moneyFlow(bk({ entryType: 'ONLY_ENTRY' })).recordOnly).toBe(true)
    expect(moneyFlow(bk({ advance: '0.00' }))).toMatchObject({ advance: null, recordOnly: false, settlement: null })
  })
})
