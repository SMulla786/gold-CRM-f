import { describe, expect, it } from 'vitest'

import { whatsAppUrl } from '@/lib/share'

describe('whatsAppUrl', () => {
  it('prefixes 91 on a 10-digit number', () => expect(whatsAppUrl('9000000001', 'hi')).toBe('https://wa.me/919000000001?text=hi'))
  it('leaves an already 91-prefixed number as is', () => expect(whatsAppUrl('919000000001', 'hi')).toBe('https://wa.me/919000000001?text=hi'))
  it('strips spaces/dashes before counting digits', () => expect(whatsAppUrl('90000-00001', 'hi')).toBe('https://wa.me/919000000001?text=hi'))
  it('url-encodes ₹ and newlines in the summary', () => {
    const url = whatsAppUrl('9000000001', 'Total ₹1,000\nBal ₹0')
    expect(url).toContain('%E2%82%B9') // ₹
    expect(url).toContain('%0A') // newline
    expect(url).not.toContain('₹')
    expect(url).not.toContain('\n')
  })
})
