import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { downloadCsv } from '@/lib/csv'
import { DATE_LOCALE, useLocale, useT } from '@/lib/i18n'
import { downloadGstr1Json, useGstr1 } from '@/lib/reportsQueries'

const inr = (s: string) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(s))
const thisMonth = () => new Date().toISOString().slice(0, 7)
/** "YYYY-MM" → first/last day of the month as ISO dates. */
const monthRange = (m: string) => {
  const [y, mo] = m.split('-').map(Number)
  const last = new Date(y, mo, 0).getDate()
  return { from: `${m}-01`, to: `${m}-${String(last).padStart(2, '0')}` }
}

type Section = 'b2b' | 'b2cl' | 'b2cs' | 'hsnB2b' | 'hsnB2c' | 'cdnr' | 'docIssue'

export function Gstr1Report() {
  const t = useT()
  const { locale } = useLocale()
  const [month, setMonth] = useState(thisMonth())
  const [section, setSection] = useState<Section>('b2b')
  const range = monthRange(month)
  const { data, isLoading } = useGstr1(range)
  const [downloading, setDownloading] = useState(false)
  const fdate = (s: string) => new Date(s).toLocaleDateString(DATE_LOCALE[locale])

  const downloadJson = async () => {
    setDownloading(true)
    try { await downloadGstr1Json(range) } finally { setDownloading(false) }
  }

  const TABS: { key: Section; label: string }[] = [
    { key: 'b2b', label: t('gst.b2b') }, { key: 'b2cl', label: t('gst.b2cl') }, { key: 'b2cs', label: t('gst.b2cs') },
    { key: 'hsnB2b', label: t('gst.hsn_b2b') }, { key: 'hsnB2c', label: t('gst.hsn_b2c') }, { key: 'cdnr', label: t('gst.cdnr') }, { key: 'docIssue', label: t('gst.docs') },
  ]

  // Each section: header row + value rows, used for both the table and its CSV.
  const tableFor = (): { head: string[]; rows: (string | number)[][] } => {
    if (!data) return { head: [], rows: [] }
    switch (section) {
      case 'b2b':
        return { head: ['GSTIN', 'Party', 'Inv', 'Date', 'POS', 'Rate', 'Taxable', 'CGST', 'SGST', 'IGST', 'Value'],
          rows: data.b2b.map((r) => [r.gstin, r.party, r.invNo, fdate(r.invDate), r.pos, r.rate, r.taxable, r.cgst, r.sgst, r.igst, r.invValue]) }
      case 'b2cl':
        return { head: ['Inv', 'Date', 'POS', 'Rate', 'Taxable', 'CGST', 'SGST', 'IGST', 'Value'],
          rows: data.b2cl.map((r) => [r.invNo, fdate(r.invDate), r.pos, r.rate, r.taxable, r.cgst, r.sgst, r.igst, r.invValue]) }
      case 'b2cs':
        return { head: ['POS', 'Rate', 'Type', 'Taxable', 'CGST', 'SGST', 'IGST'],
          rows: data.b2cs.map((r) => [r.pos, r.rate, r.supplyType, r.taxable, r.cgst, r.sgst, r.igst]) }
      case 'hsnB2b':
      case 'hsnB2c':
        return { head: ['HSN', 'UQC', 'Qty', 'Rate', 'Taxable', 'CGST', 'SGST', 'IGST', 'Total'],
          rows: data[section].map((r) => [r.hsnCode, r.uqc, r.qty, r.rate, r.taxable, r.cgst, r.sgst, r.igst, r.total]) }
      case 'cdnr':
        return { head: ['GSTIN', 'Party', 'Inv', 'Note date', 'POS', 'Rate', 'Taxable', 'CGST', 'SGST', 'IGST', 'Value'],
          rows: data.cdnr.map((r) => [r.gstin, r.party, r.invNo, fdate(r.noteDate), r.pos, r.rate, r.taxable, r.cgst, r.sgst, r.igst, r.invValue]) }
      case 'docIssue':
        return { head: ['Series', 'From', 'To', 'Total', 'Cancelled'],
          rows: data.docIssue.map((r) => [r.series, r.from, r.to, r.total, r.cancelled]) }
    }
  }

  const { head, rows } = tableFor()
  const money = new Set(['Taxable', 'CGST', 'SGST', 'IGST', 'Value', 'Total'])
  const exportCsv = () => downloadCsv(`gstr1-${section}-${month}.csv`, [head, ...rows.map((r) => r.map(String))])

  return (
    <div className="space-y-4">
      {data && !data.gstin && <div className="rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">{t('gst.no_gstin')}</div>}
      <div className="rounded-md border border-sky-500/40 bg-sky-500/10 px-3 py-2 text-sm text-sky-800 dark:text-sky-300">{t('gst.json_beta')}</div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5"><Label htmlFor="g1-month">{t('gst.month')}</Label><input id="g1-month" type="month" className="h-9 rounded-md border bg-transparent px-3 text-sm" value={month} onChange={(e) => setMonth(e.target.value || thisMonth())} /></div>
        <Button className="ml-auto" variant="outline" size="sm" disabled={!rows.length} onClick={exportCsv}>{t('common.export_csv')}</Button>
        <Button size="sm" disabled={downloading} onClick={() => void downloadJson()}>{downloading ? `${t('gst.download_json')}…` : t('gst.download_json')}</Button>
      </div>

      <nav className="flex flex-wrap gap-1 border-b">
        {TABS.map((tab) => (
          <button key={tab.key} type="button" onClick={() => setSection(tab.key)}
            className={`border-b-2 px-3 py-2 text-sm font-medium ${section === tab.key ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            {tab.label}{data ? ` (${(data[tab.key] as unknown[]).length})` : ''}
          </button>
        ))}
      </nav>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader><TableRow>{head.map((h) => <TableHead key={h} className={money.has(h) ? 'text-right' : ''}>{h}</TableHead>)}</TableRow></TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={head.length || 1} className="h-16 text-center text-muted-foreground">{t('common.loading')}</TableCell></TableRow>
              : rows.length ? rows.map((r, i) => (
                <TableRow key={i}>{r.map((c, j) => <TableCell key={j} className={money.has(head[j]) ? 'text-right tabular-nums' : ''}>{money.has(head[j]) ? inr(String(c)) : c}</TableCell>)}</TableRow>
              )) : <TableRow><TableCell colSpan={head.length || 1} className="h-16 text-center text-muted-foreground">{t('common.no_data')}</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
