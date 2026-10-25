import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useKarats } from '@/lib/appQueries'
import { useCreateStockEntry, useItemNames } from '@/lib/inventoryQueries'
import { plural } from '@/lib/plural'
import { CHARGE_UNITS, STOCK_CLASSES, computeLine } from '@/shared'

const CLASS_LABEL: Record<string, string> = { GOLD: 'Gold', SILVER: 'Silver', STONE: 'Stone', ARTIFICIAL: 'Artificial', FRANCHISE: 'Franchise' }

interface Row {
  itemNameId: string
  tagNo: string
  karatCode: string
  pcs: string
  gross: string
  less: string
  tunch: string
  wastage: string
  stoneCharge: string
  other: string
  labour: string
  labourUnit: string
  rate: string
  purchaseCost: string
  remarks: string
}
const blank = (): Row => ({ itemNameId: '', tagNo: '', karatCode: '', pcs: '1', gross: '', less: '0', tunch: '', wastage: '0', stoneCharge: '0', other: '0', labour: '0', labourUnit: 'PER_GRAM', rate: '', purchaseCost: '', remarks: '' })

export function NewStock() {
  const [stockClass, setStockClass] = useState('GOLD')
  const [method, setMethod] = useState('LOOSE')
  const [rows, setRows] = useState<Row[]>([blank()])
  const { data: names } = useItemNames({ stockClass, page: 1 })
  const { data: karats } = useKarats()
  const create = useCreateStockEntry()

  const set = (i: number, k: keyof Row, v: string) =>
    setRows((rs) =>
      rs.map((r, j) => {
        if (j !== i) return r
        const next = { ...r, [k]: v }
        // picking a karat defaults tunch to its touch when empty
        if (k === 'karatCode' && !r.tunch) next.tunch = karats?.find((kt) => kt.code === v)?.touch ?? ''
        return next
      }),
    )

  const valid = rows.every((r) => r.itemNameId && Number(r.gross) > 0)

  const submit = async () => {
    await create.mutateAsync({
      stockClass,
      method,
      rows: rows.map((r) => ({
        itemNameId: Number(r.itemNameId),
        tagNo: method === 'TAG' && r.tagNo ? r.tagNo : undefined,
        karatCode: r.karatCode || undefined,
        pcs: Number(r.pcs) || 1,
        gross: Number(r.gross),
        less: Number(r.less) || 0,
        tunch: r.tunch ? Number(r.tunch) : undefined,
        wastage: Number(r.wastage) || 0,
        stoneCharge: Number(r.stoneCharge) || 0,
        other: Number(r.other) || 0,
        labour: Number(r.labour) || 0,
        labourUnit: r.labourUnit,
        rate: r.rate ? Number(r.rate) : undefined,
        purchaseCost: r.purchaseCost ? Number(r.purchaseCost) : undefined,
        remarks: r.remarks || undefined,
      })),
    })
    setRows([blank()])
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1.5">
          <Label>Stock class</Label>
          <Select value={stockClass} onValueChange={(v) => { setStockClass(v); setRows([blank()]) }}>
            <SelectTrigger className="w-40" aria-label="Stock class">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STOCK_CLASSES.map((c) => (
                <SelectItem key={c} value={c}>
                  {CLASS_LABEL[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Entry method</Label>
          <Select value={method} onValueChange={setMethod}>
            <SelectTrigger className="w-40" aria-label="Entry method">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="LOOSE">Loose</SelectItem>
              <SelectItem value="TAG">Tag</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-40">Item</TableHead>
              {method === 'TAG' && <TableHead>Tag</TableHead>}
              <TableHead>Karat</TableHead>
              <TableHead>Pcs</TableHead>
              <TableHead>Gross</TableHead>
              <TableHead>Less</TableHead>
              <TableHead>Tunch</TableHead>
              <TableHead>Wst%</TableHead>
              <TableHead>Net</TableHead>
              <TableHead>Fine</TableHead>
              <TableHead>Stone</TableHead>
              <TableHead>Other</TableHead>
              <TableHead>Labour</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead>Rate</TableHead>
              <TableHead>Cost</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, i) => {
              const { net, fine } = computeLine({ gross: Number(r.gross) || 0, less: Number(r.less) || 0, tunch: Number(r.tunch) || 0, wastage: Number(r.wastage) || 0 })
              return (
                <TableRow key={i}>
                  <TableCell>
                    <Select value={r.itemNameId} onValueChange={(v) => set(i, 'itemNameId', v)}>
                      <SelectTrigger aria-label="Item name">
                        <SelectValue placeholder="Item" />
                      </SelectTrigger>
                      <SelectContent>
                        {names?.items.map((n) => (
                          <SelectItem key={n.id} value={String(n.id)}>
                            {n.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  {method === 'TAG' && (
                    <TableCell>
                      <Input className="w-24" placeholder="auto" value={r.tagNo} onChange={(e) => set(i, 'tagNo', e.target.value.toUpperCase())} />
                    </TableCell>
                  )}
                  <TableCell>
                    <Select value={r.karatCode} onValueChange={(v) => set(i, 'karatCode', v)}>
                      <SelectTrigger className="w-24" aria-label="Karat">
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        {karats?.map((k) => (
                          <SelectItem key={k.id} value={k.code}>
                            {k.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell><Input className="w-16" type="number" value={r.pcs} onChange={(e) => set(i, 'pcs', e.target.value)} /></TableCell>
                  <TableCell><Input className="w-24" type="number" step="0.001" value={r.gross} onChange={(e) => set(i, 'gross', e.target.value)} /></TableCell>
                  <TableCell><Input className="w-20" type="number" step="0.001" value={r.less} onChange={(e) => set(i, 'less', e.target.value)} /></TableCell>
                  <TableCell><Input className="w-20" type="number" step="0.01" value={r.tunch} onChange={(e) => set(i, 'tunch', e.target.value)} /></TableCell>
                  <TableCell><Input className="w-16" type="number" step="0.01" value={r.wastage} onChange={(e) => set(i, 'wastage', e.target.value)} /></TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{net}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{fine}</TableCell>
                  <TableCell><Input className="w-20" type="number" aria-label="Stone charge" value={r.stoneCharge} onChange={(e) => set(i, 'stoneCharge', e.target.value)} /></TableCell>
                  <TableCell><Input className="w-20" type="number" aria-label="Other charge" value={r.other} onChange={(e) => set(i, 'other', e.target.value)} /></TableCell>
                  <TableCell><Input className="w-20" type="number" value={r.labour} onChange={(e) => set(i, 'labour', e.target.value)} /></TableCell>
                  <TableCell>
                    <Select value={r.labourUnit} onValueChange={(v) => set(i, 'labourUnit', v)}>
                      <SelectTrigger className="w-28" aria-label="Labour unit">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CHARGE_UNITS.map((u) => (
                          <SelectItem key={u} value={u}>
                            {u}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell><Input className="w-24" type="number" value={r.rate} onChange={(e) => set(i, 'rate', e.target.value)} /></TableCell>
                  <TableCell><Input className="w-24" type="number" value={r.purchaseCost} onChange={(e) => set(i, 'purchaseCost', e.target.value)} /></TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Button variant="ghost" size="sm" aria-label="Duplicate row" onClick={() => setRows((rs) => [...rs.slice(0, i + 1), { ...r }, ...rs.slice(i + 1)])} title="Duplicate (same)">⧉</Button>
                    <Button variant="ghost" size="sm" aria-label="Remove row" disabled={rows.length === 1} onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))} title="Remove">✕</Button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center gap-3">
        <Button variant="outline" onClick={() => setRows((rs) => [...rs, blank()])}>
          + Add row
        </Button>
        <Button className="ml-auto" disabled={!valid || create.isPending} onClick={submit}>
          {create.isPending ? 'Saving…' : `Save ${plural(rows.length, 'item')}`}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Net/Fine shown live; the server recomputes authoritatively on save.</p>
    </div>
  )
}
