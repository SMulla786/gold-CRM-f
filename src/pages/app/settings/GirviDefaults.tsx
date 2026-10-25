import { useState } from 'react'

import { MpinDialog } from '@/components/MpinDialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useSaveSetting, useSettings } from '@/lib/appQueries'
import { useAuth } from '@/lib/auth'
import type { SettingsDto } from '@/shared'

type Defaults = SettingsDto['girvi.defaults']

export function GirviDefaults() {
  const { can } = useAuth()
  const { data: settings } = useSettings()
  const save = useSaveSetting()
  const [v, setV] = useState<Defaults | null>(null)
  const [catText, setCatText] = useState('')
  const [mpinOpen, setMpinOpen] = useState(false)

  if (!settings) return <p className="text-sm text-muted-foreground">Loading…</p>
  const cur = v ?? settings['girvi.defaults']
  const set = <K extends keyof Defaults>(k: K, val: Defaults[K]) => setV({ ...cur, [k]: val })
  const categories = v ? cur.categories : settings['girvi.defaults'].categories
  const catValue = catText || categories.join(', ')

  const onSave = (mpin: string) => {
    const cats = catValue.split(',').map((s) => s.trim()).filter(Boolean)
    return save.mutateAsync({ key: 'girvi.defaults', value: { ...cur, categories: cats.length ? cats : ['Gold'] }, mpin })
  }

  return (
    <div className="max-w-2xl space-y-6">
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Girvi defaults</CardTitle>
          {can('settings.misc', 'edit') && <Button size="sm" onClick={() => setMpinOpen(true)}>Save (MPIN)</Button>}
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5"><Label htmlFor="gd-rate">Interest %</Label><Input id="gd-rate" type="number" step="0.01" value={cur.ratePercent} onChange={(e) => set('ratePercent', Number(e.target.value))} /></div>
          <div className="space-y-1.5"><Label>Per</Label>
            <Select value={cur.ratePeriod} onValueChange={(nv) => set('ratePeriod', nv as Defaults['ratePeriod'])}><SelectTrigger aria-label="Rate period"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="MONTHLY">Month</SelectItem><SelectItem value="ANNUAL">Year</SelectItem></SelectContent></Select>
          </div>
          <div className="space-y-1.5"><Label>Interest type</Label>
            <Select value={cur.interestType} onValueChange={(nv) => set('interestType', nv as Defaults['interestType'])}><SelectTrigger aria-label="Interest type"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="SI">Simple</SelectItem><SelectItem value="CI">Compound</SelectItem></SelectContent></Select>
          </div>
          <div className="space-y-1.5"><Label>Compounding</Label>
            <Select value={cur.ciPeriod} onValueChange={(nv) => set('ciPeriod', nv as Defaults['ciPeriod'])}><SelectTrigger aria-label="Compounding period"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="DAILY">Daily</SelectItem><SelectItem value="MONTHLY">Monthly</SelectItem><SelectItem value="HALF_YEARLY">Half-yearly</SelectItem><SelectItem value="YEARLY">Yearly</SelectItem></SelectContent></Select>
          </div>
          <div className="space-y-1.5"><Label>Day count</Label>
            <Select value={cur.method} onValueChange={(nv) => set('method', nv as Defaults['method'])}><SelectTrigger aria-label="Day count method"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="FULL_MONTH">Full month</SelectItem><SelectItem value="DAY_WISE">Day-wise</SelectItem></SelectContent></Select>
          </div>
          <div className="space-y-1.5"><Label htmlFor="gd-std">Loan % of valuation</Label><Input id="gd-std" type="number" value={cur.stdPercent} onChange={(e) => set('stdPercent', Number(e.target.value))} /></div>
          <div className="space-y-1.5"><Label htmlFor="gd-tenure">Default tenure (months)</Label><Input id="gd-tenure" type="number" value={cur.tenureMonths} onChange={(e) => set('tenureMonths', Number(e.target.value))} /></div>
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="gd-cats">Pledge categories (comma-separated)</Label><Input id="gd-cats" value={catValue} onChange={(e) => setCatText(e.target.value)} /></div>
        </CardContent>
      </Card>
      <MpinDialog open={mpinOpen} title="Authenticate & save girvi defaults" onConfirm={async (mpin) => { await onSave(mpin); setMpinOpen(false) }} onClose={() => setMpinOpen(false)} />
    </div>
  )
}
