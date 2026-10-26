import type { OrderDto } from '@/shared'

/** Same rule as the server's cancelOrder: PENDING/IN_PROCESS with no item still out with a karigar. */
export const cancellable = (o: OrderDto) => (o.status === 'PENDING' || o.status === 'IN_PROCESS') && !o.items.some((it) => it.status === 'ASSIGNED')

/** Karigar progress derived from the items already returned with the order (no extra request). */
export function karigarStatus(o: OrderDto): string {
  const names = [...new Set(o.items.map((it) => it.karigarIssue?.karigar.name).filter((x): x is string => !!x))]
  const out = o.items.filter((it) => it.status === 'ASSIGNED').length
  const back = o.items.filter((it) => it.status === 'RECEIVED' || it.status === 'DELIVERED').length
  const pending = o.items.filter((it) => it.status === 'PENDING').length
  const parts = [out ? `${out} at karigar` : '', back ? `${back} received` : '', pending ? `${pending} not assigned` : ''].filter(Boolean)
  return `${names.length ? `${names.join(', ')} · ` : ''}${parts.join(' · ') || '—'}`
}

/** Sum a weight/amount field over order items (strings from the DTO). */
export const sumOf = <T>(rows: T[], pick: (r: T) => string | null | undefined) => rows.reduce((a, r) => a + (Number(pick(r)) || 0), 0)
