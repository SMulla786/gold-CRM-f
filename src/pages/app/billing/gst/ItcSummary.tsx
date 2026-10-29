import { Landmark, Receipt, UserX } from 'lucide-react'

import { ExcelExportButton } from '@/components/CsvExportButton'
import { KpiTile } from '@/components/KpiTile'
import { SectionCard } from '@/components/SectionCard'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { downloadCsv } from '@/lib/csv'
import { useT } from '@/lib/i18n'
import { useGstr3b, useGstRegisterAll } from '@/lib/reportsQueries'
import { cells, itcSplit, type Bucket } from '@/pages/app/billing/gst/itc'

const inr = (n: string | number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(n))

const HEAD = ['Bills', 'Taxable', 'CGST', 'SGST', 'IGST', 'Total ITC']
/** On-screen header keys; HEAD and the first-column names stay English for the CSV. */
const HEAD_KEY: Record<string, string> = { Bills: 'billing.tab_bills', Taxable: 'gst.taxable', 'Total ITC': 'gst.col_total_itc', Month: 'gst.month', Supplier: 'bill.supplier', Reason: 'draft.reason' }

/** TASK-97 ITC summary over ACTIVE GST purchase bills (split rules: itc.ts). */
export function ItcSummary({ from, to }: { from: string; to: string }) {
  const t = useT()
  const range = { from: from || undefined, to: to || undefined }
  const g3b = useGstr3b(range)
  const reg = useGstRegisterAll({ ...range, kind: 'PURCHASE' })
  const { claimable, eligible, blocked, ineligible, byMonth, bySupplier, taxable } = itcSplit(reg.data ?? [], t('gst.no_reason'))
  const itc = g3b.data?.itc

  const itcFile = `gst-itc-${from || 'all'}-${to || 'all'}.csv`
  const itcRows = () => [
    ['Month', ...HEAD], ...byMonth.map((b) => [b.label, ...cells(b)]),
    [],
    ['Supplier', 'GSTIN', ...HEAD], ...bySupplier.map((b) => [b.label, b.gstin, ...cells(b)]),
    [],
    ['Blocked ITC reason', ...HEAD], ...blocked.map((b) => [b.label, ...cells(b)]),
    [],
    ['Ineligible ITC supplier', 'GSTIN', ...HEAD], ...ineligible.map((b) => [b.label, b.gstin, ...cells(b)]),
  ]
  const exportCsv = () => downloadCsv(itcFile, itcRows())

  const table = (first: string[], rows: Bucket[], lead: (b: Bucket) => React.ReactNode[]) => (
    <Table>
      <TableHeader><TableRow>{[...first, ...HEAD].map((h) => <TableHead key={h} className={first.includes(h) ? '' : 'text-right'}>{HEAD_KEY[h] ? t(HEAD_KEY[h]) : h}</TableHead>)}</TableRow></TableHeader>
      <TableBody>
        {reg.isLoading ? <TableRow><TableCell colSpan={first.length + HEAD.length} className="h-16 text-center text-muted-foreground">{t('common.loading')}</TableCell></TableRow>
          : rows.length ? rows.map((b) => (
            <TableRow key={b.key}>
              {lead(b).map((c, i) => <TableCell key={i}>{c}</TableCell>)}
              {cells(b).map((c, i) => <TableCell key={`n${i}`} className="text-right tabular-nums">{i === 0 ? c : inr(c)}</TableCell>)}
            </TableRow>
          )) : <TableRow><TableCell colSpan={first.length + HEAD.length} className="h-16 text-center text-muted-foreground">{t('common.no_data')}</TableCell></TableRow>}
      </TableBody>
    </Table>
  )

  return (
    <div className="space-y-6">
      <div className="stagger grid gap-4 sm:grid-cols-3">
        <KpiTile label={t('gst.eligible_itc')} icon={Landmark} value={itc ? inr(Number(itc.cgst) + Number(itc.sgst) + Number(itc.igst)) : '—'}
          sub={itc ? `CGST ${inr(itc.cgst)} · SGST ${inr(itc.sgst)} · IGST ${inr(itc.igst)}` : undefined} />
        <KpiTile tone="slate" label={t('gst.itc_taxable_value')} icon={Receipt} value={reg.data ? inr(taxable) : '—'} sub={reg.data ? t('gst.n_bills', { n: eligible.length }) : undefined} />
        <KpiTile tone="slate" label={t('gst.no_gstin_purchases')} icon={UserX} value={reg.data ? reg.data.length - claimable.length : '—'} sub={t('gst.no_itc_unregistered')} />
      </div>

      <div className="flex justify-end gap-2">
        <Button className="print:hidden" variant="outline" size="sm" disabled={!claimable.length} onClick={exportCsv}>{t('common.export_csv')}</Button>
        <ExcelExportButton className="print:hidden" size="sm" disabled={!claimable.length} filename={itcFile} rows={itcRows} />
      </div>

      <SectionCard title={t('gst.itc_by_month')}>{table(['Month'], byMonth, (b) => [b.label])}</SectionCard>
      <SectionCard title={t('gst.itc_by_supplier')}>
        {table(['Supplier', 'GSTIN'], bySupplier, (b) => [b.label, <span key="g" className="font-mono text-xs">{b.gstin}</span>])}
      </SectionCard>
      <SectionCard title={t('gst.itc_blocked_breakdown')}>{table(['Reason'], blocked, (b) => [b.label])}</SectionCard>
      <SectionCard title={t('gst.ineligible_itc')}>
        {table(['Supplier', 'GSTIN'], ineligible, (b) => [b.label, <span key="g" className="font-mono text-xs">{b.gstin}</span>])}
      </SectionCard>
    </div>
  )
}
