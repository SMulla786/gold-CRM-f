import { ArrowDownToLine, ArrowUpFromLine, Landmark } from 'lucide-react'
import { Link } from 'react-router-dom'

import { KpiTile } from '@/components/KpiTile'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useT } from '@/lib/i18n'
import { useGstr3b } from '@/lib/reportsQueries'

const inr = (n: string | number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(n))
const sum = (...xs: string[]) => xs.reduce((a, x) => a + Number(x), 0)

/** TASK-97 GST compliance dashboard: GSTR-3B totals for one date range (no endpoint of its own) + links to every report. */
export function GstDashboard({ from, to }: { from: string; to: string }) {
  const t = useT()
  const { data, isLoading } = useGstr3b({ from: from || undefined, to: to || undefined })

  const links: { search: string; label: string }[] = [
    { search: 'report=register&kind=SELL', label: `${t('gst.register')} · ${t('gst.sales')}` },
    { search: 'report=register&kind=PURCHASE', label: `${t('gst.register')} · ${t('bill.kind_purchase')}` },
    { search: 'report=hsn', label: t('gst.hsn_summary') },
    { search: 'report=summary&group=MONTH', label: `${t('gst.period_summary')} · ${t('gst.month')}` },
    { search: 'report=summary&group=QUARTER', label: `${t('gst.period_summary')} · ${t('gst.quarter')}` },
    { search: 'report=summary&group=YEAR', label: `${t('gst.period_summary')} · ${t('gst.year')}` },
    { search: 'report=gstr1', label: t('gst.gstr1') },
    { search: 'report=gstr3b', label: t('gst.gstr3b') },
    { search: 'report=itc', label: 'ITC summary' },
    { search: 'report=reconcile', label: 'GSTR-2B reconciliation' },
  ]

  return (
    <div className="space-y-6">
      {!from || !to ? (
        <p className="text-sm text-muted-foreground">Pick both From and To dates to see the dashboard.</p>
      ) : isLoading || !data ? (
        <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
      ) : (
        <div className="stagger grid gap-4 sm:grid-cols-3">
          <KpiTile label="Outward supplies" icon={ArrowUpFromLine} value={inr(sum(data.outward.cgst, data.outward.sgst, data.outward.igst))}
            sub={`${t('gst.taxable')} ${inr(data.outward.taxable)} · CGST ${inr(data.outward.cgst)} · SGST ${inr(data.outward.sgst)} · IGST ${inr(data.outward.igst)}`} />
          <KpiTile label="Inward supplies (ITC)" icon={ArrowDownToLine} value={inr(sum(data.itc.cgst, data.itc.sgst, data.itc.igst))}
            sub={`CGST ${inr(data.itc.cgst)} · SGST ${inr(data.itc.sgst)} · IGST ${inr(data.itc.igst)}`} />
          <KpiTile label="Net GST cash liability" icon={Landmark} value={inr(data.netPayableIndicative)} sub={t('gst.net_payable_note')} />
        </div>
      )}

      <Card className="print:hidden">
        <CardHeader><CardTitle>Reports</CardTitle></CardHeader>
        <CardContent className="grid gap-2 p-6 pt-0 sm:grid-cols-2 lg:grid-cols-5">
          {links.map((l) => (
            <Button key={l.search} asChild variant="outline" className="justify-start">
              <Link to={{ search: `?${l.search}` }}>{l.label}</Link>
            </Button>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
