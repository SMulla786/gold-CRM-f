import { Barcode, Image as ImageIcon, Plus, Tag, Trash2, Type, Variable } from 'lucide-react'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAuth } from '@/lib/auth'
import { useT } from '@/lib/i18n'
import { useActivateTagTemplate, useDeleteTagTemplate, useSaveTagTemplate, useStock, useTagTemplates } from '@/lib/inventoryQueries'
import { cn } from '@/lib/utils'
import { STOCK_CLASSES, TAG_DIRECTIONS, TAG_FIELDS, TAG_SHAPES, type StockItemDto, type TagElement, type TagTemplateDto } from '@/shared'

import { TagLabel } from './TagLabel'

// Labels below are i18n keys, translated at render. 'HUID' is not a key: t() returns it unchanged.
const SHAPE_LABEL: Record<string, string> = { RECT: 'inv.editor.shape_rect', ROUNDED: 'inv.editor.shape_rounded', BUTTERFLY: 'inv.editor.shape_butterfly' }
const DIRECTION_LABEL: Record<string, string> = { HORIZONTAL: 'inv.editor.dir_horizontal', VERTICAL: 'inv.editor.dir_vertical' }
const FIELD_LABEL: Record<string, string> = { tagNo: 'inv.editor.f_tag_no', huid: 'HUID', itemName: 'bill.item_name', karat: 'jbill.col_purity', gross: 'inv.editor.f_gross', net: 'inv.editor.f_net', fine: 'inv.editor.f_fine', rate: 'udhari.rate', shopName: 'inv.editor.f_shop_name' }
const TYPE_LABEL: Record<TagElement['type'], string> = { text: 'inv.editor.type_text', field: 'inv.import.col_field', barcode: 'inv.editor.type_barcode', image: 'inv.editor.type_logo' }
const PRESETS: [string, string, number, number][] = [
  ['80x12', 'inv.editor.preset_80x12', 80, 12],
  ['100x12', 'inv.editor.preset_100x12', 100, 12],
  ['75x12', 'inv.editor.preset_75x12', 75, 12],
  ['85x15', 'inv.editor.preset_85x15', 85, 15],
  ['50x25', 'inv.editor.preset_50x25', 50, 25],
  ['60x30', 'inv.editor.preset_60x30', 60, 30],
]

/** Shown when no tagged stock exists yet. */
const SAMPLE: StockItemDto = {
  id: 0, branch: { id: 0, name: '' }, stockClass: 'GOLD', group: { id: 0, name: 'Rings' }, itemName: { id: 0, name: 'Gold Ring' }, hsnCode: null, method: 'TAG',
  tagNo: 'GR0001', huid: 'AB12CD', karatCode: '22K', pcs: 1, gross: '10.500', less: '0.200', net: '10.300', tunch: '91.67', wastage: '0', fine: '9.442',
  stoneCharge: '0', labour: '0', labourUnit: 'PER_GRAM', other: '0', rate: '6500', purchaseCost: null, status: 'AVAILABLE', entryNo: null, photoUrl: null, remarks: null, createdAt: '',
}

type Draft = Omit<TagTemplateDto, 'id' | 'isActive' | 'createdAt' | 'updatedAt'> & { id?: number; isActive: boolean }

const newDraft = (): Draft => ({
  name: 'New template', widthMm: 80, heightMm: 12, shape: 'BUTTERFLY', direction: 'HORIZONTAL', neckWidthMm: 10, appliesTo: ['GOLD'], isActive: false,
  elements: [
    { id: 'e1', type: 'field', field: 'itemName', x: 1, y: 1, w: 28, h: 3, fontSize: 6, bold: true },
    { id: 'e2', type: 'barcode', field: 'tagNo', x: 1, y: 4.5, w: 28, h: 5 },
    { id: 'e3', type: 'field', field: 'net', x: 46, y: 1, w: 30, h: 3, fontSize: 6 },
    { id: 'e4', type: 'field', field: 'tagNo', x: 46, y: 5, w: 30, h: 3, fontSize: 6 },
  ],
})

const presetOf = (w: number, h: number) => PRESETS.find(([, , pw, ph]) => pw === w && ph === h)?.[0] ?? 'custom'

function NumField({ id, label, value, onChange, step = '0.5', min = 0 }: { id: string; label: string; value: number | undefined; onChange: (v: number | undefined) => void; step?: string; min?: number }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type="number" min={min} step={step} value={value ?? ''} onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))} />
    </div>
  )
}

