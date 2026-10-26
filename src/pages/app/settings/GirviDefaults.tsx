import { useState } from 'react'

import { MpinDialog } from '@/components/MpinDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useSaveSetting, useSettings } from '@/lib/appQueries'
import { useAuth } from '@/lib/auth'
import type { SettingsDto } from '@/shared'

type Defaults = SettingsDto['girvi.defaults']
type Receipt = SettingsDto['girvi.receipt']
type ReceiptToggle = { [K in keyof Receipt]: Receipt[K] extends boolean ? K : never }[keyof Receipt]

const STD_DEFAULT = 60
const RECEIPT_TOGGLES: [ReceiptToggle, string][] = [
  ['showShopName', 'Shop name'],
  ['showShopAddress', 'Shop address'],
  ['showShopMobile', 'Shop mobile'],
  ['showShopGst', 'Shop GSTIN'],
  ['showCustomerName', 'Customer name'],
  ['showCustomerMobile', 'Customer mobile'],
  ['showCustomerAddress', 'Customer address'],
  ['showCustomerPhoto', 'Customer photo'],
  ['showGirviQr', 'Girvi-ID QR'],
  ['showItemPhoto', 'Item photos'],
  ['showItemWeights', 'Item weights (gross/purity/fine)'],
  ['showItemValuation', 'Item valuation'],
  ['showMonthlyInterest', 'Monthly interest'],
  ['showTotalInterest', 'Total interest'],
  ['showCalculations', 'Calculation summary'],
  ['showPaymentMode', 'Payment mode'],
  ['showItemHistory', 'Item history'],
  ['showRemarks', 'Remarks'],
  ['showSignatures', 'Signature lines'],
]

/** Small, static receipt mock that follows the toggles (no real loan needed). */
function ReceiptPreview({ r }: { r: Receipt }) {
  const thermal = r.format === 'THERMAL'
  return (
    <div className={`mx-auto space-y-2 rounded-xl border bg-white p-4 text-[11px] text-black shadow-sm ${thermal ? 'w-[80mm]' : 'w-full max-w-md'}`} aria-label="Receipt preview">
      <div className="text-center">
        {r.showShopName && <div className="text-sm font-bold">Your Jewellers</div>}
        {r.showShopAddress && <div>Main Road, Pune</div>}
        {(r.showShopMobile || r.showShopGst) && (
          <div>
            {r.showShopMobile && 'Mob 98XXXXXX10'}
            {r.showShopMobile && r.showShopGst && ' · '}
            {r.showShopGst && 'GSTIN 27ABCDE1234F1Z5'}
          </div>
        )}
      </div>
      <div className="flex justify-between border-y py-1">
        <span>
          Girvi #G-101 · 26/10/2026
          {(r.showCustomerName || r.showCustomerMobile) && <br />}
          {r.showCustomerName && 'Ramesh Patil'} {r.showCustomerMobile && '· 98XXXXXX21'}
          {r.showCustomerAddress && <><br />Kothrud, Pune</>}
        </span>
        <span className="flex gap-1">
          {r.showCustomerPhoto && <span className="grid size-8 place-items-center border">📷</span>}
          {r.showGirviQr && <span className="grid size-8 place-items-center border">QR</span>}
        </span>
      </div>
      <table className="w-full">
        <thead><tr className="text-left"><th>Item</th>{r.showItemWeights && <><th>Gross</th><th>Purity</th></>}<th>Net</th>{r.showItemValuation && <th className="text-right">Value</th>}</tr></thead>
        <tbody><tr><td>{r.showItemPhoto && '🖼 '}Gold chain</td>{r.showItemWeights && <><td>10.000</td><td>91.6%</td></>}<td>9.800</td>{r.showItemValuation && <td className="text-right">₹52,000</td>}</tr></tbody>
      </table>
      {(r.showCalculations || r.showMonthlyInterest || r.showTotalInterest) && (
        <div className="border-t pt-1">
          {r.showCalculations && <div>Principal ₹30,000 @ 2%/month SI</div>}
          {r.showMonthlyInterest && <div>Monthly interest ₹600</div>}
          {r.showTotalInterest && <div>Interest due ₹1,200</div>}
        </div>
      )}
      {r.showPaymentMode && <div>Paid out: Cash ₹30,000</div>}
      {r.showItemHistory && <div className="text-muted-foreground">History: 26/10 Grant · 26/11 Interest</div>}
      {r.showRemarks && <div>Remark: —</div>}
      {r.terms && <p className="whitespace-pre-wrap border-t pt-1">{r.terms}</p>}
      {r.showSignatures && (
        <div className="flex justify-between pt-6"><span className="border-t px-4">Customer</span><span className="border-t px-4">Authorised</span></div>
      )}
    </div>
  )
}

