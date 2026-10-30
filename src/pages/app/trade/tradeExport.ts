import { fetchAllPaged } from '@/lib/queries'
import type { BhavBookingDto } from '@/shared'

import { advanceFlow, sideFigures } from './bhavSplit'

const date = (s: string) => new Date(s).toLocaleDateString('en-IN')

/** Header + body for the bhav CSV / Excel export (open and old bookings share it). */
export async function bhavExportRows(filters: Record<string, string | number | undefined>) {
  const all = await fetchAllPaged<BhavBookingDto>('/app/bhav-booking', filters)
  // same BUY / SELL + Given / Received split as the list (bhavSplit.ts)
  const header = ['No', 'Date', 'Party', 'Mobile', 'Metal', 'Buy wt (g)', 'Buy rate', 'Buy amount', 'Sell wt (g)', 'Sell rate', 'Sell amount', 'Pending (g)', 'Given / Received', 'Advance', 'Entry type', 'Status', 'Verified', 'Narration']
  const flowLabel = { RECEIVED: 'Received', RECORD_ONLY: 'Record only', NONE: '' } as const
  const body = all.map((b) => {
    const [buy, sell] = [sideFigures(b, 'BUY'), sideFigures(b, 'SELL')]
    return [b.bookingNo, date(b.txnDate), b.party.name, b.party.mobile, b.metal, buy?.weight ?? '', buy?.rate ?? '', buy?.amount ?? '', sell?.weight ?? '', sell?.rate ?? '', sell?.amount ?? '', b.pendingWeight, flowLabel[advanceFlow(b).kind], b.advance, b.entryType ?? '', b.status, b.verifiedAt ? 'Yes' : 'No', b.narration]
  })
  return [header, ...body]
}
