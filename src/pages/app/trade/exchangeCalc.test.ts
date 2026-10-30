import { describe, expect, it } from 'vitest'

import { DEFAULT_EXCHANGE, previewExchange, type PreviewInput } from './exchangeCalc'

const base: PreviewInput = {
  side: 'BUY', lines: [{ weight: '10', touch: '91.6' }], diff: { pctPlus: '', gmPlus: '', pctMinus: '', gmMinus: '' },
  given: { gross: '', less: '', touch: '' }, rate: '0', charges: '0', discount: '0', unitGrams: 10, defaults: DEFAULT_EXCHANGE,
}

describe('previewExchange (mirrors the server, see backend exchange-g5.test.ts)', () => {
  it('exact fine, no rounding of fine; money rounded per the defaults, round-off its own figure', () => {
    const p = previewExchange({ ...base, rate: '61234' })
    expect([p.totalFine, p.afterFine, p.exact, p.finalAmount, p.roundOff]).toEqual([9.16, 9.16, 56090.34, 56090.34, 0])
    const near = previewExchange({ ...base, rate: '61234', defaults: { ...DEFAULT_EXCHANGE, roundOff: 'NEAREST', roundStep: 10 } })
    expect([near.finalAmount, near.roundOff]).toEqual([56090, -0.34])
    expect(previewExchange({ ...base, rate: '61234', defaults: { ...DEFAULT_EXCHANGE, roundOff: 'UP' } }).finalAmount).toBe(56091)
  })

  it('difference: % of the fine or weight base plus grams, each side', () => {
    expect(previewExchange({ ...base, diff: { pctPlus: '1', gmPlus: '0.1', pctMinus: '0.5', gmMinus: '' } }).diffFine).toBe(0.146)
    expect(previewExchange({ ...base, diff: { pctPlus: '', gmPlus: '', pctMinus: '2', gmMinus: '0.05' }, defaults: { ...DEFAULT_EXCHANGE, diffBy: 'WEIGHT' } }).afterFine).toBeCloseTo(8.91, 9)
  })

  it('given metal: BUY owes it on top, SELL takes it off what the party pays', () => {
    const buy = previewExchange({ ...base, given: { gross: '2.5', less: '0.5', touch: '80' } })
    expect([buy.givenOn, buy.givenFine, buy.settleFine]).toEqual([true, 1.6, 10.76])
    const sell = previewExchange({ ...base, side: 'SELL', lines: [{ weight: '10', touch: '100' }], given: { gross: '4', less: '', touch: '100' }, rate: '60000' })
    expect([sell.settleFine, sell.finalAmount]).toEqual([6, 36000])
  })
})
