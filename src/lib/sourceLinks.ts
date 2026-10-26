/** Screen that shows the document behind a ledger/udhar row (source + sourceId), or null when it has no page of its own.
 *  Bill sources carry the bill id; UDHAR carries the udhar txn id. */
export function sourceHref(source: string, sourceId: string): string | null {
  switch (source) {
    case 'SELL_BILL':
    case 'PURCHASE_BILL':
    case 'ORDER_SELL_BILL':
    case 'ORDER_PURCHASE_BILL':
      return `/app/billing/view/${sourceId}`
    case 'UDHAR':
      return `/app/udhari/txn/${sourceId}`
    default:
      return null
  }
}
