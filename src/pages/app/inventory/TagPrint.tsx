import JsBarcode from 'jsbarcode'
import { Barcode as BarcodeIcon, ListChecks, Scale, Tags, Weight, type LucideIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { useLocation } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAuth } from '@/lib/auth'
import { useT } from '@/lib/i18n'
import { useAllStock, usePrinterSettings, useTagTemplates } from '@/lib/inventoryQueries'
import { printerSettingsBody, type PrinterSettingsDto, type StockItemDto } from '@/shared'

import { TagLabel } from './TagLabel'

function Barcode({ value }: { value: string }) {
  const ref = useRef<SVGSVGElement>(null)
  useEffect(() => {
    if (ref.current) JsBarcode(ref.current, value, { format: 'CODE128', width: 1.4, height: 34, fontSize: 11, margin: 2 })
  }, [value])
  return <svg ref={ref} />
}

const DEFAULT_PRINTER = printerSettingsBody.parse({})

/** @page for the print only: label printers get a page one row of labels tall; A4 sheets keep A4 with the saved margin as padding. */
function pageCss(p: PrinterSettingsDto): string {
  if (p.printerType === 'A4_SHEET') return '@page { size: A4; margin: 0; }'
  const width = p.columns * p.labelWidthMm + (p.columns - 1) * p.gapMm + 2 * p.marginMm
  return `@page { size: ${width}mm ${p.labelHeightMm + p.gapMm}mm; margin: 0; }`
}

