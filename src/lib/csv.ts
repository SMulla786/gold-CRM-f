// Client-side CSV export (no dep). Every field is quoted, so commas, quotes and newlines are safe.
type Cell = string | number | null | undefined

export function toCsv(rows: Cell[][]): string {
  // Strings starting with = + - @ tab/CR get a leading ' so Excel won't run user text (remarks, names) as a formula.
  const cell = (v: Cell) => (typeof v === 'string' && /^[=+\-@\t\r]/.test(v) ? `'${v}` : String(v ?? ''))
  return rows.map((r) => r.map((v) => `"${cell(v).replace(/"/g, '""')}"`).join(',')).join('\r\n')
}

export function downloadCsv(filename: string, rows: Cell[][]) {
  // BOM so Excel reads UTF-8.
  const blob = new Blob(['﻿' + toCsv(rows)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
