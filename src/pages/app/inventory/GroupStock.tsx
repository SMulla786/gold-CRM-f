import type { ColumnDef } from '@tanstack/react-table'
import { Boxes, IndianRupee, Layers, Scale, type LucideIcon } from 'lucide-react'
import { useState } from 'react'

import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { DataTable } from '@/components/DataTable'
import { MpinDialog } from '@/components/MpinDialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useKarats } from '@/lib/appQueries'
import { useAuth } from '@/lib/auth'
import { fetchAllStock, useBulkDeleteStock, useGroupStock } from '@/lib/inventoryQueries'
import { downloadCsv } from '@/lib/csv'
import { plural } from '@/lib/plural'
import { useT } from '@/lib/i18n'
import { BulkEditDialog } from '@/pages/app/inventory/StockList'
import { STOCK_CLASSES, STOCK_STATUSES, type GroupStockDto } from '@/shared'

const CLASS_LABEL: Record<string, string> = { GOLD: 'Gold', SILVER: 'Silver', STONE: 'Stone', ARTIFICIAL: 'Artificial', FRANCHISE: 'Franchise' }
const inr = (s: string) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(s))
/** A group row is one (group, karat) pair from the backend groupBy. */
const rowKey = (g: { groupId: number; karatCode: string | null }) => `${g.groupId}|${g.karatCode ?? ''}`
/** bulkStockEditBody / bulkStockDeleteBody accept at most 500 ids. */
const BULK_MAX = 500

type BulkAction = 'edit' | 'delete' | 'tags'

