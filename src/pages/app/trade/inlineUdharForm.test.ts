import { describe, expect, it } from 'vitest'

import { inlineUdharInput } from '@/shared'

import { blankInlineUdhar, fromInlineUdhar, toInlineUdhar } from './inlineUdharForm'

describe('inline udhar form ⇄ API (TRD-02)', () => {
  it('nothing entered → undefined; jama cash + silver udhar map to the New Udhar fields and pass the API contract', () => {
    expect(toInlineUdhar(blankInlineUdhar('GOLD'), 10)).toBeUndefined()
    const body = toInlineUdhar({ ...blankInlineUdhar('SILVER'), cashIn: '4000', metalOut: '250' }, 1000)!
    expect(body).toEqual({ cashIn: 4000, cashOut: 0, goldIn: 0, goldOut: 0, silverIn: 0, silverOut: 250 })
    expect(inlineUdharInput.safeParse(body).success).toBe(true)
  })

  it('bhav cut only when direction, amount and rate are all set; unit grams from the rate unit', () => {
    const f = { ...blankInlineUdhar('GOLD'), bhavDir: 'METAL_TO_MONEY' as const, bhavAmount: '6001', bhavRate: '60000' }
    expect(toInlineUdhar(f, 10)).toMatchObject({ bhav: { direction: 'METAL_TO_MONEY', metal: 'GOLD', amount: 6001, rate: 60000, unitGrams: 10 } })
    expect(toInlineUdhar({ ...f, bhavRate: '' }, 10)).toBeUndefined()
  })

  it('round-trips a saved entry for edit', () => {
    const f = fromInlineUdhar({ txnId: 1, txnNo: 3, cashOut: '0.00', onlineOut: '0.00', cashIn: '500.00', onlineIn: '0.00', goldOut: '0.000', goldIn: '1.250', silverOut: '0.000', silverIn: '0.000', bhav: null, remark: null }, 'SILVER')
    expect(f).toMatchObject({ cashIn: '500.00', cashOut: '', metal: 'GOLD', metalIn: '1.250', metalOut: '', bhavDir: '' })
    expect(fromInlineUdhar(null, 'SILVER')).toEqual(blankInlineUdhar('SILVER'))
  })
})
