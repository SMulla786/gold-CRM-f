import { businessDayISO } from '@/shared'
import { useState } from 'react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
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

  return (
    <div className="space-y-4">
      {data && !data.gstin && <div className="rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">{t('gst.no_gstin')}</div>}

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5"><Label htmlFor="g3-month">{t('gst.month')}</Label><input id="g3-month" type="month" className="h-9 rounded-md border bg-transparent px-3 text-sm" value={month} onChange={(e) => setMonth(e.target.value || thisMonth())} /></div>
      </div>

      {isLoading || !data ? (
        <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
      ) : (
        <>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">3.1(a) · {t('gst.outward')}</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 text-sm tabular-nums sm:grid-cols-4">
              <div><div className="text-muted-foreground">{t('gst.taxable')}</div><div className="text-lg font-semibold">{inr(data.outward.taxable)}</div></div>
              <div><div className="text-muted-foreground">CGST</div><div className="text-lg font-semibold">{inr(data.outward.cgst)}</div></div>
              <div><div className="text-muted-foreground">SGST</div><div className="text-lg font-semibold">{inr(data.outward.sgst)}</div></div>
              <div><div className="text-muted-foreground">IGST</div><div className="text-lg font-semibold">{inr(data.outward.igst)}</div></div>
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">4 · {t('gst.itc')}</CardTitle></CardHeader>
              <CardContent className="space-y-1 text-sm tabular-nums">
                <div className="flex justify-between"><span className="text-muted-foreground">CGST</span><span>{inr(data.itc.cgst)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">SGST</span><span>{inr(data.itc.sgst)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">IGST</span><span>{inr(data.itc.igst)}</span></div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{t('gst.non_gst')}</CardTitle></CardHeader>
              <CardContent className="text-2xl font-semibold tabular-nums">{inr(data.nonGst)}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{t('gst.net_payable')}</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-semibold tabular-nums">{inr(data.netPayableIndicative)}</div><p className="mt-1 text-xs text-muted-foreground">{t('gst.net_payable_note')}</p></CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
