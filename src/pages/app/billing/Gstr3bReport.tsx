import { businessDayISO } from '@/shared'
import { Landmark, Receipt, TriangleAlert, Wallet } from 'lucide-react'
import { useState } from 'react'

import { KpiTile } from '@/components/KpiTile'
import { SectionCard, TableCard } from '@/components/SectionCard'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { downloadCsv } from '@/lib/csv'
import { useT } from '@/lib/i18n'
import { useGstr3b } from '@/lib/reportsQueries'

const inr = (s: string) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(s))
const thisMonth = () => businessDayISO().slice(0, 7)
const monthRange = (m: string) => {
  const [y, mo] = m.split('-').map(Number)
  const last = new Date(y, mo, 0).getDate()
  return { from: `${m}-01`, to: `${m}-${String(last).padStart(2, '0')}` }
}

export function Gstr3bReport() {
  const t = useT()
  const [month, setMonth] = useState(thisMonth())
  const { data, isLoading } = useGstr3b(monthRange(month))

  // TASK-97: the return-form rows derivable from the endpoint (3.1(a), 4(A)(5)); same rows on screen and in the CSV.
  const head = ['Section', 'Description', 'Taxable', 'CGST', 'SGST', 'IGST']
  const rows = data ? [
    ['3.1(a)', t('gst.outward'), data.outward.taxable, data.outward.cgst, data.outward.sgst, data.outward.igst],
    ['4(A)(5)', 'All other ITC', '', data.itc.cgst, data.itc.sgst, data.itc.igst],
  ] : []

  return (
    <div className="space-y-6">
      {data && !data.gstin && <div className="flex items-start gap-2 rounded-2xl border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400"><TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />{t('gst.no_gstin')}</div>}

      <Card className="flex w-fit flex-wrap items-end gap-3 p-4 print:hidden">
        <div className="space-y-1.5"><Label htmlFor="g3-month">{t('gst.month')}</Label><input id="g3-month" type="month" className="h-9 rounded-xl border bg-transparent px-3 text-sm shadow-xs" value={month} onChange={(e) => setMonth(e.target.value || thisMonth())} /></div>
        <Button variant="outline" size="sm" disabled={!data} onClick={() => downloadCsv(`gstr3b-${month}.csv`, [head, ...rows])}>{t('common.export_csv')}</Button>
      </Card>
      <p className="hidden text-sm print:block">{t('gst.month')}: {month}</p>

      {isLoading || !data ? (
        <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
      ) : (
        <div className="grid gap-6 xl:grid-cols-12">
          <div className="space-y-6 xl:col-span-8">
            <SectionCard title={<>3.1(a) · {t('gst.outward')}</>} bodyClassName="stagger grid grid-cols-2 gap-4 p-6 sm:grid-cols-4">
              <KpiTile size="sm" label={t('gst.taxable')} value={inr(data.outward.taxable)} icon={Receipt} />
              <KpiTile size="sm" tone="slate" label="CGST" value={inr(data.outward.cgst)} icon={Landmark} />
              <KpiTile size="sm" tone="slate" label="SGST" value={inr(data.outward.sgst)} icon={Landmark} />
              <KpiTile size="sm" tone="slate" label="IGST" value={inr(data.outward.igst)} icon={Landmark} />
            </SectionCard>

            <SectionCard title={<>4 · {t('gst.itc')}</>} bodyClassName="divide-y px-6 py-2 text-sm tabular-nums">
              {(['cgst', 'sgst', 'igst'] as const).map((k) => (
                <div key={k} className="flex justify-between py-3"><span className="text-muted-foreground">{k.toUpperCase()}</span><span className="font-semibold">{inr(data.itc[k])}</span></div>
              ))}
            </SectionCard>

            <TableCard>
              <Table>
                <TableHeader><TableRow>{head.map((h, i) => <TableHead key={h} className={i > 1 ? 'text-right' : ''}>{h}</TableHead>)}</TableRow></TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r[0]}>{r.map((c, i) => <TableCell key={i} className={i > 1 ? 'text-right tabular-nums' : i === 0 ? 'font-medium' : ''}>{i > 1 ? (c ? inr(c) : '—') : c}</TableCell>)}</TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableCard>
          </div>

          <div className="space-y-6 xl:col-span-4">
            <div className="hero-card space-y-3 p-6">
              <div className="text-xs font-semibold uppercase tracking-widest text-white/60">{t('gst.net_payable')}</div>
              <div className="text-4xl font-extrabold tabular-nums break-words">{inr(data.netPayableIndicative)}</div>
              <p className="text-sm text-white/70">{t('gst.net_payable_note')}</p>
            </div>
            <KpiTile tone="slate" label={t('gst.non_gst')} value={inr(data.nonGst)} icon={Wallet} />
          </div>
        </div>
      )}
    </div>
  )
}
