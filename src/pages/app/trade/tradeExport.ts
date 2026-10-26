import { fetchAllPaged } from '@/lib/queries'
import type { BhavBookingDto } from '@/shared'

const date = (s: string) => new Date(s).toLocaleDateString('en-IN')

/** Header + body for the bhav CSV / Excel export (open and old bookings share it). */
export async function bhavExportRows(filters: Record<string, string | number | undefined>) {
  const all = await fetchAllPaged<BhavBookingDto>('/app/bhav-booking', filters)
  const header = ['No', 'Date', 'Side', 'Party', 'Mobile', 'Metal', 'Weight (g)', 'Pending (g)', 'Rate', 'Amount', 'Advance', 'Entry type', 'Status', 'Verified', 'Narration']
  const body = all.map((b) => [b.bookingNo, date(b.txnDate), b.side, b.party.name, b.party.mobile, b.metal, b.weight, b.pendingWeight, b.rate, b.amount, b.advance, b.entryType ?? '', b.status, b.verifiedAt ? 'Yes' : 'No', b.narration])
  return [header, ...body]
}
