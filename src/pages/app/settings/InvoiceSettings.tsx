import { useState } from 'react'

import { AuthedImage } from '@/components/AuthedImage'
import { MpinDialog } from '@/components/MpinDialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useSaveSetting, useSettings, useUploadInvoiceMedia } from '@/lib/appQueries'
import { useAuth } from '@/lib/auth'
import { previewNo, type Numbering } from '@/lib/invoiceNumber'
import { InvoiceFormatCard } from '@/pages/app/billing/invoice/InvoiceFormatCard'
import { INVOICE_PRINT_COLUMNS, type SettingsDto } from '@/shared'

type MpinAction = { title: string; run: (mpin: string) => Promise<unknown> }

export function InvoiceSettings() {
  const { data: settings } = useSettings()
  const [mpinAction, setMpinAction] = useState<MpinAction | null>(null)
  return (
    <div className="space-y-6">
      {settings ? (
        <>
          <NumberingCard settings={settings} settingKey="invoice.sale" title="Sale invoice numbering" ask={setMpinAction} />
          <NumberingCard settings={settings} settingKey="invoice.purchase" title="Purchase invoice numbering" ask={setMpinAction} />
          <InvoiceFormatCard settings={settings} ask={setMpinAction} />
          <ContentCard settings={settings} ask={setMpinAction} />
          <MediaCard settings={settings} ask={setMpinAction} />
          <AmountBasedRateCard settings={settings} ask={setMpinAction} />
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Loading…</p>
      )}
      <MpinDialog open={!!mpinAction} title={mpinAction?.title} onConfirm={(m) => mpinAction!.run(m)} onClose={() => setMpinAction(null)} />
    </div>
  )
}

function SaveSettingCard({ title, children, onSave, ask }: { title: string; children: React.ReactNode; onSave: (mpin: string) => Promise<unknown>; ask: (a: MpinAction) => void }) {
  const { can } = useAuth()
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>{title}</CardTitle>
        {can('settings.misc', 'edit') && <Button size="sm" onClick={() => ask({ title: 'Authenticate & save', run: onSave })}>Save</Button>}
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  )
}

