import { describe, expect, it } from 'vitest'

import { BILL_GRID_COLUMNS, billLineInput, billPaymentInput, SETTING_SCHEMAS, udharBody } from '@/shared'

import {
  allCols, COL_PRESETS, colsForKind, colsFromKeys, epcOk, huidOk, jamaBody, jtypesForMetal, metalPayBody, OPTIONAL_COLS, purchaseLineExtras, resolveCols, shopColsValue,
} from './billFormParts'

describe('BILL-09 bill-grid column presets', () => {
  it('every optional column and preset key is one the billing.columns setting accepts', () => {
    expect(OPTIONAL_COLS.map((c) => c.key)).toEqual([...BILL_GRID_COLUMNS])
    for (const k of [...COL_PRESETS.simple, ...COL_PRESETS.tunch]) expect(BILL_GRID_COLUMNS).toContain(k)
  })

  it('sell bills never offer the purchase-only columns', () => {
    expect(colsForKind('SELL').map((c) => c.key)).not.toEqual(expect.arrayContaining(['suppItem']))
    expect(colsForKind('SELL')).toHaveLength(14)
    expect(colsForKind('PURCHASE')).toHaveLength(19)
  })

  it('presets turn on exactly their columns; All turns on everything', () => {
    const simple = colsFromKeys(COL_PRESETS.simple)
    expect(Object.keys(simple).filter((k) => simple[k])).toEqual([...COL_PRESETS.simple])
    expect(Object.values(allCols()).every(Boolean)).toBe(true)
  })

  it('visible columns: session toggles → shop default → browser copy', () => {
    const browser = colsFromKeys(['hsn'])
    expect(resolveCols(null, undefined, browser)).toBe(browser)
    expect(resolveCols(null, ['karat'], browser)).toEqual(colsFromKeys(['karat']))
    const mine = colsFromKeys(['pcs'])
    expect(resolveCols(mine, ['karat'], browser)).toBe(mine)
  })

  it('shop default replaces only this kind, drops purchase-only columns on sell, and passes the setting schema', () => {
    const cols = colsFromKeys(['karat', 'rate', 'suppItem'])
    const v = shopColsValue({ purchase: ['huid'] }, 'SELL', cols)
    expect(v).toEqual({ purchase: ['huid'], sell: ['karat', 'rate'] })
    expect(shopColsValue(undefined, 'PURCHASE', cols)).toEqual({ purchase: ['karat', 'rate', 'suppItem'] })
    expect(SETTING_SCHEMAS['billing.columns'].parse(v)).toEqual(v)
  })
})

describe('BILL-08 purchase-line supplier item / tag', () => {
  const r = { supplierItem: '  Ring 22K ', supplierTag: 'S-12', remarks: ' ', huid: 'ab12cd', epcCode: '' }

  it('sent on purchase only, trimmed, blanks omitted', () => {
    expect(purchaseLineExtras('SELL', r)).toEqual({})
    expect(purchaseLineExtras('PURCHASE', r)).toEqual({ supplierItem: 'Ring 22K', supplierTag: 'S-12', remarks: undefined, huid: 'ab12cd', epcCode: undefined })
  })

  it('the bill line contract accepts them (HUID upper-cased)', () => {
    const line = billLineInput.pick({ supplierItem: true, supplierTag: true, remarks: true, huid: true, epcCode: true }).parse(purchaseLineExtras('PURCHASE', r))
    expect(line).toMatchObject({ supplierItem: 'Ring 22K', supplierTag: 'S-12', huid: 'AB12CD' })
  })

  it('HUID / EPC checks match the contract, so a bad value blocks Save instead of a 400 on the whole bill', () => {
    const pick = billLineInput.pick({ huid: true, epcCode: true })
    for (const huid of ['', 'ab12cd', 'AB12C', 'AB12CD7', 'AB-12C']) expect(huidOk(huid)).toBe(pick.safeParse({ huid: huid || undefined }).success)
    for (const epc of ['', 'e2801160', 'E28011', 'E2801G60', 'A'.repeat(65)]) expect(epcOk(epc)).toBe(pick.safeParse({ epcCode: epc || undefined }).success)
  })
})

describe('BILL-07 METAL payment jewellery type', () => {
  it('offers global (class-less) types and those of the received metal only', () => {
    const list = [{ id: 1, stockClass: null }, { id: 2, stockClass: 'GOLD' }, { id: 3, stockClass: 'SILVER' }, { id: 4 }]
    expect(jtypesForMetal(list, 'GOLD').map((j) => j.id)).toEqual([1, 2, 4])
    expect(jtypesForMetal(list, 'SILVER').map((j) => j.id)).toEqual([1, 3, 4])
  })

  const pay = { metal: 'GOLD', metalForm: 'BULLION', gross: '10', less: '0.5', tunch: '91.6', rate: '6500', remark: '', jewelleryTypeId: '7' }

  it('METAL pay body carries the jewellery type id; none picked → omitted', () => {
    expect(billPaymentInput.parse(metalPayBody(pay))).toMatchObject({ mode: 'METAL', gross: 10, less: 0.5, tunch: 91.6, jewelleryTypeId: 7 })
    const none = metalPayBody({ ...pay, jewelleryTypeId: '' })
    expect(none.jewelleryTypeId).toBeUndefined()
    expect(billPaymentInput.parse(none)).toMatchObject({ mode: 'METAL', gross: 10 })
  })
})

describe('BILL-10 Jama / Pay (udhar receipt from billing)', () => {
  const f = { mode: 'CASH' as const, amount: '500', bankId: '', txnDate: '2026-10-29', remark: '  old due ' }

  it('cash → cashIn; online → onlineIn + bank; both accepted by the udhar contract', () => {
    const cash = jamaBody(9, f)
    expect(cash).toEqual({ partyId: 9, txnDate: '2026-10-29', cashIn: 500, remark: 'old due' })
    expect(udharBody.parse(cash)).toMatchObject({ partyId: 9, cashIn: 500, onlineIn: 0, cashOut: 0 })
    const online = jamaBody(9, { ...f, mode: 'ONLINE', bankId: '3', remark: '' })
    expect(online).toEqual({ partyId: 9, txnDate: '2026-10-29', onlineIn: 500, inBankId: 3, remark: undefined })
    expect(udharBody.parse(online)).toMatchObject({ onlineIn: 500, inBankId: 3, cashIn: 0 })
  })

  it('nothing to save without a positive amount, or online without a bank', () => {
    expect(jamaBody(9, { ...f, amount: '' })).toBeNull()
    expect(jamaBody(9, { ...f, amount: '-5' })).toBeNull()
    expect(jamaBody(9, { ...f, mode: 'ONLINE' })).toBeNull()
  })
})
