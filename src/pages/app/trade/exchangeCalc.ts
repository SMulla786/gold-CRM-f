// G5 exchange preview: the same figures the server computes in trade/exchange.ts prepare(), so the form shows what will post.
import { fineWeight, metalToMoney, roundMoney, type RoundMode } from '@/shared'

const n = (s: unknown) => Number(s) || 0

export interface ExchangeDefaults { roundOff: RoundMode; roundStep: number; diffBy: 'WEIGHT' | 'FINE' }
export const DEFAULT_EXCHANGE: ExchangeDefaults = { roundOff: 'NONE', roundStep: 1, diffBy: 'FINE' }

export interface PreviewInput {
  side: string
  lines: { weight: string; touch: string }[]
  diff: { pctPlus: string; gmPlus: string; pctMinus: string; gmMinus: string }
  given: { gross: string; less: string; touch: string }
  rate: string; charges: string; discount: string
  unitGrams: number
  defaults: ExchangeDefaults
}

/** Fine is never rounded (3 dp is only display / storage); money is rounded once, at the end, per exchange.defaults. */
export function previewExchange(p: PreviewInput) {
  const totalFine = p.lines.reduce((a, l) => a + n(fineWeight(n(l.weight), n(l.touch))), 0)
  const totalWeight = p.lines.reduce((a, l) => a + n(l.weight), 0)
  const base = p.defaults.diffBy === 'WEIGHT' ? totalWeight : totalFine
  const diffFine = Number(((base * n(p.diff.pctPlus)) / 100 + n(p.diff.gmPlus) - (base * n(p.diff.pctMinus)) / 100 - n(p.diff.gmMinus)).toFixed(3))
  const afterFine = totalFine + diffFine
  const givenOn = n(p.given.gross) > 0
  const givenFine = givenOn ? n(fineWeight(Math.max(n(p.given.gross) - n(p.given.less), 0), n(p.given.touch))) : 0
  const settleFine = p.side === 'SELL' ? afterFine - givenFine : afterFine + givenFine
  const moneyMode = n(p.rate) > 0
  const exact = moneyMode ? n(metalToMoney(settleFine, n(p.rate), p.unitGrams)) + n(p.charges) - n(p.discount) : 0
  const r = moneyMode ? roundMoney(exact, p.defaults.roundOff, p.defaults.roundStep) : { final: '0', round: '0' }
  return { totalFine, totalWeight, diffFine, afterFine, givenOn, givenFine, settleFine, moneyMode, exact, finalAmount: n(r.final), roundOff: n(r.round) }
}
