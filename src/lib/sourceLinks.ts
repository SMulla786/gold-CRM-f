/** Readable (translated) name for a ledger source code, e.g. SELL_BILL → "Sale bill"; unknown codes show as-is. */
export function sourceLabel(t: (key: string) => string, source: string): string {
  const key = `src.${source}`
  const s = t(key)
  return s === key ? source : s
}

/** Screen that shows the document behind a ledger/udhar row (source + sourceId), or null when it has no page of its own.
 *  Bill sources carry the bill id; UDHAR carries the udhar txn id. */
export function sourceHref(source: string, sourceId: string): string | null {
  switch (source) {
    case 'SELL_BILL':
    case 'PURCHASE_BILL':
    case 'ORDER_SELL_BILL':
    case 'ORDER_PURCHASE_BILL':
      return `/app/billing/view/${parseInt(sourceId, 10)}` // payment/advance rows carry '<billId>-P<n>' / '<billId>-A'
    case 'UDHAR':
      return `/app/udhari/txn/${sourceId}`
    default:
      return null
  }
}
