import { LEDGER_ASSETS, SETTING_SCHEMAS, type LedgerAsset, type SettingsDto } from '@/shared'

export type DayBookPrefs = SettingsDto['daybook.prefs']

/** SET-08: saved Day Book prefs, or the contract defaults while settings load / when the user cannot read settings. */
export const dayBookPrefs = (settings: Partial<SettingsDto> | undefined): DayBookPrefs =>
  SETTING_SCHEMAS['daybook.prefs'].parse(settings?.['daybook.prefs'] ?? {})

/** Asset column groups to show, in ledger order; an empty choice shows all (never a blank day book). */
export const shownAssets = (p: DayBookPrefs): LedgerAsset[] => {
  const shown = LEDGER_ASSETS.filter((a) => p.assets.includes(a))
  return shown.length ? shown : [...LEDGER_ASSETS]
}
