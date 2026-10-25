import type { SettingsDto } from '@/shared'

export type Numbering = SettingsDto['invoice.sale']

/** Indian FY (Apr–Mar) label. `d` is injectable for tests; defaults to today. */
export const fyLabel = (fmt: Numbering['fyFormat'], d = new Date()): string => {
  const start = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1
  const end = String(start + 1).slice(2)
  return fmt === 'SHORT' ? `${String(start).slice(2)}-${end}` : fmt === 'YEAR' ? `${start}` : `${start}-${end}`
}

/** Next-number preview per series. shortcut: mirrors docs/api-phase4.md §Numbering; the server DocSequence is authoritative. */
export function previewNo(n: Numbering, series: 'gst' | 'rough', d = new Date()): string {
  const prefix = series === 'gst' ? n.gstPrefix : n.roughPrefix
  const num = String(series === 'gst' ? n.gstStart : n.roughStart).padStart(n.padding, '0')
  if (n.format === 'NUMERIC') return num
  if (n.format === 'PREFIX') return `${prefix}${n.delimiter}${num}`
  return `${prefix}${n.delimiter}${fyLabel(n.fyFormat, d)}${n.delimiter}${num}`
}