function NumberingCard({ settings, settingKey, title, ask }: { settings: SettingsDto; settingKey: 'invoice.sale' | 'invoice.purchase'; title: string; ask: (a: MpinAction) => void }) {
  const save = useSaveSetting()
  const [v, setV] = useState<Numbering>(settings[settingKey])
  const set = <K extends keyof Numbering>(k: K, val: Numbering[K]) => setV((s) => ({ ...s, [k]: val }))
  return (
    <SaveSettingCard title={title} ask={ask} onSave={(mpin) => save.mutateAsync({ key: settingKey, value: v, mpin })}>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label>Format</Label>
          <Select value={v.format} onValueChange={(nv) => set('format', nv as Numbering['format'])}>
            <SelectTrigger aria-label="Number format"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="NUMERIC">Numeric (00001)</SelectItem>
              <SelectItem value="PREFIX">Prefix (INV-00001)</SelectItem>
              <SelectItem value="FY_PREFIX">FY prefix (INV/2026-27/00001)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Delimiter</Label>
          <Select value={v.delimiter} onValueChange={(nv) => set('delimiter', nv as Numbering['delimiter'])}>
            <SelectTrigger aria-label="Delimiter"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="/">/</SelectItem><SelectItem value="-">-</SelectItem><SelectItem value=".">.</SelectItem></SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${settingKey}-pad`}>Padding</Label>
          <Input id={`${settingKey}-pad`} type="number" min={3} max={6} value={v.padding} onChange={(e) => set('padding', Number(e.target.value))} />
        </div>
        <div className="space-y-1.5">
          <Label>FY format</Label>
          <Select value={v.fyFormat} onValueChange={(nv) => set('fyFormat', nv as Numbering['fyFormat'])}>
            <SelectTrigger aria-label="FY format"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="FULL">2026-27</SelectItem><SelectItem value="SHORT">26-27</SelectItem><SelectItem value="YEAR">2026</SelectItem></SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${settingKey}-gp`}>GST prefix</Label>
          <Input id={`${settingKey}-gp`} value={v.gstPrefix} onChange={(e) => set('gstPrefix', e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${settingKey}-gs`}>GST start no.</Label>
          <Input id={`${settingKey}-gs`} type="number" min={1} value={v.gstStart} onChange={(e) => set('gstStart', Number(e.target.value))} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${settingKey}-rp`}>Rough prefix</Label>
          <Input id={`${settingKey}-rp`} value={v.roughPrefix} onChange={(e) => set('roughPrefix', e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${settingKey}-rs`}>Rough start no.</Label>
          <Input id={`${settingKey}-rs`} type="number" min={1} value={v.roughStart} onChange={(e) => set('roughStart', Number(e.target.value))} />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={v.gstOnRemainingMetal} onCheckedChange={(c) => set('gstOnRemainingMetal', Boolean(c))} />
        GST on remaining amount (subtotal − metal received)
      </label>
      <div className="rounded-md border bg-muted/40 p-3 text-sm">
        <span className="text-muted-foreground">Next number preview — </span>
        <span className="font-medium">GST {previewNo(v, 'gst')}</span>
        <span className="mx-2 text-muted-foreground">·</span>
        <span className="font-medium">Rough {previewNo(v, 'rough')}</span>
      </div>
    </SaveSettingCard>
  )
}

function ContentCard({ settings, ask }: { settings: SettingsDto; ask: (a: MpinAction) => void }) {
  const save = useSaveSetting()
  const [v, setV] = useState(settings['invoice.content'])
  return (
    <SaveSettingCard title="Invoice content" ask={ask} onSave={(mpin) => save.mutateAsync({ key: 'invoice.content', value: v, mpin })}>
      <div className="space-y-1.5 sm:max-w-xs">
        <Label>Design</Label>
        <Select value={v.format} onValueChange={(nv) => setV({ ...v, format: nv as typeof v.format })}>
          <SelectTrigger aria-label="Invoice design"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="CLASSIC">Classic</SelectItem>
            <SelectItem value="PROFESSIONAL">Professional</SelectItem>
            <SelectItem value="PREMIUM_DARK">Premium Dark</SelectItem>
            <SelectItem value="CLASSIC_BOXY">Classic Boxy</SelectItem>
            <SelectItem value="LETTERHEAD">Letterhead</SelectItem>
            <SelectItem value="LETTERHEAD_2">Letterhead 2</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="inv-terms">Invoice terms</Label>
        <textarea id="inv-terms" rows={3} className="w-full rounded-md border bg-transparent px-3 py-2 text-sm" value={v.terms} onChange={(e) => setV({ ...v, terms: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="inv-disc">Just Bill disclaimer</Label>
        <textarea id="inv-disc" rows={2} className="w-full rounded-md border bg-transparent px-3 py-2 text-sm" value={v.justBillDisclaimer} onChange={(e) => setV({ ...v, justBillDisclaimer: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label>Printed item columns <span className="font-normal text-muted-foreground">(none ticked = show all)</span></Label>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {INVOICE_PRINT_COLUMNS.map((c) => (
            <label key={c} className="flex items-center gap-2 text-sm capitalize">
              <Checkbox
                checked={v.columns.includes(c)}
                onCheckedChange={(on) => setV({ ...v, columns: on ? [...v.columns, c] : v.columns.filter((x) => x !== c) })}
                aria-label={c}
              />
              {c}
            </label>
          ))}
        </div>
      </div>
      <div className="space-y-1.5 sm:max-w-xs">
        <Label htmlFor="inv-wm-op">Watermark opacity — {v.watermarkOpacity}%</Label>
        <input id="inv-wm-op" type="range" min={0} max={100} className="w-full" value={v.watermarkOpacity} onChange={(e) => setV({ ...v, watermarkOpacity: Number(e.target.value) })} />
      </div>
    </SaveSettingCard>
  )
}

function MediaCard({ settings, ask }: { settings: SettingsDto; ask: (a: MpinAction) => void }) {
  const { can } = useAuth()
  const upload = useUploadInvoiceMedia()
  const media = settings['invoice.media']
  const [ver, setVer] = useState(0)
  const row = (kind: 'logo' | 'signature' | 'watermark', label: string, urlKey: 'logoUrl' | 'signatureUrl' | 'watermarkUrl') => (
    <div className="flex flex-wrap items-center gap-3">
      <span className="w-24 text-sm font-medium">{label}</span>
      {(media[urlKey] || ver > 0) && <AuthedImage path={`/app/files/invoice/${kind}`} ver={ver} alt={label} className="h-12 max-w-[160px] rounded border object-contain" />}
      {can('settings.misc', 'edit') && (
        <Input
          type="file" accept="image/jpeg,image/png,image/webp" className="max-w-xs" aria-label={`Upload ${label}`}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) ask({ title: `Upload ${label}`, run: async (mpin) => { await upload.mutateAsync({ kind, file: f, mpin }); setVer((n) => n + 1) } }) }}
        />
      )}
    </div>
  )
  return (
    <Card>
      <CardHeader><CardTitle>Invoice media</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">JPEG / PNG / WebP, up to 2 MB. Shown on the printed invoice.</p>
        {row('logo', 'Logo', 'logoUrl')}
        {row('signature', 'Signature', 'signatureUrl')}
        {row('watermark', 'Watermark', 'watermarkUrl')}
      </CardContent>
    </Card>
  )
}

function AmountBasedRateCard({ settings, ask }: { settings: SettingsDto; ask: (a: MpinAction) => void }) {
  const save = useSaveSetting()
  const [v, setV] = useState(settings['calc.amountBasedRate'])
  return (
    <SaveSettingCard title="Amount-based rate" ask={ask} onSave={(mpin) => save.mutateAsync({ key: 'calc.amountBasedRate', value: v, mpin })}>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={v.enabled} onCheckedChange={(c) => setV({ ...v, enabled: Boolean(c) })} />
        Enter the line total and derive the rate (instead of rate → total)
      </label>
    </SaveSettingCard>
  )
}