export function TagPrint() {
  const t = useT()
  const { can, me } = useAuth()
  const canLayout = can('inventory.printer_setting', 'view')
  // Users without printer-setting access print with the defaults and the fixed layout.
  const printer = usePrinterSettings(canLayout).data ?? DEFAULT_PRINTER
  const { data: templates } = useTagTemplates(canLayout)
  const templateFor = (c: string) => templates?.find((tpl) => tpl.isActive && (tpl.appliesTo as string[]).includes(c))
  const [printing, setPrinting] = useState(false)
  const print = () => {
    flushSync(() => setPrinting(true))
    window.addEventListener('afterprint', () => setPrinting(false), { once: true })
    window.print()
  }
  const { data } = useAllStock({ status: 'AVAILABLE', method: 'TAG' })
  const items = (data ?? []).filter((i) => i.tagNo)
  // "Save & print" from New Stock lands here with the new items preselected (router state).
  const preIds = (useLocation().state as { ids?: number[] } | null)?.ids
  const [picked, setPicked] = useState<Set<number>>(() => new Set(preIds ?? []))
  const toggle = (id: number) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const selected: StockItemDto[] = items.filter((i) => picked.has(i.id))

  // Filters narrow only the pick list; already-picked items stay on the sheet.
  const [f, setF] = useState({ stockClass: '', karatCode: '', groupId: '', itemNameId: '', q: '' })
  const uniq = <T,>(rows: [string, T][]) => [...new Map(rows).entries()]
  const classOpts = uniq(items.map((i) => [i.stockClass, t(`class.${i.stockClass}`)]))
  const karatOpts = uniq(items.filter((i) => i.karatCode).map((i) => [i.karatCode as string, i.karatCode as string]))
  const groupOpts = uniq(items.filter((i) => !f.stockClass || i.stockClass === f.stockClass).map((i) => [String(i.group.id), i.group.name]))
  const nameOpts = uniq(items.filter((i) => (!f.stockClass || i.stockClass === f.stockClass) && (!f.groupId || String(i.group.id) === f.groupId)).map((i) => [String(i.itemName.id), i.itemName.name]))
  const needle = f.q.trim().toLowerCase()
  const visible = items.filter(
    (i) =>
      (!f.stockClass || i.stockClass === f.stockClass) &&
      (!f.karatCode || i.karatCode === f.karatCode) &&
      (!f.groupId || String(i.group.id) === f.groupId) &&
      (!f.itemNameId || String(i.itemName.id) === f.itemNameId) &&
      (!needle || [i.tagNo, i.huid, i.itemName.name].some((s) => s?.toLowerCase().includes(needle))),
  )
  const filterSelect = (key: 'stockClass' | 'karatCode' | 'groupId' | 'itemNameId', label: string, allText: string, opts: [string, string][], reset: Partial<typeof f> = {}) => (
    <Select value={f[key] || 'all'} onValueChange={(v) => setF({ ...f, ...reset, [key]: v === 'all' ? '' : v })}>
      <SelectTrigger className="w-40" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{allText}</SelectItem>
        {opts.map(([v, text]) => (
          <SelectItem key={v} value={v}>{text}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )

  // Summary numbers derived from the stock already fetched (no extra requests).
  const sumNet = (rows: StockItemDto[]) => rows.reduce((sum, i) => sum + Number(i.net), 0)
  const grams = (n: number) => `${n.toFixed(3)} g`

  const tile = (label: string, value: string, sub: string | undefined, Icon: LucideIcon) => (
    <Card className="gap-2 hover:-translate-y-1">
      <CardHeader className="flex flex-row items-center justify-between pb-1">
        <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</CardTitle>
        <span className="icon-chip"><Icon className="size-5" aria-hidden /></span>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-extrabold tracking-tight tabular-nums">{value}</div>
        {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h2 className="text-xl">{t('inv.tags.title')}</h2>
          <p className="text-sm text-muted-foreground">{t('inv.tags.intro')}</p>
        </div>
        <Button disabled={selected.length === 0} onClick={print}>
          {selected.length ? t(selected.length === 1 ? 'inv.tags.print_one' : 'inv.tags.print_other', { n: selected.length }) : t('inv.tags.print_none')}
        </Button>
      </div>

      <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4 print:hidden">
        {tile(t('inv.tags.tagged'), data ? String(items.length) : '—', t('inv.tags.tagged_sub'), Tags)}
        {tile(t('inv.tags.tagged_net'), data ? grams(sumNet(items)) : '—', t('inv.tags.tagged_net_sub'), Scale)}
        {tile(t('inv.tags.picked'), String(selected.length), data ? t('inv.tags.picked_sub', { n: items.length }) : undefined, ListChecks)}
        {tile(t('inv.tags.picked_net'), grams(sumNet(selected)), t('inv.tags.picked_net_sub'), Weight)}
      </div>

      <Card className="print:hidden">
        <CardContent className="flex flex-wrap items-end gap-3 pt-6">
          <Input className="max-w-xs" placeholder={t('inv.f.search_tag_huid')} aria-label="Search tags" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
          {filterSelect('stockClass', 'Stock class', t('stock.all_classes'), classOpts, { groupId: '', itemNameId: '' })}
          {filterSelect('karatCode', 'Purity', t('inv.f.any_purity'), karatOpts)}
          {filterSelect('groupId', 'Item group', t('inv.f.all_groups'), groupOpts, { itemNameId: '' })}
          {filterSelect('itemNameId', 'Item', t('inv.f.all_items'), nameOpts)}
        </CardContent>
      </Card>

      <Card className="print:hidden">
        <CardHeader className="flex flex-row flex-wrap items-center gap-3 space-y-0">
          <Checkbox
            aria-label="Select all"
            checked={visible.length > 0 && visible.every((i) => picked.has(i.id))}
            onCheckedChange={(v) => setPicked((s) => { const n = new Set(s); for (const i of visible) { if (v) n.add(i.id); else n.delete(i.id) } return n })}
          />
          <span className="text-sm">{t('inv.tags.select_all_n', { n: visible.length })}</span>
        </CardHeader>
        <CardContent>
          <div className="stagger grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((it) => (
              <label key={it.id} className="flex cursor-pointer items-center gap-2 rounded-xl border bg-card p-3 text-sm transition-colors hover:bg-muted">
                <Checkbox aria-label={`Select ${it.tagNo}`} checked={picked.has(it.id)} onCheckedChange={() => toggle(it.id)} />
                <span className="font-medium">{it.tagNo}</span>
                <span className="text-muted-foreground">{it.itemName.name} · {it.net}g</span>
              </label>
            ))}
            {visible.length === 0 && (
              <div className="col-span-full flex flex-col items-center gap-3 py-10 text-center">
                <span className="icon-chip"><BarcodeIcon className="size-5" aria-hidden /></span>
                <p className="text-sm text-muted-foreground">{items.length === 0 ? t('inv.tags.none') : t('inv.tags.none_match')}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Printable label sheet: saved printer settings set the grid; an active template for the item's class replaces the fixed layout. */}
      {printing && <style>{pageCss(printer)}</style>}
      <div
        className="print-area grid"
        style={{ gridTemplateColumns: `repeat(${printer.columns}, max-content)`, gap: `${printer.gapMm}mm`, padding: `${printer.marginMm}mm` }}
      >
        {selected.map((it) => {
          const tpl = templateFor(it.stockClass)
          return tpl ? (
            <TagLabel key={it.id} template={tpl} item={it} shopName={me?.business?.name ?? ''} />
          ) : (
            <div key={it.id} className="overflow-hidden rounded border p-1 text-center text-xs" style={{ width: `${printer.labelWidthMm}mm`, height: `${printer.labelHeightMm}mm` }}>
              <div className="font-medium">{it.itemName.name}</div>
              <div className="text-muted-foreground">{it.net}g · {it.karatCode ?? ''}</div>
              <Barcode value={it.tagNo as string} />
            </div>
          )
        })}
      </div>
    </div>
  )
}
