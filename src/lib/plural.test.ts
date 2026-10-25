import { describe, expect, it } from 'vitest'

import { plural } from '@/lib/plural'

describe('plural', () => {
  it('singular at exactly 1', () => expect(plural(1, 'bill')).toBe('1 bill'))
  it('plural at 0', () => expect(plural(0, 'item')).toBe('0 items'))
  it('plural at 2', () => expect(plural(2, 'pc')).toBe('2 pcs'))
  it('custom -es suffix, singular', () => expect(plural(1, 'match', 'es')).toBe('1 match'))
  it('custom -es suffix, plural', () => expect(plural(3, 'match', 'es')).toBe('3 matches'))
})
