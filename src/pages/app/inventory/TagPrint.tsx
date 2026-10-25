import JsBarcode from 'jsbarcode'
import { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { useAllStock } from '@/lib/inventoryQueries'
import { plural } from '@/lib/plural'
import type { StockItemDto } from '@/shared'

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
  const [picked, setPicked] = useState<Set<number>>(new Set())
  const toggle = (id: number) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const selected: StockItemDto[] = items.filter((i) => picked.has(i.id))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <Checkbox aria-label="Select all" checked={items.length > 0 && picked.size === items.length} onCheckedChange={(v) => setPicked(v ? new Set(items.map((i) => i.id)) : new Set())} />
        <span className="text-sm">Select all ({items.length})</span>
        <Button className="ml-auto" disabled={selected.length === 0} onClick={() => window.print()}>
          Print {selected.length ? plural(selected.length, 'label') : 'labels'}
        </Button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 print:hidden">
        {items.map((it) => (
          <label key={it.id} className="flex items-center gap-2 rounded-md border p-2 text-sm">
            <Checkbox aria-label={`Select ${it.tagNo}`} checked={picked.has(it.id)} onCheckedChange={() => toggle(it.id)} />
            <span className="font-medium">{it.tagNo}</span>
            <span className="text-muted-foreground">{it.itemName.name} · {it.net}g</span>
          </label>
        ))}
        {items.length === 0 && <p className="text-sm text-muted-foreground">No tagged items available.</p>}
      </div>

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
