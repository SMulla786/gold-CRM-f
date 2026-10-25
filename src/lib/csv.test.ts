import { describe, expect, it } from 'vitest'

import { toCsv } from '@/lib/csv'

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
