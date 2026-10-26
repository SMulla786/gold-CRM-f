import { Info, Landmark, Receipt, UserX } from 'lucide-react'

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
 * TASK-97 ITC summary: eligible ITC = ACTIVE GST purchase bills from suppliers with a GSTIN (the GSTR-3B rule),
 * broken down by month and supplier from the purchase register. Blocked/ineligible ITC needs a per-bill flag (not tracked).
 */
export function ItcSummary({ from, to }: { from: string; to: string }) {
  const t = useT()
  const range = { from: from || undefined, to: to || undefined }
  const g3b = useGstr3b(range)
  const reg = useGstRegisterAll({ ...range, kind: 'PURCHASE' })
  const eligible = (reg.data ?? []).filter((r) => r.party.gstin)
  const byMonth = group(eligible, (r) => [r.billDate.slice(0, 7), r.billDate.slice(0, 7), '']).sort((a, b) => a.key.localeCompare(b.key))
  const bySupplier = group(eligible, (r) => [String(r.party.id), r.party.name, r.party.gstin ?? '']).sort((a, b) => b.cgst + b.sgst + b.igst - (a.cgst + a.sgst + a.igst))
  const taxable = eligible.reduce((a, r) => a + Number(r.taxable), 0)
  const itc = g3b.data?.itc

  const exportCsv = () => downloadCsv(`gst-itc-${from || 'all'}-${to || 'all'}.csv`, [
    ['Month', ...HEAD], ...byMonth.map((b) => [b.label, ...cells(b)]),
    [],
    ['Supplier', 'GSTIN', ...HEAD], ...bySupplier.map((b) => [b.label, b.gstin, ...cells(b)]),
  ])

  const table = (first: string[], rows: Bucket[], lead: (b: Bucket) => React.ReactNode[]) => (
    <Table>
      <TableHeader><TableRow>{[...first, ...HEAD].map((h) => <TableHead key={h} className={first.includes(h) ? '' : 'text-right'}>{h}</TableHead>)}</TableRow></TableHeader>
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
        <KpiTile label="Eligible ITC" icon={Landmark} value={itc ? inr(Number(itc.cgst) + Number(itc.sgst) + Number(itc.igst)) : '—'}
          sub={itc ? `CGST ${inr(itc.cgst)} · SGST ${inr(itc.sgst)} · IGST ${inr(itc.igst)}` : undefined} />
        <KpiTile tone="slate" label="ITC taxable value" icon={Receipt} value={reg.data ? inr(taxable) : '—'} sub={reg.data ? `${eligible.length} bills` : undefined} />
        <KpiTile tone="slate" label="Purchases without GSTIN" icon={UserX} value={reg.data ? reg.data.length - eligible.length : '—'} sub="No ITC: supplier is unregistered" />
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />Blocked / ineligible ITC is not tracked per bill yet, so all ITC from registered suppliers is shown as eligible.
        </p>
        <Button className="print:hidden" variant="outline" size="sm" disabled={!eligible.length} onClick={exportCsv}>{t('common.export_csv')}</Button>
      </div>

      <SectionCard title="Eligible ITC by month">{table(['Month'], byMonth, (b) => [b.label])}</SectionCard>
      <SectionCard title="Eligible ITC by supplier">
        {table(['Supplier', 'GSTIN'], bySupplier, (b) => [b.label, <span key="g" className="font-mono text-xs">{b.gstin}</span>])}
      </SectionCard>
    </div>
  )
}