function ElementProps({ el, onChange }: { el: TagElement; onChange: (el: TagElement) => void }) {
  const t = useT()
  const set = (patch: Partial<TagElement>) => onChange({ ...el, ...patch })
  const hasText = el.type === 'text' || el.type === 'field'
  return (
    <div className="space-y-4">
      {el.type === 'text' && (
        <div className="space-y-1.5">
          <Label htmlFor="el-text">{t('inv.editor.type_text')}</Label>
          <Input id="el-text" maxLength={200} value={el.text ?? ''} onChange={(e) => set({ text: e.target.value })} />
        </div>
      )}
      {(el.type === 'field' || el.type === 'barcode') && (
        <div className="space-y-1.5">
          <Label>{t('inv.editor.prints')}</Label>
          <Select value={el.field ?? 'tagNo'} onValueChange={(v) => set({ field: v as TagElement['field'] })}>
            <SelectTrigger aria-label="Element field">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TAG_FIELDS.map((f) => <SelectItem key={f} value={f}>{t(FIELD_LABEL[f])}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <NumField id="el-x" label="X (mm)" value={el.x} onChange={(v) => set({ x: v ?? 0 })} />
        <NumField id="el-y" label="Y (mm)" value={el.y} onChange={(v) => set({ y: v ?? 0 })} />
        <NumField id="el-w" label={t('inv.editor.width')} value={el.w} onChange={(v) => set({ w: v ?? 0 })} />
        <NumField id="el-h" label={t('inv.editor.height')} value={el.h} onChange={(v) => set({ h: v ?? 0 })} />
        <NumField id="el-angle" label={t('inv.editor.angle')} value={el.angle} step="1" min={-360} onChange={(v) => set({ angle: v })} />
        <NumField id="el-opacity" label={t('inv.editor.opacity')} value={el.opacity} step="0.1" onChange={(v) => set({ opacity: v })} />
        {hasText && <NumField id="el-font" label={t('inv.editor.font_size')} value={el.fontSize} step="0.5" min={1} onChange={(v) => set({ fontSize: v })} />}
        {hasText && (
          <div className="flex items-end gap-2 pb-2">
            <Checkbox id="el-bold" checked={!!el.bold} onCheckedChange={(v) => set({ bold: v === true })} />
            <Label htmlFor="el-bold">{t('inv.editor.bold')}</Label>
          </div>
        )}
      </div>
    </div>
  )
}

function Editor({ initial, sample, shopName, canEdit, canDelete, onDone }: { initial: Draft; sample: StockItemDto; shopName: string; canEdit: boolean; canDelete: boolean; onDone: (id?: number) => void }) {
  const t = useT()
  const save = useSaveTagTemplate()
  const activate = useActivateTagTemplate()
  const remove = useDeleteTagTemplate()
  const [d, setD] = useState<Draft>(initial)
  const [sel, setSel] = useState<string | null>(initial.elements[0]?.id ?? null)
  const [preset, setPreset] = useState(() => presetOf(initial.widthMm, initial.heightMm))
  const selected = d.elements.find((e) => e.id === sel)
  const set = (patch: Partial<Draft>) => setD({ ...d, ...patch })
  const setEl = (el: TagElement) => set({ elements: d.elements.map((e) => (e.id === el.id ? el : e)) })
  const addEl = (type: TagElement['type']) => {
    const id = `e${Date.now().toString(36)}`
    const base = { id, type, x: 1, y: 1, w: type === 'barcode' ? 28 : type === 'image' ? 8 : 20, h: type === 'text' || type === 'field' ? 3 : 6 }
    const el: TagElement = type === 'text' ? { ...base, text: 'Text', fontSize: 6 } : type === 'field' ? { ...base, field: 'itemName', fontSize: 6 } : type === 'barcode' ? { ...base, field: 'tagNo' } : base
    set({ elements: [...d.elements, el] })
    setSel(id)
  }
  const body = () => ({ name: d.name.trim(), widthMm: d.widthMm, heightMm: d.heightMm, shape: d.shape, direction: d.direction, neckWidthMm: d.shape === 'BUTTERFLY' ? (d.neckWidthMm ?? 0) : undefined, elements: d.elements, appliesTo: d.appliesTo })
  const valid = d.name.trim() !== '' && d.widthMm >= 5 && d.heightMm >= 5
  const saveDraft = async () => (await save.mutateAsync({ id: d.id, body: body() })).id
  const scale = Math.max(1, Math.min(6, 150 / Math.max(d.widthMm, d.heightMm, 1)))
  const vertical = d.direction === 'VERTICAL'

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('inv.editor.preview')}</CardTitle>
          <CardDescription>{sample === SAMPLE ? t('inv.editor.sample') : t('inv.editor.using', { name: sample.tagNo ?? sample.itemName.name })}</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto p-6 pt-0">
          <div style={{ width: `${(vertical ? d.heightMm : d.widthMm) * scale}mm`, height: `${(vertical ? d.widthMm : d.heightMm) * scale}mm` }}>
            <div className="origin-top-left" style={{ transform: `scale(${scale})` }}>
              <TagLabel template={d} item={sample} shopName={shopName} />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('inv.editor.label')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-6 pt-0">
            <div className="space-y-1.5">
              <Label htmlFor="tpl-name">{t('inv.editor.template_name')}</Label>
              <Input id="tpl-name" maxLength={60} value={d.name} onChange={(e) => set({ name: e.target.value })} />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>{t('inv.editor.size')}</Label>
                <Select value={preset} onValueChange={(v) => { setPreset(v); const p = PRESETS.find(([k]) => k === v); if (p) set({ widthMm: p[2], heightMm: p[3] }) }}>
                  <SelectTrigger aria-label="Label size">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRESETS.map(([k, label]) => <SelectItem key={k} value={k}>{t(label)}</SelectItem>)}
                    <SelectItem value="custom">{t('inv.editor.custom_size')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <NumField id="tpl-w" label={t('inv.editor.width')} value={d.widthMm} min={5} onChange={(v) => { setPreset('custom'); set({ widthMm: v ?? 0 }) }} />
              <NumField id="tpl-h" label={t('inv.editor.height')} value={d.heightMm} min={5} onChange={(v) => { setPreset('custom'); set({ heightMm: v ?? 0 }) }} />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>{t('inv.editor.shape')}</Label>
                <Select value={d.shape} onValueChange={(v) => set({ shape: v as Draft['shape'] })}>
                  <SelectTrigger aria-label="Label shape">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TAG_SHAPES.map((s) => <SelectItem key={s} value={s}>{t(SHAPE_LABEL[s])}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t('udhari.direction')}</Label>
                <Select value={d.direction} onValueChange={(v) => set({ direction: v as Draft['direction'] })}>
                  <SelectTrigger aria-label="Label direction">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TAG_DIRECTIONS.map((s) => <SelectItem key={s} value={s}>{t(DIRECTION_LABEL[s])}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {d.shape === 'BUTTERFLY' && <NumField id="tpl-neck" label={t('inv.editor.neck_width')} value={d.neckWidthMm ?? undefined} onChange={(v) => set({ neckWidthMm: v ?? null })} />}
            </div>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">{t('inv.editor.use_for')}</legend>
              <div className="flex flex-wrap gap-4">
                {STOCK_CLASSES.map((c) => (
                  <div key={c} className="flex items-center gap-2">
                    <Checkbox
                      id={`tpl-class-${c}`}
                      checked={d.appliesTo.includes(c)}
                      onCheckedChange={(v) => set({ appliesTo: v ? [...d.appliesTo, c] : d.appliesTo.filter((x) => x !== c) })}
                    />
                    <Label htmlFor={`tpl-class-${c}`}>{t(`class.${c}`)}</Label>
                  </div>
                ))}
              </div>
            </fieldset>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('inv.editor.elements')}</CardTitle>
            <CardDescription>{t('inv.editor.elements_desc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 p-6 pt-0">
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => addEl('text')}><Type className="size-4" aria-hidden />{t('inv.editor.add_text')}</Button>
              <Button size="sm" variant="outline" onClick={() => addEl('field')}><Variable className="size-4" aria-hidden />{t('inv.editor.add_field')}</Button>
              <Button size="sm" variant="outline" onClick={() => addEl('barcode')}><Barcode className="size-4" aria-hidden />{t('inv.editor.add_barcode')}</Button>
              <Button size="sm" variant="outline" onClick={() => addEl('image')}><ImageIcon className="size-4" aria-hidden />{t('inv.editor.add_logo')}</Button>
            </div>
            <ul className="divide-y rounded-xl border">
              {d.elements.map((el) => (
                <li key={el.id} className={cn('flex items-center gap-2 px-3 py-2 text-sm', el.id === sel && 'bg-muted')}>
                  <button type="button" className="flex-1 text-left" aria-pressed={el.id === sel} onClick={() => setSel(el.id)}>
                    <span className="font-medium">{t(TYPE_LABEL[el.type])}</span>
                    <span className="text-muted-foreground"> · {el.type === 'text' ? el.text || t('inv.editor.empty') : el.type === 'image' ? t('inv.editor.shop_logo') : t(FIELD_LABEL[el.field ?? 'tagNo'])}</span>
                  </button>
                  <Button size="icon" variant="ghost" aria-label={`Remove ${el.type === 'image' ? 'logo' : el.type} element`} onClick={() => { set({ elements: d.elements.filter((e) => e.id !== el.id) }); if (sel === el.id) setSel(null) }}>
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                </li>
              ))}
              {d.elements.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted-foreground">{t('inv.editor.no_elements')}</li>}
            </ul>
            {selected ? <ElementProps el={selected} onChange={setEl} /> : <p className="text-sm text-muted-foreground">{t('inv.editor.pick_element')}</p>}
          </CardContent>
        </Card>
      </div>

      {canEdit && (
        <div className="flex flex-wrap gap-2">
          <Button disabled={!valid || save.isPending} onClick={async () => { const id = await saveDraft(); set({ id }); onDone(id) }}>{t('inv.editor.save')}</Button>
          <Button
            variant="outline"
            disabled={!valid || d.appliesTo.length === 0 || save.isPending || activate.isPending}
            onClick={async () => { const id = await saveDraft(); await activate.mutateAsync(id); set({ id, isActive: true }); onDone(id) }}
          >
            {t('inv.editor.save_active')}
          </Button>
          {d.id != null && canDelete && (
            <Button variant="ghost" disabled={remove.isPending} onClick={async () => { await remove.mutateAsync(d.id!); onDone() }}>{t('inv.editor.delete')}</Button>
          )}
        </div>
      )}
    </div>
  )
}

export function TagEditor() {
  const t = useT()
  const { can, me } = useAuth()
  const { data: templates, isLoading } = useTagTemplates()
  const { data: stock } = useStock({ status: 'AVAILABLE', method: 'TAG', pageSize: 1 })
  const sample = stock?.items[0] ?? SAMPLE
  // key = which template is open ('new' or its id); remounting the editor resets its draft.
  const [open, setOpen] = useState<string | null>(null)
  const current = open === 'new' ? newDraft() : templates?.find((tpl) => String(tpl.id) === open)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="icon-chip"><Tag className="size-5" aria-hidden /></span>
          <div>
            <h2 className="text-xl">{t('inv.editor.title')}</h2>
            <p className="text-sm text-muted-foreground">{t('inv.editor.intro')}</p>
          </div>
        </div>
        {can('inventory.printer_setting', 'edit') && (
          <Button onClick={() => setOpen('new')}><Plus className="size-4" aria-hidden />{t('inv.editor.new')}</Button>
        )}
      </div>

      <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {templates?.map((tpl) => (
          <button key={tpl.id} type="button" className="rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => setOpen(String(tpl.id))}>
            <Card className={cn('h-full gap-2 hover:-translate-y-1', open === String(tpl.id) && 'border-primary')}>
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-1">
                <CardTitle className="truncate text-base">{tpl.name}</CardTitle>
                {tpl.isActive && <Badge>{t('bill.status_active')}</Badge>}
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {tpl.widthMm} × {tpl.heightMm} mm · {tpl.appliesTo.map((c) => t(`class.${c}`)).join(', ') || t('inv.editor.no_class')}
              </CardContent>
            </Card>
          </button>
        ))}
        {!isLoading && templates?.length === 0 && (
          <div className="col-span-full flex flex-col items-center gap-3 py-10 text-center">
            <span className="icon-chip"><Tag className="size-5" aria-hidden /></span>
            <p className="text-sm text-muted-foreground">{t('inv.editor.no_templates')}</p>
          </div>
        )}
      </div>

      {current && (
        <Editor
          key={open}
          initial={current}
          sample={sample}
          shopName={me?.business?.name ?? ''}
          canEdit={can('inventory.printer_setting', 'edit')}
          canDelete={can('inventory.printer_setting', 'delete')}
          onDone={(id) => setOpen(id != null ? String(id) : null)}
        />
      )}
    </div>
  )
}
