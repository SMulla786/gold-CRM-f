import { Printer } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAuth } from '@/lib/auth'
import { useT } from '@/lib/i18n'
import { usePrinterSettings, useSavePrinterSettings } from '@/lib/inventoryQueries'
import { PRINTER_TYPES, type PrinterSettingsDto } from '@/shared'

// Labels are i18n keys, translated at render.
const TYPE_LABEL: Record<(typeof PRINTER_TYPES)[number], string> = {
  THERMAL_LABEL: 'inv.printer.type_thermal',
  ZEBRA: 'inv.printer.type_zebra',
  A4_SHEET: 'inv.printer.type_a4',
}

type NumKey = Exclude<keyof PrinterSettingsDto, 'printerType'>
const FIELDS: [NumKey, string, string][] = [
  ['labelWidthMm', 'inv.printer.label_width', '0.5'],
  ['labelHeightMm', 'inv.printer.label_height', '0.5'],
  ['columns', 'inv.printer.columns', '1'],
  ['gapMm', 'inv.printer.gap', '0.5'],
  ['marginMm', 'inv.printer.margin', '0.5'],
]

function PrinterForm({ initial, canEdit }: { initial: PrinterSettingsDto; canEdit: boolean }) {
  const t = useT()
  const save = useSavePrinterSettings()
  const [f, setF] = useState<Record<NumKey, string>>(() => Object.fromEntries(FIELDS.map(([k]) => [k, String(initial[k])])) as Record<NumKey, string>)
  const [printerType, setPrinterType] = useState(initial.printerType)
  const n = (k: NumKey) => Number(f[k])
  const valid = FIELDS.every(([k]) => f[k].trim() !== '' && Number.isFinite(n(k))) && n('columns') >= 1 && n('columns') <= 6 && Number.isInteger(n('columns'))
  // Preview: two rows of the saved grid, scaled so a full row fits the card.
  const rowMm = n('columns') * n('labelWidthMm') + (n('columns') - 1) * n('gapMm') + 2 * n('marginMm')
  const scale = valid && rowMm > 0 ? Math.min(3, 480 / (rowMm * 3.78)) : 1

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>{t('inv.printer.printer')}</CardTitle>
          <CardDescription>{t('inv.printer.printer_desc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 p-6 pt-0">
          <div className="space-y-1.5">
            <Label>{t('inv.printer.type')}</Label>
            <Select value={printerType} disabled={!canEdit} onValueChange={(v) => setPrinterType(v as PrinterSettingsDto['printerType'])}>
              <SelectTrigger aria-label="Printer type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRINTER_TYPES.map((p) => (
                  <SelectItem key={p} value={p}>{t(TYPE_LABEL[p])}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {FIELDS.map(([k, label, step]) => (
              <div key={k} className="space-y-1.5">
                <Label htmlFor={`ps-${k}`}>{t(label)}</Label>
                <Input id={`ps-${k}`} type="number" min={k === 'columns' ? 1 : 0} max={k === 'columns' ? 6 : undefined} step={step} disabled={!canEdit} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
              </div>
            ))}
          </div>
          {canEdit && (
            <Button
              disabled={!valid || save.isPending}
              onClick={() => save.mutate({ printerType, labelWidthMm: n('labelWidthMm'), labelHeightMm: n('labelHeightMm'), columns: n('columns'), gapMm: n('gapMm'), marginMm: n('marginMm') })}
            >
              {save.isPending ? t('bill.saving') : t('inv.printer.save')}
            </Button>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t('inv.printer.preview')}</CardTitle>
          <CardDescription>{t('inv.printer.preview_desc')}</CardDescription>
        </CardHeader>
        <CardContent className="p-6 pt-0">
          {valid ? (
            <div className="overflow-hidden" style={{ height: `${(2 * n('labelHeightMm') + n('gapMm') + 2 * n('marginMm')) * scale}mm` }}>
              <div
                className="grid w-max origin-top-left border border-dashed bg-white"
                style={{ transform: `scale(${scale})`, gridTemplateColumns: `repeat(${n('columns')}, ${n('labelWidthMm')}mm)`, gap: `${n('gapMm')}mm`, padding: `${n('marginMm')}mm` }}
              >
                {Array.from({ length: n('columns') * 2 }, (_, i) => (
                  <div key={i} className="rounded-sm border border-black/40" style={{ height: `${n('labelHeightMm')}mm` }} />
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t('inv.printer.invalid')}</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export function PrinterSettings() {
  const t = useT()
  const { can } = useAuth()
  const { data, isLoading } = usePrinterSettings()
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="icon-chip"><Printer className="size-5" aria-hidden /></span>
        <div>
          <h2 className="text-xl">{t('inv.printer.title')}</h2>
          <p className="text-sm text-muted-foreground">{t('inv.printer.intro')}</p>
        </div>
      </div>
      {isLoading || !data ? <p className="text-sm text-muted-foreground">{t('common.loading')}</p> : <PrinterForm initial={data} canEdit={can('inventory.printer_setting', 'edit')} />}
    </div>
  )
}
