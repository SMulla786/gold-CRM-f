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
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { useT } from '@/lib/i18n'
import { previewNo, type Numbering } from '@/lib/invoiceNumber'
import { useApiMutation } from '@/lib/queries'
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
          <JustBillPrefsCard settings={settings} ask={setMpinAction} />
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
  const t = useT()
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
        <div className="flex flex-wrap items-center gap-2">
          <Label>Printed item columns <span className="font-normal text-muted-foreground">(none ticked = show all)</span></Label>
          <Button type="button" size="sm" variant="outline" className="h-7" onClick={() => setV({ ...v, columns: [...INVOICE_PRINT_COLUMNS] })}>{t('jb98.select_all')}</Button>
          <Button type="button" size="sm" variant="outline" className="h-7" onClick={() => setV({ ...v, columns: [] })}>{t('jb98.deselect_all')}</Button>
        </div>
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
  const t = useT()
  const { can } = useAuth()
  const upload = useUploadInvoiceMedia()
  // TASK-98: DELETE /settings/invoice/:kind (settings.misc edit + MPIN) nulls the invoice.media field
  const remove = useApiMutation(({ kind, mpin }: { kind: 'logo' | 'signature' | 'watermark'; mpin: string }) => api.del(`/app/settings/invoice/${kind}`, { mpin }), { invalidate: [['settings']] })
  const media = settings['invoice.media']
  const [ver, setVer] = useState(0)
  // uploaded this session (ver > 0 shows a fresh upload before settings refetch); a removed kind hides until re-uploaded
  const [removed, setRemoved] = useState<string[]>([])
  const row = (kind: 'logo' | 'signature' | 'watermark', label: string, urlKey: 'logoUrl' | 'signatureUrl' | 'watermarkUrl') => (
    <div className="flex flex-wrap items-center gap-3">
      <span className="w-24 text-sm font-medium">{label}</span>
      {(media[urlKey] || ver > 0) && !removed.includes(kind) && <AuthedImage path={`/app/files/invoice/${kind}`} ver={ver} alt={label} className="h-12 max-w-[160px] rounded border object-contain" />}
      {can('settings.misc', 'edit') && (
        <Input
          type="file" accept="image/jpeg,image/png,image/webp" className="max-w-xs" aria-label={`Upload ${label}`}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) ask({ title: `Upload ${label}`, run: async (mpin) => { await upload.mutateAsync({ kind, file: f, mpin }); setRemoved((r) => r.filter((x) => x !== kind)); setVer((n) => n + 1) } }) }}
        />
      )}
      {can('settings.misc', 'edit') && media[urlKey] && !removed.includes(kind) && (
        <Button
          type="button" size="sm" variant="outline" className="text-destructive"
          onClick={() => ask({ title: t('jb98.remove_title', { label }), run: async (mpin) => { await remove.mutateAsync({ kind, mpin }); setRemoved((r) => [...r, kind]) } })}
        >
          {t('jb98.remove')}
        </Button>
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

/** TASK-98 Just Bill preferences ('justbill.prefs'): which columns / pay rows New Just Bill and its print show. Presentation only. */
type JbPrefKey = keyof SettingsDto['justbill.prefs']
const JB_PREFS: [JbPrefKey, string][] = [
  ['showRate', 'jb98.show_rate'],
  ['showMaking', 'jb98.show_making'],
  ['showGst', 'jb98.show_gst'],
  ['showOther', 'jb98.show_other'],
  ['showAdvance', 'jb98.show_advance'],
  ['showReturn', 'jb98.show_return'],
]

function JustBillPrefsCard({ settings, ask }: { settings: SettingsDto; ask: (a: MpinAction) => void }) {
  const t = useT()
  const save = useSaveSetting()
  const [v, setV] = useState(settings['justbill.prefs'])
  return (
    <SaveSettingCard title={t('jb98.prefs_title')} ask={ask} onSave={(mpin) => save.mutateAsync({ key: 'justbill.prefs', value: v, mpin })}>
      <p className="text-xs text-muted-foreground">{t('jb98.prefs_hint')}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {JB_PREFS.map(([k, key]) => (
          <label key={k} className="flex items-center gap-2 text-sm">
            <Checkbox checked={v[k]} onCheckedChange={(c) => setV({ ...v, [k]: c === true })} />
            {t(key)}
          </label>
        ))}
      </div>
    </SaveSettingCard>
  )
}
