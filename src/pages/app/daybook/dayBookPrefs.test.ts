import { describe, expect, it } from 'vitest'

import { LEDGER_ASSETS, type SettingsDto } from '@/shared'

import { dayBookPrefs, shownAssets } from './dayBookPrefs'

describe('SET-08 Day Book prefs', () => {
  it('no settings (loading / no permission) → contract defaults: every asset, all sources, 50 rows, running balance on', () => {
    expect(dayBookPrefs(undefined)).toEqual({ assets: [...LEDGER_ASSETS], defaultSource: null, pageSize: 50, showRunningBalance: true })
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
