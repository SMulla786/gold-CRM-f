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

// Same rows as CSV, as .xlsx (write-excel-file is lazy-loaded so it stays out of the main bundle).
// Numeric strings ("1234.50", "-12") become numbers; long integer strings (mobiles, IDs) and leading-zero codes stay text.
const NUMERIC = /^-?(?:0|[1-9]\d{0,8})(?:\.\d+)?$|^-?(?:0|[1-9]\d{0,14})\.\d+$/
export function toXlsxRows(rows: Cell[][]): (string | number | null)[][] {
  return rows.map((r) => r.map((v) => {
    if (v == null || v === '') return null
    if (typeof v === 'number') return Number.isFinite(v) ? v : String(v)
    return NUMERIC.test(v) ? Number(v) : v
  }))
}

export async function downloadXlsx(filename: string, rows: Cell[][]) {
  const { default: writeExcelFile } = await import('write-excel-file/browser')
  const data = toXlsxRows(rows)
  const widths = (data[0] ?? []).map((_, i) => Math.min(40, data.reduce((w, r) => Math.max(w, String(r[i] ?? '').length + 2), 8)))
  await writeExcelFile(data, { columns: widths.map((width) => ({ width })), stickyRowsCount: 1 }).toFile(filename.replace(/\.csv$/i, '') + '.xlsx')
}