export function GroupStock() {
  const t = useT()
  const { can } = useAuth()
  const navigate = useNavigate()
  const canEdit = can('inventory.all_stock', 'edit')
  const canDelete = can('inventory.all_stock', 'delete')
  const canTags = can('inventory.tag_print', 'view')
  const [stockClass, setStockClass] = useState('')
  const [status, setStatus] = useState('AVAILABLE')
  const [method, setMethod] = useState('')
  const [karatCode, setKaratCode] = useState('')
  const [q, setQ] = useState('')
  const { data: karats } = useKarats()
  const karatCodes = [...new Set((karats ?? []).map((k) => k.code))]
  const filters = { stockClass: stockClass || undefined, status, method: method || undefined, karatCode: karatCode || undefined, q: q || undefined }
  const { data, isLoading } = useGroupStock(filters)

  // Selection (by group+karat row). Only AVAILABLE stock can be bulk-edited/deleted/tagged, as in StockList.
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [resolving, setResolving] = useState<BulkAction | null>(null)
  const [bulkIds, setBulkIds] = useState<number[]>([])
  const [bulkEditing, setBulkEditing] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const bulkDelete = useBulkDeleteStock()
  const selectable = status === 'AVAILABLE' && (canEdit || canDelete || canTags)
  const clearSelection = () => { setSelected(new Set()); setBulkIds([]) }
  const changeFilter = <T,>(setter: (v: T) => void) => (v: T) => { setter(v); setSelected(new Set()) }

  /** Group rows carry no item ids: load the items of the selected groups through the normal stock list query. */
  const resolveIds = async (): Promise<number[]> => {
    const groupIds = [...new Set([...selected].map((k) => Number(k.split('|')[0])))]
    const ids: number[] = []
    for (const groupId of groupIds) {
      const items = await fetchAllStock({ ...filters, status: 'AVAILABLE', groupId })
      for (const i of items) if (selected.has(rowKey({ groupId, karatCode: i.karatCode }))) ids.push(i.id)
    }
    return ids
  }
  const runBulk = async (action: BulkAction) => {
    setResolving(action)
    try {
      const ids = await resolveIds()
      if (ids.length === 0) return void toast.error('No available items in the selected groups')
      if (action === 'tags') return navigate('/app/inventory/tags', { state: { ids } })
      if (ids.length > BULK_MAX) return void toast.error(`Too many items (${ids.length}); select groups with at most ${BULK_MAX} items in total`)
      setBulkIds(ids)
      if (action === 'edit') setBulkEditing(true)
      else setBulkDeleting(true)
    } catch {
      toast.error('Could not load the items of the selected groups')
    } finally {
      setResolving(null)
    }
  }

  const rows = data ?? []
  const keys = rows.map(rowKey)
  const toggle = (k: string) =>
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(k)) n.delete(k)
      else n.add(k)
      return n
    })
  const selectedRows = rows.filter((g) => selected.has(rowKey(g)))
  const selectedItems = selectedRows.reduce((sum, g) => sum + g.items, 0)

  const columns: ColumnDef<GroupStockDto, unknown>[] = [
    ...(selectable
      ? [{
          id: 'select',
          header: () => (
            <Checkbox
              aria-label="Select all groups"
              checked={keys.length > 0 && keys.every((k) => selected.has(k))}
              onCheckedChange={(v) => setSelected(v ? new Set(keys) : new Set())}
            />
          ),
          cell: ({ row }: { row: { original: GroupStockDto } }) => (
            <Checkbox
              aria-label={`Select group ${row.original.groupName}${row.original.karatCode ? ` ${row.original.karatCode}` : ''}`}
              checked={selected.has(rowKey(row.original))}
              onCheckedChange={() => toggle(rowKey(row.original))}
            />
          ),
        } as ColumnDef<GroupStockDto, unknown>]
      : []),
    { accessorKey: 'groupName', header: 'Group' },
    { id: 'hsn', header: 'HSN', cell: ({ row }) => row.original.hsnCode ?? '—' },
    { accessorKey: 'karatCode', header: 'Karat', cell: ({ row }) => row.original.karatCode ?? '—' },
    { accessorKey: 'items', header: 'Items' },
    { accessorKey: 'pcs', header: 'Pcs' },
    { accessorKey: 'gross', header: 'Gross' },
    { accessorKey: 'net', header: 'Net' },
    { accessorKey: 'fine', header: 'Fine' },
    { accessorKey: 'value', header: 'Value', cell: ({ row }) => inr(row.original.value) },
  ]

  const exportCsv = () => {
    const header = ['Group', 'HSN', 'Karat', 'Items', 'Pcs', 'Gross', 'Net', 'Fine', 'Value']
    const body = (data ?? []).map((g) => [g.groupName, g.hsnCode ?? '', g.karatCode ?? '', g.items, g.pcs, g.gross, g.net, g.fine, g.value])
    downloadCsv(`group-stock${stockClass ? `-${stockClass.toLowerCase()}` : ''}.csv`, [header, ...body])
  }

  // Summary numbers derived from the rows already fetched (no extra requests).
  const totalItems = rows.reduce((sum, g) => sum + g.items, 0)
  const totalPcs = rows.reduce((sum, g) => sum + g.pcs, 0)
  const totalFine = rows.reduce((sum, g) => sum + Number(g.fine), 0)
  const totalValue = rows.reduce((sum, g) => sum + Number(g.value), 0)
  const scope = stockClass ? `${CLASS_LABEL[stockClass]} only` : 'Every class included'

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
      <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tile('Groups listed', data ? String(rows.length) : '—', scope, Layers)}
        {tile('Total pieces', data ? String(totalPcs) : '—', data ? `${totalItems} stock entries` : undefined, Boxes)}
        {tile('Fine weight', data ? `${totalFine.toFixed(3)} g` : '—', 'Sum over listed groups', Scale)}
        {tile('Total value', data ? inr(String(totalValue)) : '—', 'Sum over listed groups', IndianRupee)}
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 pt-6">
          <Select value={stockClass || 'all'} onValueChange={(v) => changeFilter(setStockClass)(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-40" aria-label="Stock class">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All classes</SelectItem>
              {STOCK_CLASSES.map((c) => (
                <SelectItem key={c} value={c}>
                  {CLASS_LABEL[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={changeFilter(setStatus)}>
            <SelectTrigger className="w-36" aria-label="Status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STOCK_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={method || 'all'} onValueChange={(v) => changeFilter(setMethod)(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-32" aria-label="Entry type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tag + Loose</SelectItem>
              <SelectItem value="TAG">Tag only</SelectItem>
              <SelectItem value="LOOSE">Loose only</SelectItem>
            </SelectContent>
          </Select>
          <Select value={karatCode || 'all'} onValueChange={(v) => changeFilter(setKaratCode)(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-32" aria-label="Purity">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any purity</SelectItem>
              {karatCodes.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input className="max-w-xs" placeholder="Search tag / HUID / item…" aria-label="Search stock" value={q} onChange={(e) => changeFilter(setQ)(e.target.value)} />
          <Button className="ml-auto" variant="outline" disabled={!data?.length} onClick={exportCsv}>Export CSV</Button>
        </CardContent>
      </Card>

      {selectedRows.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border bg-muted/40 px-4 py-3 text-sm">
          <span>{plural(selectedRows.length, 'group')} chosen · {plural(selectedItems, 'item')}</span>
          {canEdit && <Button size="sm" variant="outline" disabled={!!resolving} onClick={() => runBulk('edit')}>{resolving === 'edit' ? 'Loading items…' : t('stock.edit_selected')}</Button>}
          {canTags && <Button size="sm" variant="outline" disabled={!!resolving} onClick={() => runBulk('tags')}>{resolving === 'tags' ? 'Loading items…' : 'Print tags'}</Button>}
          {canDelete && <Button size="sm" variant="ghost" disabled={!!resolving} onClick={() => runBulk('delete')}>{resolving === 'delete' ? 'Loading items…' : t('stock.delete_selected')}</Button>}
          <Button size="sm" variant="ghost" onClick={clearSelection}>{t('stock.clear')}</Button>
        </div>
      )}

      <Card className="p-4">
        <DataTable columns={columns} data={rows} isLoading={isLoading} emptyText="No stock" />
      </Card>

      {bulkEditing && <BulkEditDialog ids={bulkIds} onClose={() => { setBulkEditing(false); clearSelection() }} />}
      <MpinDialog open={bulkDeleting} title={`Delete ${plural(bulkIds.length, 'item')}`} onConfirm={async (mpin) => { await bulkDelete.mutateAsync({ ids: bulkIds, mpin }); clearSelection() }} onClose={() => setBulkDeleting(false)} />
    </div>
  )
}
