// TASK-98: Settings › Invoice — bill print format picker + what the printed bill shows (setting 'billing.invoice').
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useBusinessProfile, useSaveSetting } from '@/lib/appQueries'
import { useAuth } from '@/lib/auth'
import { useBill, useBills } from '@/lib/billingQueries'
import { useT } from '@/lib/i18n'
import { useStates } from '@/lib/queries'
import { cn } from '@/lib/utils'
import { InvoicePrint } from '@/pages/app/billing/InvoicePrint'
import { FORMAT_LABEL_KEY } from '@/pages/app/billing/invoice/format'
import { INVOICE_FORMATS, type InvoiceFormat, type SettingsDto } from '@/shared'

type Value = SettingsDto['billing.invoice']
type Toggle = 'showDueBalance' | 'showAmountInWords' | 'showHsn' | 'showSignature' | 'showTerms' | 'showMetalPaymentWeight'
const TOGGLES: [Toggle, string][] = [
  ['showDueBalance', 'invfmt.show_due_balance'],
  ['showAmountInWords', 'invfmt.show_amount_in_words'],
  ['showHsn', 'invfmt.show_hsn'],
  ['showSignature', 'invfmt.show_signature'],
  ['showTerms', 'invfmt.show_terms'],
  ['showMetalPaymentWeight', 'invfmt.show_metal_pay_weight'],
]

export function InvoiceFormatCard({ settings, ask }: { settings: SettingsDto; ask: (a: { title: string; run: (mpin: string) => Promise<unknown> }) => void }) {
  const t = useT()
  const { can } = useAuth()
  const save = useSaveSetting()
  const [v, setV] = useState<Value>(settings['billing.invoice'])
  const canEdit = can('settings.misc', 'edit')
  const [full, setFull] = useState(false)
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div className="space-y-1.5">
          <CardTitle>{t('invfmt.title')}</CardTitle>
          <CardDescription>{t('invfmt.subtitle')}</CardDescription>
        </div>
        <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => setFull(true)}>{t('jb98.full_view')}</Button>
        {canEdit && <Button size="sm" onClick={() => ask({ title: t('invfmt.save_title'), run: (mpin) => save.mutateAsync({ key: 'billing.invoice', value: v, mpin }) })}>{t('invfmt.save')}</Button>}
        </div>
      </CardHeader>
      <CardContent className="grid gap-6 sm:grid-cols-[1fr_auto]">
        <div className="space-y-4">
          <div className="space-y-1.5 sm:max-w-xs">
            <Label>{t('invfmt.format')}</Label>
            <Select value={v.format} disabled={!canEdit} onValueChange={(nv) => setV({ ...v, format: nv as InvoiceFormat })}>
              <SelectTrigger aria-label={t('invfmt.format')}><SelectValue /></SelectTrigger>
              <SelectContent>
                {INVOICE_FORMATS.map((f) => <SelectItem key={f} value={f}>{t(FORMAT_LABEL_KEY[f])}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{t(`${FORMAT_LABEL_KEY[v.format]}_hint`)}</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {TOGGLES.map(([k, key]) => (
              <label key={k} className="flex items-center gap-2 text-sm">
                <Checkbox checked={v[k]} disabled={!canEdit} onCheckedChange={(c) => setV({ ...v, [k]: c === true })} />
                {t(key)}
              </label>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{t('invfmt.note')}</p>
        </div>
        <FormatPreview v={v} />
      </CardContent>
      <Dialog open={full} onOpenChange={setFull}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>{t('jb98.full_view_title')}</DialogTitle>
            <DialogDescription>{t('jb98.full_view_hint')}</DialogDescription>
          </DialogHeader>
          {full && <AllDesigns settings={{ ...settings, 'billing.invoice': v }} />}
        </DialogContent>
      </Dialog>
    </Card>
  )
}

/** Every INVOICE_FORMAT rendered with the latest sell bill. InvoicePrint `bare` = no .print-area inside the dialog. */
function AllDesigns({ settings }: { settings: SettingsDto }) {
  const t = useT()
  const { me } = useAuth()
  const { data: list, isLoading: listLoading, isError } = useBills({ kind: 'SELL', page: 1, pageSize: 1 })
  const latestId = list?.items[0]?.id
  const { data: bill, isLoading: billLoading } = useBill(latestId)
  const { data: business } = useBusinessProfile()
  const { data: states } = useStates()
  if (listLoading || (latestId && billLoading)) return <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
  if (isError || !bill) return <p className="text-sm text-muted-foreground">{t('jb98.no_bill')}</p>
  const shopName = business?.name ?? me?.business?.name ?? 'Shop'
  const stateName = states?.find((s) => s.id === business?.stateId)?.name
  return (
    <div className="space-y-6">
      {INVOICE_FORMATS.map((f) => (
        <section key={f} className="space-y-2">
          <h3 className="text-sm font-semibold">{t(FORMAT_LABEL_KEY[f])}</h3>
          <InvoicePrint bill={bill} format={f} settings={settings} shopName={shopName} business={business} stateName={stateName} bare />
        </section>
      ))}
    </div>
  )
}

/** Schematic paper preview — shape follows the format, lines follow the toggles. Not the real bill. */
function FormatPreview({ v }: { v: Value }) {
  const t = useT()
  const narrow = v.format === 'THERMAL_80' || v.format === 'THERMAL_58'
  const size = { A4_GST: 'w-40 aspect-[1/1.414]', A4_ESTIMATE: 'w-40 aspect-[1/1.414]', A4_IMAGES: 'w-40 aspect-[1/1.414]', A5: 'w-32 aspect-[1/1.414]', A6: 'w-24 aspect-[1/1.414]', THERMAL_80: 'w-24 min-h-52', THERMAL_58: 'w-[4.5rem] min-h-52' }[v.format]
  const bar = (w: string, cls = '') => <div className={cn('h-1.5 rounded-full bg-muted-foreground/25', w, cls)} />
  return (
    <div className="flex flex-col items-center gap-2" aria-label={t('invfmt.preview')}>
      <div className={cn('flex flex-col gap-1.5 rounded-md border bg-white p-2 shadow-sm dark:bg-card', size, narrow && 'border-dashed')}>
        {bar('w-1/2', 'mx-auto bg-muted-foreground/50')}
        {bar('w-2/3', 'mx-auto')}
        <div className="mx-auto text-[7px] font-semibold tracking-wide text-muted-foreground">{v.format === 'A4_ESTIMATE' ? 'ESTIMATE' : 'TAX INVOICE'}</div>
        <div className="space-y-1 border-y py-1">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-1">
              {v.format === 'A4_IMAGES' && <div className="size-3 shrink-0 rounded-sm bg-muted-foreground/30" />}
              {bar('flex-1')}
              {v.showHsn && !narrow && v.format !== 'A4_ESTIMATE' && bar('w-3')}
              {bar('w-4')}
            </div>
          ))}
        </div>
        {bar('w-1/3', 'ml-auto')}
        {v.showDueBalance && bar('w-1/3', 'ml-auto bg-amber-500/50')}
        {v.showAmountInWords && bar('w-3/4')}
        {v.showSignature && !narrow && bar('w-1/4', 'ml-auto mt-auto')}
        {v.showTerms && bar('w-full', 'bg-muted-foreground/15')}
      </div>
      <span className="text-xs text-muted-foreground">{t(FORMAT_LABEL_KEY[v.format])}</span>
    </div>
  )
}
