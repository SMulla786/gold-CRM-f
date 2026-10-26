import JsBarcode from 'jsbarcode'
import { Barcode as BarcodeIcon, ListChecks, Scale, Tags, Weight, type LucideIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAllStock } from '@/lib/inventoryQueries'
import { plural } from '@/lib/plural'
import type { StockItemDto } from '@/shared'

const CLASS_LABEL: Record<string, string> = { GOLD: 'Gold', SILVER: 'Silver', STONE: 'Stone', ARTIFICIAL: 'Artificial', FRANCHISE: 'Franchise' }

function Barcode({ value }: { value: string }) {
  const ref = useRef<SVGSVGElement>(null)
  useEffect(() => {
    if (ref.current) JsBarcode(ref.current, value, { format: 'CODE128', width: 1.4, height: 34, fontSize: 11, margin: 2 })
  }, [value])
  return <svg ref={ref} />
}

export function TagPrint() {
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
  const classOpts = uniq(items.map((i) => [i.stockClass, CLASS_LABEL[i.stockClass] ?? i.stockClass]))
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
          <h2 className="text-xl">Barcode tags</h2>
          <p className="text-sm text-muted-foreground">Pick tagged pieces and print a barcode sheet for them.</p>
        </div>
        <Button disabled={selected.length === 0} onClick={() => window.print()}>
          Print {selected.length ? plural(selected.length, 'label') : 'labels'}
        </Button>
      </div>

      <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4 print:hidden">
        {tile('Tagged in stock', data ? String(items.length) : '—', 'Available pieces with a tag no.', Tags)}
        {tile('Tagged net weight', data ? grams(sumNet(items)) : '—', 'Across all tagged pieces', Scale)}
        {tile('Picked', String(selected.length), data ? `of ${items.length} tagged` : undefined, ListChecks)}
        {tile('Picked net weight', grams(sumNet(selected)), 'Going on the sheet', Weight)}
      </div>

      <Card className="print:hidden">
        <CardContent className="flex flex-wrap items-end gap-3 pt-6">
          <Input className="max-w-xs" placeholder="Search tag / HUID / item…" aria-label="Search tags" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
          {filterSelect('stockClass', 'Stock class', 'All classes', classOpts, { groupId: '', itemNameId: '' })}
          {filterSelect('karatCode', 'Purity', 'Any purity', karatOpts)}
          {filterSelect('groupId', 'Item group', 'All groups', groupOpts, { itemNameId: '' })}
          {filterSelect('itemNameId', 'Item', 'All items', nameOpts)}
        </CardContent>
      </Card>

      <Card className="print:hidden">
        <CardHeader className="flex flex-row flex-wrap items-center gap-3 space-y-0">
          <Checkbox
            aria-label="Select all"
            checked={visible.length > 0 && visible.every((i) => picked.has(i.id))}
            onCheckedChange={(v) => setPicked((s) => { const n = new Set(s); for (const i of visible) { if (v) n.add(i.id); else n.delete(i.id) } return n })}
          />
          <span className="text-sm">Select all ({visible.length})</span>
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
                <p className="text-sm text-muted-foreground">{items.length === 0 ? 'No tagged items available.' : 'No tagged items match these filters.'}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Printable label sheet */}
      <div className="print-area grid grid-cols-3 gap-2">
        {selected.map((it) => (
          <div key={it.id} className="rounded border p-2 text-center text-xs">
            <div className="font-medium">{it.itemName.name}</div>
            <div className="text-muted-foreground">{it.net}g · {it.karatCode ?? ''}</div>
            <Barcode value={it.tagNo as string} />
          </div>
        ))}
      </div>
    </div>
  )
}
