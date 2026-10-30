import { describe, expect, it } from 'vitest'

import { DAYBOOK_PAGE_SIZES, LEDGER_ASSETS, SETTING_SCHEMAS, type SettingsDto } from '@/shared'

import { dayBookPrefs, shownAssets } from './dayBookPrefs'

describe('SET-08 Day Book prefs', () => {
  it('no settings (loading / no permission) → contract defaults: every asset, all sources, 20 rows (the old All-in-One size), running balance on', () => {
    expect(dayBookPrefs(undefined)).toEqual({ assets: [...LEDGER_ASSETS], defaultSource: null, pageSize: 20, showRunningBalance: true })
  })

  it('saved prefs are used as saved', () => {
    const saved = { assets: ['GOLD', 'MONEY'], defaultSource: 'SELL_BILL', pageSize: 10, showRunningBalance: false } as SettingsDto['daybook.prefs']
    expect(dayBookPrefs({ 'daybook.prefs': saved })).toEqual(saved)
  })

  it('shown assets keep ledger order; an empty choice shows all', () => {
    const p = dayBookPrefs(undefined)
    expect(shownAssets({ ...p, assets: ['SILVER', 'MONEY'] })).toEqual(['MONEY', 'SILVER'])
    expect(shownAssets({ ...p, assets: [] })).toEqual([...LEDGER_ASSETS])
  })
})

describe('SET-08 page size', () => {
  it('a saved 50 (from before 20 existed) stays 50; 20 can be saved; other sizes are refused', () => {
    const base = dayBookPrefs(undefined)
    expect(DAYBOOK_PAGE_SIZES).toEqual([10, 20, 50, 100])
    expect(dayBookPrefs({ 'daybook.prefs': { ...base, pageSize: 50 } }).pageSize).toBe(50)
    expect(dayBookPrefs({ 'daybook.prefs': { ...base, pageSize: 20 } }).pageSize).toBe(20)
    expect(SETTING_SCHEMAS['daybook.prefs'].safeParse({ pageSize: 30 }).success).toBe(false)
  })
})
