import { describe, expect, it } from 'vitest'
import type { KaratDto } from '@/shared'
import { blankRate, withUnpricedKarats } from '@/lib/rateRows'

const k = (metal: 'GOLD' | 'SILVER', code: string, touch: string): KaratDto => ({ id: code.length, metal, code, title: code, touch, isSystem: false })
const karats = [k('GOLD', '24K', '100'), k('GOLD', '22K', '91.67'), k('GOLD', '14K', '58.5'), k('SILVER', '999', '100')]
const priced = [{ karatCode: '24K', title: '24K', touch: '100', sell: '165000', buy: '162000' }]

describe('G7 closure: rate rows for every karat of the metal', () => {
  it('keeps today’s rates first and adds a blank row for each unpriced karat of that metal only', () => {
    expect(withUnpricedKarats(priced, karats, 'GOLD')).toEqual([
      priced[0],
      { karatCode: '22K', title: '22K', touch: '91.67', sell: '', buy: '' },
      { karatCode: '14K', title: '14K', touch: '58.5', sell: '', buy: '' },
    ])
  })
  it('a shop that never saved a rate gets every karat to price; no karat list yet leaves the rows as they are', () => {
    expect(withUnpricedKarats([], karats, 'SILVER')).toEqual([{ karatCode: '999', title: '999', touch: '100', sell: '', buy: '' }])
    expect(withUnpricedKarats(priced, undefined, 'GOLD')).toEqual(priced)
  })
  it('finds a blank sell or buy rate (the shared schema would save it as 0); 0 typed on purpose is not blank', () => {
    expect(blankRate(withUnpricedKarats(priced, karats, 'GOLD'))?.karatCode).toBe('22K')
    expect(blankRate([{ ...priced[0]!, buy: ' ' }])?.karatCode).toBe('24K')
    expect(blankRate([{ ...priced[0]!, sell: '0', buy: '0' }])).toBeUndefined()
  })
})
