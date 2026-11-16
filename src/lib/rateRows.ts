import type { KaratDto, Metal } from '@/shared'

export interface RateEditRow { karatCode: string; title: string; touch: string; sell: string; buy: string }

/** Today's rate rows plus a blank row for each karat of the metal with no rate yet (a new shop, a karat added later):
 *  GET /rates/current returns priced karats only, so without these rows such a karat could never be priced. */
export const withUnpricedKarats = (rows: RateEditRow[], karats: KaratDto[] | undefined, metal: Metal): RateEditRow[] => [
  ...rows,
  ...(karats ?? [])
    .filter((k) => k.metal === metal && !rows.some((r) => r.karatCode === k.code))
    .map((k) => ({ karatCode: k.code, title: k.title, touch: k.touch, sell: '', buy: '' })),
]

/** First row with a blank sell or buy rate: the shared schema coerces '' to 0, so a blank would save as ₹0. */
export const blankRate = (rows: RateEditRow[]): RateEditRow | undefined => rows.find((r) => r.sell.trim() === '' || r.buy.trim() === '')
