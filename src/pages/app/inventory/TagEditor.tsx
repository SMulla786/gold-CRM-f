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
import { useActivateTagTemplate, useDeleteTagTemplate, useSaveTagTemplate, useStock, useTagTemplates } from '@/lib/inventoryQueries'
import { cn } from '@/lib/utils'
import { STOCK_CLASSES, TAG_DIRECTIONS, TAG_FIELDS, TAG_SHAPES, type StockItemDto, type TagElement, type TagTemplateDto } from '@/shared'

import { TagLabel } from './TagLabel'

const CLASS_LABEL: Record<string, string> = { GOLD: 'Gold', SILVER: 'Silver', STONE: 'Stone', ARTIFICIAL: 'Artificial', FRANCHISE: 'Franchise' }
const SHAPE_LABEL: Record<string, string> = { RECT: 'Rectangle', ROUNDED: 'Rounded corners', BUTTERFLY: 'Butterfly (fold-over)' }
const DIRECTION_LABEL: Record<string, string> = { HORIZONTAL: 'Horizontal', VERTICAL: 'Vertical (turned 90°)' }
const FIELD_LABEL: Record<string, string> = { tagNo: 'Tag no.', huid: 'HUID', itemName: 'Item name', karat: 'Purity', gross: 'Gross wt', net: 'Net wt', fine: 'Fine wt', rate: 'Rate', shopName: 'Shop name' }
const TYPE_LABEL: Record<TagElement['type'], string> = { text: 'Text', field: 'Field', barcode: 'Barcode', image: 'Logo' }
const PRESETS: [string, string, number, number][] = [
  ['80x12', '80 × 12 jewellery standard', 80, 12],
  ['100x12', '100 × 12 long tail', 100, 12],
  ['75x12', '75 × 12 compact', 75, 12],
  ['85x15', '85 × 15 wide', 85, 15],
  ['50x25', '50 × 25 box', 50, 25],
  ['60x30', '60 × 30 box', 60, 30],
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
  const set = (patch: Partial<TagElement>) => onChange({ ...el, ...patch })
  const hasText = el.type === 'text' || el.type === 'field'
  return (
    <div className="space-y-4">
      {el.type === 'text' && (
        <div className="space-y-1.5">
          <Label htmlFor="el-text">Text</Label>
          <Input id="el-text" maxLength={200} value={el.text ?? ''} onChange={(e) => set({ text: e.target.value })} />
        </div>
      )}
      {(el.type === 'field' || el.type === 'barcode') && (
        <div className="space-y-1.5">
          <Label>Prints</Label>
          <Select value={el.field ?? 'tagNo'} onValueChange={(v) => set({ field: v as TagElement['field'] })}>
            <SelectTrigger aria-label="Element field">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TAG_FIELDS.map((f) => <SelectItem key={f} value={f}>{FIELD_LABEL[f]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <NumField id="el-x" label="X (mm)" value={el.x} onChange={(v) => set({ x: v ?? 0 })} />
        <NumField id="el-y" label="Y (mm)" value={el.y} onChange={(v) => set({ y: v ?? 0 })} />
        <NumField id="el-w" label="Width (mm)" value={el.w} onChange={(v) => set({ w: v ?? 0 })} />
        <NumField id="el-h" label="Height (mm)" value={el.h} onChange={(v) => set({ h: v ?? 0 })} />
        <NumField id="el-angle" label="Angle (°)" value={el.angle} step="1" min={-360} onChange={(v) => set({ angle: v })} />
        <NumField id="el-opacity" label="Opacity (0–1)" value={el.opacity} step="0.1" onChange={(v) => set({ opacity: v })} />
        {hasText && <NumField id="el-font" label="Font size (pt)" value={el.fontSize} step="0.5" min={1} onChange={(v) => set({ fontSize: v })} />}
        {hasText && (
          <div className="flex items-end gap-2 pb-2">
            <Checkbox id="el-bold" checked={!!el.bold} onCheckedChange={(v) => set({ bold: v === true })} />
            <Label htmlFor="el-bold">Bold</Label>
          </div>
        )}
      </div>
    </div>
  )
}

function Editor({ initial, sample, shopName, canEdit, canDelete, onDone }: { initial: Draft; sample: StockItemDto; shopName: string; canEdit: boolean; canDelete: boolean; onDone: (id?: number) => void }) {
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
          <CardTitle>Preview</CardTitle>
          <CardDescription>{sample === SAMPLE ? 'Sample piece (no tagged stock yet).' : `Using ${sample.tagNo ?? sample.itemName.name} from your stock.`}</CardDescription>
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
            <CardTitle>Label</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-6 pt-0">
            <div className="space-y-1.5">
              <Label htmlFor="tpl-name">Template name</Label>
              <Input id="tpl-name" maxLength={60} value={d.name} onChange={(e) => set({ name: e.target.value })} />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Size</Label>
                <Select value={preset} onValueChange={(v) => { setPreset(v); const p = PRESETS.find(([k]) => k === v); if (p) set({ widthMm: p[2], heightMm: p[3] }) }}>
                  <SelectTrigger aria-label="Label size">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRESETS.map(([k, label]) => <SelectItem key={k} value={k}>{label}</SelectItem>)}
                    <SelectItem value="custom">Custom size</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <NumField id="tpl-w" label="Width (mm)" value={d.widthMm} min={5} onChange={(v) => { setPreset('custom'); set({ widthMm: v ?? 0 }) }} />
              <NumField id="tpl-h" label="Height (mm)" value={d.heightMm} min={5} onChange={(v) => { setPreset('custom'); set({ heightMm: v ?? 0 }) }} />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Shape</Label>
                <Select value={d.shape} onValueChange={(v) => set({ shape: v as Draft['shape'] })}>
                  <SelectTrigger aria-label="Label shape">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TAG_SHAPES.map((s) => <SelectItem key={s} value={s}>{SHAPE_LABEL[s]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Direction</Label>
                <Select value={d.direction} onValueChange={(v) => set({ direction: v as Draft['direction'] })}>
                  <SelectTrigger aria-label="Label direction">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TAG_DIRECTIONS.map((s) => <SelectItem key={s} value={s}>{DIRECTION_LABEL[s]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {d.shape === 'BUTTERFLY' && <NumField id="tpl-neck" label="Neck width (mm)" value={d.neckWidthMm ?? undefined} onChange={(v) => set({ neckWidthMm: v ?? null })} />}
            </div>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Use for</legend>
              <div className="flex flex-wrap gap-4">
                {STOCK_CLASSES.map((c) => (
                  <div key={c} className="flex items-center gap-2">
                    <Checkbox
                      id={`tpl-class-${c}`}
                      checked={d.appliesTo.includes(c)}
                      onCheckedChange={(v) => set({ appliesTo: v ? [...d.appliesTo, c] : d.appliesTo.filter((x) => x !== c) })}
                    />
                    <Label htmlFor={`tpl-class-${c}`}>{CLASS_LABEL[c]}</Label>
                  </div>
                ))}
              </div>
            </fieldset>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Elements</CardTitle>
            <CardDescription>Positions are in mm from the label's top-left corner.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 p-6 pt-0">
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => addEl('text')}><Type className="size-4" aria-hidden />Add text</Button>
              <Button size="sm" variant="outline" onClick={() => addEl('field')}><Variable className="size-4" aria-hidden />Add field</Button>
              <Button size="sm" variant="outline" onClick={() => addEl('barcode')}><Barcode className="size-4" aria-hidden />Add barcode</Button>
              <Button size="sm" variant="outline" onClick={() => addEl('image')}><ImageIcon className="size-4" aria-hidden />Add logo</Button>
            </div>
            <ul className="divide-y rounded-xl border">
              {d.elements.map((el) => (
                <li key={el.id} className={cn('flex items-center gap-2 px-3 py-2 text-sm', el.id === sel && 'bg-muted')}>
                  <button type="button" className="flex-1 text-left" aria-pressed={el.id === sel} onClick={() => setSel(el.id)}>
                    <span className="font-medium">{TYPE_LABEL[el.type]}</span>
                    <span className="text-muted-foreground"> · {el.type === 'text' ? el.text || '(empty)' : el.type === 'image' ? 'shop logo' : FIELD_LABEL[el.field ?? 'tagNo']}</span>
                  </button>
                  <Button size="icon" variant="ghost" aria-label={`Remove ${TYPE_LABEL[el.type].toLowerCase()} element`} onClick={() => { set({ elements: d.elements.filter((e) => e.id !== el.id) }); if (sel === el.id) setSel(null) }}>
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                </li>
              ))}
              {d.elements.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted-foreground">No elements yet. Add one above.</li>}
            </ul>
            {selected ? <ElementProps el={selected} onChange={setEl} /> : <p className="text-sm text-muted-foreground">Pick an element to change its position and style.</p>}
          </CardContent>
        </Card>
      </div>

      {canEdit && (
        <div className="flex flex-wrap gap-2">
          <Button disabled={!valid || save.isPending} onClick={async () => { const id = await saveDraft(); set({ id }); onDone(id) }}>Save template</Button>
          <Button
            variant="outline"
            disabled={!valid || d.appliesTo.length === 0 || save.isPending || activate.isPending}
            onClick={async () => { const id = await saveDraft(); await activate.mutateAsync(id); set({ id, isActive: true }); onDone(id) }}
          >
            Save and set active
          </Button>
          {d.id != null && canDelete && (
            <Button variant="ghost" disabled={remove.isPending} onClick={async () => { await remove.mutateAsync(d.id!); onDone() }}>Delete template</Button>
          )}
        </div>
      )}
    </div>
  )
}

export function TagEditor() {
  const { can, me } = useAuth()
  const { data: templates, isLoading } = useTagTemplates()
  const { data: stock } = useStock({ status: 'AVAILABLE', method: 'TAG', pageSize: 1 })
  const sample = stock?.items[0] ?? SAMPLE
  // key = which template is open ('new' or its id); remounting the editor resets its draft.
  const [open, setOpen] = useState<string | null>(null)
  const current = open === 'new' ? newDraft() : templates?.find((t) => String(t.id) === open)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="icon-chip"><Tag className="size-5" aria-hidden /></span>
          <div>
            <h2 className="text-xl">Tag editor</h2>
            <p className="text-sm text-muted-foreground">Design the label printed on each tag. The active template for a stock class is used by Tags.</p>
          </div>
        </div>
        {can('inventory.printer_setting', 'edit') && (
          <Button onClick={() => setOpen('new')}><Plus className="size-4" aria-hidden />New template</Button>
        )}
      </div>

      <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {templates?.map((t) => (
          <button key={t.id} type="button" className="rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => setOpen(String(t.id))}>
            <Card className={cn('h-full gap-2 hover:-translate-y-1', open === String(t.id) && 'border-primary')}>
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-1">
                <CardTitle className="truncate text-base">{t.name}</CardTitle>
                {t.isActive && <Badge>Active</Badge>}
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {t.widthMm} × {t.heightMm} mm · {t.appliesTo.map((c) => CLASS_LABEL[c]).join(', ') || 'No class'}
              </CardContent>
            </Card>
          </button>
        ))}
        {!isLoading && templates?.length === 0 && (
          <div className="col-span-full flex flex-col items-center gap-3 py-10 text-center">
            <span className="icon-chip"><Tag className="size-5" aria-hidden /></span>
            <p className="text-sm text-muted-foreground">No templates yet. Tags print with the standard layout until you create one.</p>
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
