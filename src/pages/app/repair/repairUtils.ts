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

/** Estimated charge on the ticket (labour + other), display only — the delivery posting is server-side. */
export const estCharge = (t: RepairTicketDto) => (n(t.labourCharge) + n(t.otherCharge)).toFixed(2)
