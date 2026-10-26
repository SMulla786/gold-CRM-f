import { metalRateUnitGrams } from '@/lib/billingQueries'
import { RATE_UNIT_GRAMS, type CurrentRatesDto, type SettingsDto } from '@/shared'

/**
 * Today's fine (highest-touch karat) rate for a metal, converted to the shop's metal rate unit
 * (the unit trade rates are entered in). BUY = the shop's buy rate, SELL = its sell rate.
 * Returns '' when no rate is set. Display / prefill only — never used for posting.
 */
export function fineRate(rates: CurrentRatesDto | undefined, metal: string, side: string, settings?: SettingsDto): string {
  const block = metal === 'GOLD' ? rates?.gold : rates?.silver
  if (!block?.rows.length) return ''
  const fine = block.rows.reduce((best, r) => (Number(r.touch) > Number(best.touch) ? r : best))
  const raw = Number(side === 'BUY' ? fine.buyRate : fine.sellRate)
  if (!(raw > 0)) return ''
  const converted = (raw / RATE_UNIT_GRAMS[block.rateUnit]) * metalRateUnitGrams(metal, settings)
  return String(Math.round(converted * 100) / 100)
}
