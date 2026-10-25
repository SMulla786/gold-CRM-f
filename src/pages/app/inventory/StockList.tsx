import type { ColumnDef } from '@tanstack/react-table'
import { useState } from 'react'

import { DataTable } from '@/components/DataTable'
import { MpinDialog } from '@/components/MpinDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useBulkDeleteStock, useBulkEditStock, useDeleteStock, useStock, useUpdateStock } from '@/lib/inventoryQueries'
import { useAuth } from '@/lib/auth'
import { CHARGE_UNITS, STOCK_CLASSES, STOCK_STATUSES, type StockItemDto } from '@/shared'

const CLASS_LABEL: Record<string, string> = { GOLD: 'Gold', SILVER: 'Silver', STONE: 'Stone', ARTIFICIAL: 'Artificial', FRANCHISE: 'Franchise' }

// Editable numeric/charge fields shared by single + bulk edit (empty = unchanged in bulk).
const NUM_FIELDS = ['pcs', 'gross', 'less', 'tunch', 'wastage', 'stoneCharge', 'other', 'labour', 'rate', 'purchaseCost'] as const
type NumField = (typeof NUM_FIELDS)[number]
const LABELS: Record<NumField, string> = { pcs: 'Pcs', gross: 'Gross', less: 'Less', tunch: 'Tunch', wastage: 'Wastage %', stoneCharge: 'Stone', other: 'Other', labour: 'Labour', rate: 'Rate', purchaseCost: 'Cost' }

function toBody(form: Record<string, string>, labourUnit: string) {
  const body: Record<string, unknown> = {}
  for (const f of NUM_FIELDS) if (form[f] !== '' && form[f] != null) body[f] = Number(form[f])
  if (labourUnit) body.labourUnit = labourUnit
  if (form.remarks) body.remarks = form.remarks
  return body
}

