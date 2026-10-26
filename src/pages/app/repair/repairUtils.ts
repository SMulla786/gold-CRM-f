// Shared formatting + labels for the repair board, ledger, dialogs and slip.
import type { RepairTicketDto } from '@/shared'

export const inr = (s: string) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(s))
export const date = (s: string) => new Date(s).toLocaleDateString('en-IN')
export const n = (s: string) => Number(s) || 0

/** English status names (CSV export); on screen use STATUS_KEY with t(). */
export const STATUS_LABEL: Record<RepairTicketDto['status'], string> = {
  RECEIVED: 'Received',
  IN_PROGRESS: 'In progress',
  IN_REVIEW: 'In review (QA)',
  READY: 'Ready',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
}

/** i18n keys for the status names, translated at render. */
export const STATUS_KEY: Record<RepairTicketDto['status'], string> = {
  RECEIVED: 'udhari.col_received',
  IN_PROGRESS: 'repair.st_in_progress',
  IN_REVIEW: 'repair.st_in_review',
  READY: 'repair.st_ready',
  DELIVERED: 'repair.st_delivered',
  CANCELLED: 'gst.col_cancelled',
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
/** `otherLabel` = the translated 'Other metal'. */
export const addedMetalLabel = (t: RepairTicketDto, otherLabel = 'Other metal') => (t.addedMetal === 'OTHER' ? otherLabel : `${t.addedMetal ?? ''}${t.addedKaratCode ? ` ${t.addedKaratCode}` : ''}`)