export function GirviDefaults() {
  const { can } = useAuth()
  const { data: settings } = useSettings()
  const save = useSaveSetting()
  const [v, setV] = useState<Defaults | null>(null)
  const [rv, setRv] = useState<Receipt | null>(null)
  const [newCat, setNewCat] = useState('')
  const [mpinOpen, setMpinOpen] = useState(false)

  if (!settings) return <p className="text-sm text-muted-foreground">Loading…</p>
  const cur = v ?? settings['girvi.defaults']
  const rcur = rv ?? settings['girvi.receipt']
  const set = <K extends keyof Defaults>(k: K, val: Defaults[K]) => setV({ ...cur, [k]: val })
  const setR = <K extends keyof Receipt>(k: K, val: Receipt[K]) => setRv({ ...rcur, [k]: val })
  const inactive = new Set(cur.inactiveCategories)
  const canEdit = can('settings.misc', 'edit')

  const addCategory = () => {
    const name = newCat.trim()
    if (!name || cur.categories.some((c) => c.toLowerCase() === name.toLowerCase())) return
    set('categories', [...cur.categories, name])
    setNewCat('')
  }
  const toggleCategory = (c: string) =>
    set('inactiveCategories', inactive.has(c) ? cur.inactiveCategories.filter((x) => x !== c) : [...cur.inactiveCategories, c])
  // Keep at least one active category, or New Girvi has nothing to pick.
  const activeCount = cur.categories.filter((c) => !inactive.has(c)).length

  // One MPIN saves whichever cards changed.
  const onSave = async (mpin: string) => {
    if (v) await save.mutateAsync({ key: 'girvi.defaults', value: cur, mpin })
    if (rv) await save.mutateAsync({ key: 'girvi.receipt', value: rcur, mpin })
    setV(null)
    setRv(null)
  }

  return (
    <div className="max-w-5xl space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl">Girvi defaults</h2>
          <p className="text-sm text-muted-foreground">Starting values prefilled on every new girvi loan</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Interest calculation</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Loan terms</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="gd-std">Loan % of valuation</Label>
            <div className="flex gap-2">
              <Input id="gd-std" type="number" value={cur.stdPercent} onChange={(e) => set('stdPercent', Number(e.target.value))} />
              <Button type="button" variant="outline" size="sm" className="h-9 shrink-0" disabled={cur.stdPercent === STD_DEFAULT} onClick={() => set('stdPercent', STD_DEFAULT)}>
                Reset to default ({STD_DEFAULT}%)
              </Button>
            </div>
          </div>
          <div className="space-y-1.5"><Label htmlFor="gd-tenure">Default tenure (months)</Label><Input id="gd-tenure" type="number" value={cur.tenureMonths} onChange={(e) => set('tenureMonths', Number(e.target.value))} /></div>
          <div className="space-y-1.5"><Label htmlFor="gd-penalty">Penalty % per month (after due)</Label><Input id="gd-penalty" type="number" step="0.01" min={0} max={100} value={cur.penaltyRatePercent ?? 0} onChange={(e) => set('penaltyRatePercent', Number(e.target.value))} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Manage item categories</CardTitle>
          <CardDescription>Inactive categories stay on old loans but are hidden on New Girvi.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="py-2">Name</th><th>Status</th><th className="text-right">Action</th></tr></thead>
            <tbody className="divide-y">
              {cur.categories.map((c) => {
                const off = inactive.has(c)
                return (
                  <tr key={c}>
                    <td className="py-2 font-medium">{c}</td>
                    <td><Badge variant={off ? 'secondary' : 'default'}>{off ? 'Inactive' : 'Active'}</Badge></td>
                    <td className="text-right">
                      <Button type="button" variant="ghost" size="sm" disabled={!canEdit || (!off && activeCount <= 1)} aria-label={`${off ? 'Activate' : 'Deactivate'} ${c}`} onClick={() => toggleCategory(c)}>
                        {off ? 'Activate' : 'Deactivate'}
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {canEdit && (
            <div className="flex max-w-sm gap-2">
              <Input id="gd-cats" aria-label="New category" placeholder="New category, e.g. Platinum" value={newCat} onChange={(e) => setNewCat(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCategory() } }} />
              <Button type="button" variant="outline" disabled={!newCat.trim()} onClick={addCategory}>Add</Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Receipt customization</CardTitle>
          <CardDescription>What the girvi receipt prints. The preview updates as you change it.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <div className="max-w-xs space-y-1.5">
              <Label>Default format</Label>
              <Select value={rcur.format} onValueChange={(nv) => setR('format', nv as Receipt['format'])}>
                <SelectTrigger aria-label="Receipt format"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="A4">A4</SelectItem><SelectItem value="THERMAL">Thermal 80 mm</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {RECEIPT_TOGGLES.map(([k, label]) => (
                <label key={k} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={rcur[k]} disabled={!canEdit} onCheckedChange={(c) => setR(k, c === true)} />
                  {label}
                </label>
              ))}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gd-terms">Terms printed on the receipt</Label>
              <textarea id="gd-terms" rows={3} maxLength={1000} className="w-full rounded-md border bg-transparent px-3 py-2 text-sm" value={rcur.terms} disabled={!canEdit} onChange={(e) => setR('terms', e.target.value)} />
            </div>
          </div>
          <ReceiptPreview r={rcur} />
        </CardContent>
      </Card>

      {canEdit && (
        <div className="flex justify-end">
          <Button size="sm" disabled={!v && !rv} onClick={() => setMpinOpen(true)}>Save (MPIN)</Button>
        </div>
      )}
      <MpinDialog open={mpinOpen} title="Authenticate & save girvi settings" onConfirm={async (mpin) => { await onSave(mpin); setMpinOpen(false) }} onClose={() => setMpinOpen(false)} />
    </div>
  )
}