function StockEditDialog({ item, onClose }: { item: StockItemDto; onClose: () => void }) {
  const update = useUpdateStock()
  const [form, setForm] = useState<Record<string, string>>({
    pcs: String(item.pcs), gross: item.gross, less: item.less, tunch: item.tunch, wastage: item.wastage,
    stoneCharge: item.stoneCharge, other: item.other, labour: item.labour, rate: item.rate ?? '', purchaseCost: item.purchaseCost ?? '', remarks: item.remarks ?? '',
  })
  const [labourUnit, setLabourUnit] = useState<string>(item.labourUnit)
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit {item.tagNo ?? item.itemName.name}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-3">
          {NUM_FIELDS.map((f) => (
            <div key={f} className="space-y-1.5">
              <Label htmlFor={`e-${f}`}>{LABELS[f]}</Label>
              <Input id={`e-${f}`} type="number" value={form[f]} onChange={(e) => setForm({ ...form, [f]: e.target.value })} />
            </div>
          ))}
          <div className="space-y-1.5">
            <Label>Labour unit</Label>
            <Select value={labourUnit} onValueChange={setLabourUnit}>
              <SelectTrigger aria-label="Labour unit">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CHARGE_UNITS.map((u) => (
                  <SelectItem key={u} value={u}>{u}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button disabled={update.isPending} onClick={async () => { await update.mutateAsync({ id: item.id, body: toBody(form, labourUnit) }); onClose() }}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function BulkEditDialog({ ids, onClose }: { ids: number[]; onClose: () => void }) {
  const bulk = useBulkEditStock()
  const [form, setForm] = useState<Record<string, string>>({})
  const [labourUnit, setLabourUnit] = useState('')
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit {ids.length} items</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">Only the fields you fill are applied to every selected item.</p>
        <div className="grid grid-cols-3 gap-3">
          {(['rate', 'labour', 'wastage', 'stoneCharge', 'other'] as NumField[]).map((f) => (
            <div key={f} className="space-y-1.5">
              <Label htmlFor={`b-${f}`}>{LABELS[f]}</Label>
              <Input id={`b-${f}`} type="number" value={form[f] ?? ''} onChange={(e) => setForm({ ...form, [f]: e.target.value })} />
            </div>
          ))}
          <div className="space-y-1.5">
            <Label>Labour unit</Label>
            <Select value={labourUnit || 'keep'} onValueChange={(v) => setLabourUnit(v === 'keep' ? '' : v)}>
              <SelectTrigger aria-label="Labour unit">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="keep">Keep</SelectItem>
                {CHARGE_UNITS.map((u) => (
                  <SelectItem key={u} value={u}>{u}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button disabled={bulk.isPending} onClick={async () => { await bulk.mutateAsync({ ids, patch: toBody(form, labourUnit) }); onClose() }}>
            Apply to {ids.length}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function StockList() {
  const { can } = useAuth()
  const canEdit = can('inventory.all_stock', 'edit')
  const canDelete = can('inventory.all_stock', 'delete')
  const [page, setPage] = useState(1)
  const [stockClass, setStockClass] = useState('')
  const [status, setStatus] = useState('AVAILABLE')
  const [q, setQ] = useState('')
  const { data, isLoading } = useStock({ page, status, stockClass: stockClass || undefined, q: q || undefined })
  const del = useDeleteStock()
  const bulkDelete = useBulkDeleteStock()
  const [deleting, setDeleting] = useState<StockItemDto | null>(null)
  const [editing, setEditing] = useState<StockItemDto | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [bulkEditing, setBulkEditing] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)

  const rows = data?.items ?? []
  const selectableIds = rows.filter((r) => r.status === 'AVAILABLE').map((r) => r.id)
  const toggle = (id: number) =>
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  const ids = [...selected]

  const columns: ColumnDef<StockItemDto, unknown>[] = [
    ...(canEdit || canDelete
      ? [{
          id: 'select',
          header: () => (
            <Checkbox
              aria-label="Select all"
              checked={selectableIds.length > 0 && selectableIds.every((id) => selected.has(id))}
              onCheckedChange={(v) => setSelected(v ? new Set(selectableIds) : new Set())}
            />
          ),
          cell: ({ row }: { row: { original: StockItemDto } }) =>
            row.original.status === 'AVAILABLE' ? (
              <Checkbox aria-label={`Select ${row.original.tagNo ?? row.original.id}`} checked={selected.has(row.original.id)} onCheckedChange={() => toggle(row.original.id)} />
            ) : null,
        } as ColumnDef<StockItemDto, unknown>]
      : []),
    { header: 'Tag / Item', cell: ({ row }) => <span className="font-medium">{row.original.tagNo ?? row.original.itemName.name}</span> },
    { header: 'Group', cell: ({ row }) => row.original.group.name },
    { accessorKey: 'karatCode', header: 'Karat', cell: ({ row }) => row.original.karatCode ?? '—' },
    { accessorKey: 'pcs', header: 'Pcs' },
    { accessorKey: 'gross', header: 'Gross' },
    { accessorKey: 'net', header: 'Net' },
    { accessorKey: 'fine', header: 'Fine' },
    { header: 'Branch', cell: ({ row }) => row.original.branch.name },
    { accessorKey: 'status', header: 'Status', cell: ({ row }) => <Badge variant={row.original.status === 'AVAILABLE' ? 'default' : 'secondary'}>{row.original.status}</Badge> },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) =>
        row.original.status === 'AVAILABLE' ? (
          <div className="flex gap-2">
            {canEdit && <Button variant="outline" size="sm" onClick={() => setEditing(row.original)}>Edit</Button>}
            {canDelete && <Button variant="ghost" size="sm" onClick={() => setDeleting(row.original)}>Delete</Button>}
          </div>
        ) : null,
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input className="max-w-xs" placeholder="Search tag / item…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} />
        <Select value={stockClass || 'all'} onValueChange={(v) => { setStockClass(v === 'all' ? '' : v); setPage(1) }}>
          <SelectTrigger className="w-36" aria-label="Stock class">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All classes</SelectItem>
            {STOCK_CLASSES.map((c) => (
              <SelectItem key={c} value={c}>{CLASS_LABEL[c]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1) }}>
          <SelectTrigger className="w-36" aria-label="Status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STOCK_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {ids.length > 0 && (
        <div className="flex items-center gap-3 rounded-md border bg-muted/40 px-3 py-2 text-sm">
          <span>{ids.length} selected</span>
          {canEdit && <Button size="sm" variant="outline" onClick={() => setBulkEditing(true)}>Edit selected</Button>}
          {canDelete && <Button size="sm" variant="ghost" onClick={() => setBulkDeleting(true)}>Delete selected</Button>}
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
        </div>
      )}

      <DataTable
        columns={columns}
        data={rows}
        isLoading={isLoading}
        emptyText="No stock items"
        pagination={data ? { page: data.page, pageSize: data.pageSize, total: data.total, onPage: setPage } : undefined}
      />

      {editing && <StockEditDialog item={editing} onClose={() => setEditing(null)} />}
      {bulkEditing && <BulkEditDialog ids={ids} onClose={() => { setBulkEditing(false); setSelected(new Set()) }} />}
      <MpinDialog open={!!deleting} title={`Delete ${deleting?.tagNo ?? deleting?.itemName.name ?? ''}`} onConfirm={(mpin) => del.mutateAsync({ id: deleting!.id, mpin })} onClose={() => setDeleting(null)} />
      <MpinDialog open={bulkDeleting} title={`Delete ${ids.length} items`} onConfirm={async (mpin) => { await bulkDelete.mutateAsync({ ids, mpin }); setSelected(new Set()) }} onClose={() => setBulkDeleting(false)} />
    </div>
  )
}
