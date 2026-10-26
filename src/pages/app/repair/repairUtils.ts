// Shared formatting + labels for the repair board, ledger, dialogs and slip.
import type { RepairTicketDto } from '@/shared'

export const inr = (s: string) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(s))
export const date = (s: string) => new Date(s).toLocaleDateString('en-IN')
export const n = (s: string) => Number(s) || 0

export const STATUS_LABEL: Record<RepairTicketDto['status'], string> = {
  RECEIVED: 'Received',
  IN_PROGRESS: 'In progress',
  IN_REVIEW: 'In review (QA)',
  READY: 'Ready',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
}

/** Statuses where a karigar can still be assigned (RECEIVED assigns + starts work). */
export const ASSIGNABLE: ReadonlyArray<RepairTicketDto['status']> = ['RECEIVED', 'IN_PROGRESS', 'IN_REVIEW']

/** Suggested categories; the field stays free text (repairBody.category). */
export const REPAIR_CATEGORIES = ['Ring', 'Necklace', 'Bangle', 'Earrings', 'Chain', 'Bracelet', 'Pendant', 'Other'] as const

/** Suggested sub-categories (free text, repairBody.subCategory). */
export const REPAIR_SUB_CATEGORIES = ['Ladies', 'Gents', 'Kids', 'Clasp / hook', 'Stone setting', 'Resizing', 'Soldering', 'Polish'] as const

/** Estimated charge on the ticket (labour + other), display only — the delivery posting is server-side. */
export const estCharge = (t: RepairTicketDto) => (n(t.labourCharge) + n(t.otherCharge)).toFixed(2)

/** Value of shop metal added at delivery (fine × rate per g), as the server bills it. */
export const addedValue = (t: RepairTicketDto) => (n(t.addedFine ?? '0') * n(t.addedRate ?? '0')).toFixed(2)
export const addedMetalLabel = (t: RepairTicketDto) => (t.addedMetal === 'OTHER' ? 'Other metal' : `${t.addedMetal ?? ''}${t.addedKaratCode ? ` ${t.addedKaratCode}` : ''}`)
