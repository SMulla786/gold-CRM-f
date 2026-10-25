import { describe, expect, it } from 'vitest'

import { lineRateUnitGrams, metalRateUnitGrams } from '@/lib/billingQueries'
import type { SettingsDto } from '@/shared'

const units = (gold: string, silver: string) => ({ 'rates.units': { gold, silver } }) as unknown as SettingsDto

describe('lineRateUnitGrams', () => {
  it('SELL defaults: gold /10 g, silver /1 kg, non-metal /1', () => {
    expect(lineRateUnitGrams('SELL', 'GOLD')).toBe(10)
    expect(lineRateUnitGrams('SELL', 'SILVER')).toBe(1000)
    expect(lineRateUnitGrams('SELL', 'STONE')).toBe(1)
    expect(lineRateUnitGrams('SELL', undefined)).toBe(1)
  })
  it('PURCHASE is always per gram', () => {
    expect(lineRateUnitGrams('PURCHASE', 'GOLD')).toBe(1)
    expect(lineRateUnitGrams('PURCHASE', 'SILVER')).toBe(1)
  })
  it('honours the shop rate units', () => {
    expect(lineRateUnitGrams('SELL', 'GOLD', units('TOLA', 'GRAM_1'))).toBeCloseTo(11.6638)
    expect(lineRateUnitGrams('SELL', 'SILVER', units('TOLA', 'GRAM_1'))).toBe(1)
  })
})

describe('metalRateUnitGrams', () => {
  it('defaults and overrides', () => {
    expect(metalRateUnitGrams('GOLD')).toBe(10)
    expect(metalRateUnitGrams('SILVER')).toBe(1000)
    expect(metalRateUnitGrams('GOLD', units('GRAM_1', 'KG_1'))).toBe(1)
  })
})
