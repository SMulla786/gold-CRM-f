import type { ColumnDef } from '@tanstack/react-table'
import { AlertTriangle, Boxes, Minus, PackageX, Plus } from 'lucide-react'
import { useState } from 'react'

import { DataTable } from '@/components/DataTable'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/lib/auth'
import { useAdjustConsumable, useConsumables, useSaveConsumable } from '@/lib/repairQueries'
import type { RepairConsumableDto } from '@/shared'

import { RepairTabs } from './RepairTabs'
import { n } from './repairUtils'

const STATUS_LABEL: Record<RepairConsumableDto['status'], string> = { OK: 'OK', LOW: 'Low', OUT: 'Out' }
const statusVariant = (s: RepairConsumableDto['status']) => (s === 'OUT' ? 'destructive' : s === 'LOW' ? 'secondary' : 'outline')
const qty = (s: string) => String(n(s)) // 5.000 → 5
// Bar = stock against twice the minimum level (min sits at the middle); full when no minimum is set and stock exists.
const barPct = (c: RepairConsumableDto) => (n(c.minLevel) > 0 ? Math.min(100, (n(c.currentStock) / (2 * n(c.minLevel))) * 100) : n(c.currentStock) > 0 ? 100 : 0)
const barColor = (s: RepairConsumableDto['status']) => (s === 'OUT' ? 'bg-destructive' : s === 'LOW' ? 'bg-destructive/60' : 'bg-gradient-to-r from-brand-strong to-brand')

export function RepairConsumables() {
  const { can } = useAuth()
  const canEdit = can('repair.entry', 'edit')
  const { data, isLoading } = useConsumables()
  const adjust = useAdjustConsumable()
  const [editing, setEditing] = useState<RepairConsumableDto | 'new' | null>(null)
  const rows = data ?? []
  const low = rows.filter((c) => c.isActive && c.status === 'LOW').length
  const out = rows.filter((c) => c.isActive && c.status === 'OUT').length

  const columns: ColumnDef<RepairConsumableDto, unknown>[] = [
    { header: 'Item', cell: ({ row }) => <div><div className="font-medium">{row.original.name}</div>{!row.original.isActive && <div className="text-xs text-muted-foreground">Inactive</div>}</div> },
    { header: 'Category', cell: ({ row }) => row.original.category ?? '—' },
    { header: 'Current stock', cell: ({ row }) => <span className="tabular-nums">{qty(row.original.currentStock)} {row.original.unit}</span> },
    { header: 'Minimum level', cell: ({ row }) => <span className="tabular-nums">{qty(row.original.minLevel)} {row.original.unit}</span> },
    {
      id: 'bar', header: 'Stock level',
      cell: ({ row }) => (
        <div className="h-2 w-28 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${row.original.name} stock level ${Math.round(barPct(row.original))}%`}>
          <div className={`bar-grow h-2 rounded-full ${barColor(row.original.status)}`} style={{ width: `${barPct(row.original)}%` }} />
        </div>
      ),
    },
    { header: 'Status', cell: ({ row }) => <Badge variant={statusVariant(row.original.status)}>{STATUS_LABEL[row.original.status]}</Badge> },
    {
      id: 'actions', header: 'Quick action',
      cell: ({ row }) => {
        const c = row.original
        return canEdit ? (
          <div className="flex items-center gap-1">
            <Button size="icon" variant="outline" className="size-7" aria-label={`Take one ${c.name}`} disabled={adjust.isPending || n(c.currentStock) < 1} onClick={() => adjust.mutate({ id: c.id, delta: -1, reason: 'Used' })}><Minus className="size-4" aria-hidden /></Button>
            <Button size="icon" variant="outline" className="size-7" aria-label={`Add one ${c.name}`} disabled={adjust.isPending} onClick={() => adjust.mutate({ id: c.id, delta: 1, reason: 'Added' })}><Plus className="size-4" aria-hidden /></Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(c)}>Edit</Button>
          </div>
        ) : null
      },
    },
  ]

  const tile = (label: string, value: number, Icon: typeof Boxes) => (
    <Card className="gap-2">
      <CardHeader className="flex flex-row items-center justify-between pb-1">
        <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</CardTitle>
        <span className="icon-chip"><Icon className="size-5" aria-hidden /></span>
      </CardHeader>
      <CardContent><div className="text-3xl font-extrabold tracking-tight tabular-nums">{data ? value : '—'}</div></CardContent>
    </Card>
  )

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1>Repair consumables</h1>
          <p className="mt-1 text-sm text-muted-foreground">Solder, wire, polish and other workshop supplies for this branch. Use + and − to record what comes in and goes out.</p>
        </div>
        {canEdit && <Button onClick={() => setEditing('new')}>Add item</Button>}
      </header>

      <RepairTabs />

      <div className="stagger grid gap-4 sm:grid-cols-3">
        {tile('Items', rows.filter((c) => c.isActive).length, Boxes)}
        {tile('Low stock', low, AlertTriangle)}
        {tile('Out of stock', out, PackageX)}
      </div>

      <DataTable columns={columns} data={rows} isLoading={isLoading} emptyText="No consumables yet. Add the supplies you want to keep track of." />

      {editing && <ConsumableDialog item={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function ConsumableDialog({ item, onClose }: { item: RepairConsumableDto | null; onClose: () => void }) {
  const save = useSaveConsumable()
  const [f, setF] = useState({ name: item?.name ?? '', category: item?.category ?? '', unit: item?.unit ?? 'pcs', currentStock: item ? qty(item.currentStock) : '0', minLevel: item ? qty(item.minLevel) : '0', isActive: item?.isActive ?? true })
  const set = (k: 'name' | 'category' | 'unit' | 'currentStock' | 'minLevel', v: string) => setF((s) => ({ ...s, [k]: v }))
  const ok = f.name.trim() && f.unit.trim() && n(f.currentStock) >= 0 && n(f.minLevel) >= 0
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{item ? `Edit ${item.name}` : 'Add consumable'}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 space-y-1.5"><Label htmlFor="rc-name">Item name</Label><Input id="rc-name" maxLength={60} value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Solder wire" /></div>
          <div className="space-y-1.5"><Label htmlFor="rc-cat">Category</Label><Input id="rc-cat" maxLength={40} value={f.category} onChange={(e) => set('category', e.target.value)} placeholder="optional" /></div>
          <div className="space-y-1.5"><Label htmlFor="rc-unit">Unit</Label><Input id="rc-unit" maxLength={10} value={f.unit} onChange={(e) => set('unit', e.target.value)} placeholder="pcs / g / ml" /></div>
          <div className="space-y-1.5"><Label htmlFor="rc-stock">Current stock</Label><Input id="rc-stock" type="number" min={0} step="0.001" value={f.currentStock} onChange={(e) => set('currentStock', e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="rc-min">Minimum level</Label><Input id="rc-min" type="number" min={0} step="0.001" value={f.minLevel} onChange={(e) => set('minLevel', e.target.value)} /></div>
          {item && (
            <label className="col-span-2 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={f.isActive} onChange={(e) => setF((s) => ({ ...s, isActive: e.target.checked }))} />
              Active (untick to hide it from the counts)
            </label>
          )}
        </div>
        <DialogFooter>
          <Button disabled={!ok || save.isPending} onClick={async () => {
            await save.mutateAsync({ id: item?.id, body: { name: f.name.trim(), category: f.category.trim() || (item ? null : undefined), unit: f.unit.trim(), currentStock: n(f.currentStock), minLevel: n(f.minLevel), ...(item ? { isActive: f.isActive } : {}) } })
            onClose()
          }}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
