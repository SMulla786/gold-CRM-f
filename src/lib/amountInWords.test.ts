import { describe, expect, it } from 'vitest'

import { amountInWords } from '@/lib/amountInWords'

describe('amountInWords', () => {
  it('zero', () => expect(amountInWords(0)).toBe('Zero Rupees Only'))
  it('thousands', () => expect(amountInWords(4500)).toBe('Four Thousand Five Hundred Rupees Only'))
  it('with paise', () => expect(amountInWords(4500.5)).toBe('Four Thousand Five Hundred Rupees and Fifty Paise Only'))
  it('exact lakh', () => expect(amountInWords(100000)).toBe('One Lakh Rupees Only'))
  it('exact hundred', () => expect(amountInWords(100)).toBe('One Hundred Rupees Only'))
  it('crore (Indian grouping)', () =>
    expect(amountInWords(12345678)).toBe('One Crore Twenty Three Lakh Forty Five Thousand Six Hundred Seventy Eight Rupees Only'))
  it('teens and tens', () => {
    expect(amountInWords(19)).toBe('Nineteen Rupees Only')
    expect(amountInWords(70)).toBe('Seventy Rupees Only')
  })
  it('only paise', () => expect(amountInWords(0.05)).toBe('Zero Rupees and Five Paise Only'))
  it('rupees and paise', () => expect(amountInWords(1.25)).toBe('One Rupees and Twenty Five Paise Only'))
  it('negative treated as magnitude', () => expect(amountInWords(-500)).toBe('Five Hundred Rupees Only'))
})
