import { describe, expect, it } from 'vitest'

import { toCsv, toXlsxRows } from '@/lib/csv'

describe('toCsv', () => {
  it('quotes every field', () => expect(toCsv([['a', 'b']])).toBe('"a","b"'))
  it('handles commas and embedded quotes', () => expect(toCsv([['x,y', 'say "hi"']])).toBe('"x,y","say ""hi"""'))
  it('keeps newlines inside the quoted field', () => expect(toCsv([['l1\nl2']])).toBe('"l1\nl2"'))
  it('separates rows with CRLF', () => expect(toCsv([['a'], ['b']])).toBe('"a"\r\n"b"'))
  it('null/undefined → empty, 0 kept', () => expect(toCsv([[null, undefined, 0]])).toBe('"","","0"'))

  // formula-injection guard: leading = + - @ tab CR get a leading apostrophe
  it('guards =formula', () => expect(toCsv([['=SUM(A1)']])).toBe(`"'=SUM(A1)"`))
  it('guards + - @', () => expect(toCsv([['+1'], ['-2'], ['@x']])).toBe(`"'+1"\r\n"'-2"\r\n"'@x"`))
  it('leaves safe text unguarded', () => expect(toCsv([['Ring 22K']])).toBe('"Ring 22K"'))
})

describe('toXlsxRows', () => {
  const one = (v: string | number | null) => toXlsxRows([[v]])[0][0]
  it('numeric strings become numbers', () => expect([one('1234.50'), one('-12'), one('0.5')]).toEqual([1234.5, -12, 0.5]))
  it('leading-zero codes stay text', () => expect(one('007')).toBe('007'))
  it('10-digit mobiles stay text', () => expect(one('9876543210')).toBe('9876543210'))
  it('empty and null become blank', () => expect([one(''), one(null)]).toEqual([null, null]))
  it('non-finite numbers become text', () => expect(one(Number.NaN)).toBe('NaN'))
  it('words stay text', () => expect(one('Ring 22K')).toBe('Ring 22K'))
})
