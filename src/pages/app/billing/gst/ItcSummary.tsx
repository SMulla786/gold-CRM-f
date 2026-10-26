import { Landmark, Receipt, UserX } from 'lucide-react'

import { ExcelExportButton } from '@/components/CsvExportButton'
import { KpiTile } from '@/components/KpiTile'
import { SectionCard } from '@/components/SectionCard'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { downloadCsv } from '@/lib/csv'
import { useT } from '@/lib/i18n'
import { useGstr3b, useGstRegisterAll } from '@/lib/reportsQueries'
import type { GstRegisterRowDto } from '@/shared'

const inr = (n: string | number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(n))
const r2 = (n: number) => Math.round(n * 100) / 100

interface Bucket { key: string; label: string; gstin: string; bills: number; taxable: number; cgst: number; sgst: number; igst: number }
const HEAD = ['Bills', 'Taxable', 'CGST', 'SGST', 'IGST', 'Total ITC']
/** On-screen header keys; HEAD and the first-column names stay English for the CSV. */
const HEAD_KEY: Record<string, string> = { Bills: 'billing.tab_bills', Taxable: 'gst.taxable', 'Total ITC': 'gst.col_total_itc', Month: 'gst.month', Supplier: 'bill.supplier', Reason: 'draft.reason' }

function group(rows: GstRegisterRowDto[], keyOf: (r: GstRegisterRowDto) => [string, string, string]): Bucket[] {
  const m = new Map<string, Bucket>()
  for (const r of rows) {
    const [key, label, gstin] = keyOf(r)
    const b = m.get(key) ?? { key, label, gstin, bills: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0 }
    b.bills++; b.taxable += Number(r.taxable); b.cgst += Number(r.cgst); b.sgst += Number(r.sgst); b.igst += Number(r.igst)
    m.set(key, b)
  }
  return [...m.values()]
}
const cells = (b: Bucket) => [b.bills, r2(b.taxable), r2(b.cgst), r2(b.sgst), r2(b.igst), r2(b.cgst + b.sgst + b.igst)]

/**
 * TASK-97 ITC summary: claimable = ACTIVE GST purchase bills from suppliers with a GSTIN (or reverse charge) — the GSTR-3B rule;
 * split by the bill's ITC eligibility into eligible (by month / supplier), blocked u/s 17(5) (by reason) and ineligible (by supplier).
 */
export function ItcSummary({ from, to }: { from: string; to: string }) {
  const t = useT()
  const range = { from: from || undefined, to: to || undefined }
  const g3b = useGstr3b(range)
  const reg = useGstRegisterAll({ ...range, kind: 'PURCHASE' })
  const claimable = (reg.data ?? []).filter((r) => r.party.gstin || r.reverseCharge)
  const eligible = claimable.filter((r) => (r.itcEligibility ?? 'ELIGIBLE') === 'ELIGIBLE')
  const blocked = group(claimable.filter((r) => r.itcEligibility === 'BLOCKED_17_5'), (r) => [r.itcBlockReason || '', r.itcBlockReason || t('gst.no_reason'), '']).sort((a, b) => a.label.localeCompare(b.label))
  const ineligible = group(claimable.filter((r) => r.itcEligibility === 'INELIGIBLE'), (r) => [String(r.party.id), r.party.name, r.party.gstin ?? '']).sort((a, b) => a.label.localeCompare(b.label))
  const byMonth = group(eligible, (r) => [r.billDate.slice(0, 7), r.billDate.slice(0, 7), '']).sort((a, b) => a.key.localeCompare(b.key))
  const bySupplier = group(eligible, (r) => [String(r.party.id), r.party.name, r.party.gstin ?? '']).sort((a, b) => b.cgst + b.sgst + b.igst - (a.cgst + a.sgst + a.igst))
  const taxable = eligible.reduce((a, r) => a + Number(r.taxable), 0)
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
