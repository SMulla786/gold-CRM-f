import { describe, expect, it } from 'vitest'

import { fyLabel, previewNo, type Numbering } from '@/lib/invoiceNumber'

const base: Numbering = { format: 'NUMERIC', delimiter: '-', padding: 5, fyFormat: 'FULL', gstPrefix: 'INV', gstStart: 1, roughPrefix: 'RGH', roughStart: 1, gstOnRemainingMetal: false }
const mar31 = new Date(2027, 2, 31) // 31 Mar 2027 → FY 2026-27
const apr1 = new Date(2027, 3, 1) //  1 Apr 2027 → FY 2027-28

describe('previewNo', () => {
  it('NUMERIC is just the padded counter', () => expect(previewNo(base, 'gst', mar31)).toBe('00001'))
  it('PREFIX adds prefix + delimiter', () => expect(previewNo({ ...base, format: 'PREFIX' }, 'gst', mar31)).toBe('INV-00001'))
  it('uses the rough series for rough', () => expect(previewNo({ ...base, format: 'PREFIX' }, 'rough', mar31)).toBe('RGH-00001'))
  it('FY_PREFIX before 1 Apr → previous FY', () => expect(previewNo({ ...base, format: 'FY_PREFIX', delimiter: '/' }, 'gst', mar31)).toBe('INV/2026-27/00001'))
  it('FY_PREFIX on/after 1 Apr → new FY', () => expect(previewNo({ ...base, format: 'FY_PREFIX', delimiter: '/' }, 'gst', apr1)).toBe('INV/2027-28/00001'))
  it('SHORT fy format', () => expect(previewNo({ ...base, format: 'FY_PREFIX', delimiter: '/', fyFormat: 'SHORT' }, 'gst', apr1)).toBe('INV/27-28/00001'))
  it('YEAR fy format', () => expect(previewNo({ ...base, format: 'FY_PREFIX', delimiter: '/', fyFormat: 'YEAR' }, 'gst', apr1)).toBe('INV/2027/00001'))
  it('respects padding and start number', () => expect(previewNo({ ...base, padding: 3, gstStart: 42 }, 'gst', mar31)).toBe('042'))
})

describe('fyLabel', () => {
  it('FULL', () => expect(fyLabel('FULL', mar31)).toBe('2026-27'))
  it('SHORT', () => expect(fyLabel('SHORT', apr1)).toBe('27-28'))
  it('YEAR', () => expect(fyLabel('YEAR', apr1)).toBe('2027'))
})
