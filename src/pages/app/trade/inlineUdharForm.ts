// TRD-02 inline udhar on a buy-sell / exchange: form state ⇄ the API's InlineUdharInput (same fields as New Udhar).
// shortcut: cash only (no online jama / udhar with a bank account here); add the bank fields if shops ask for them.
import type { TradeUdharDto } from '@/shared'

export interface InlineUdharForm {
  cashIn: string
  cashOut: string
  metal: 'GOLD' | 'SILVER'
  metalIn: string
  metalOut: string
  bhavDir: '' | 'MONEY_TO_METAL' | 'METAL_TO_MONEY'
  bhavAmount: string
  bhavRate: string
}

const n = (s: string) => Number(s) || 0
export const blankInlineUdhar = (metal: 'GOLD' | 'SILVER'): InlineUdharForm => ({ cashIn: '', cashOut: '', metal, metalIn: '', metalOut: '', bhavDir: '', bhavAmount: '', bhavRate: '' })

/** undefined = nothing entered (no udhar entry is posted / an existing one is removed on save). */
export function toInlineUdhar(f: InlineUdharForm, unitGrams: number) {
  const gold = f.metal === 'GOLD'
  const bhav = f.bhavDir && n(f.bhavAmount) > 0 && n(f.bhavRate) > 0
    ? { direction: f.bhavDir, metal: f.metal, amount: n(f.bhavAmount), rate: n(f.bhavRate), unitGrams: unitGrams as 1 | 10 | 1000 }
    : undefined
  const body = {
    cashIn: n(f.cashIn), cashOut: n(f.cashOut),
    goldIn: gold ? n(f.metalIn) : 0, goldOut: gold ? n(f.metalOut) : 0,
    silverIn: gold ? 0 : n(f.metalIn), silverOut: gold ? 0 : n(f.metalOut),
    ...(bhav ? { bhav } : {}),
  }
  const any = body.cashIn + body.cashOut + body.goldIn + body.goldOut + body.silverIn + body.silverOut > 0 || !!bhav
  return any ? body : undefined
}

/** Prefill from a saved trade (one metal movement: the one that is non-zero, else the trade metal). */
export function fromInlineUdhar(u: TradeUdharDto | null | undefined, tradeMetal: 'GOLD' | 'SILVER'): InlineUdharForm {
  if (!u) return blankInlineUdhar(tradeMetal)
  const silver = n(u.silverIn) + n(u.silverOut) > 0
  const metal = silver ? 'SILVER' : n(u.goldIn) + n(u.goldOut) > 0 ? 'GOLD' : (u.bhav?.metal ?? tradeMetal)
  const z = (s: string) => (n(s) ? s : '')
  return {
    cashIn: z(u.cashIn), cashOut: z(u.cashOut), metal,
    metalIn: z(silver ? u.silverIn : u.goldIn), metalOut: z(silver ? u.silverOut : u.goldOut),
    bhavDir: u.bhav?.direction ?? '', bhavAmount: u.bhav?.amount ?? '', bhavRate: u.bhav?.rate ?? '',
  }
}
