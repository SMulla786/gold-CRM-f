import type { ColumnDef } from '@tanstack/react-table'
import { Boxes, IndianRupee, Layers, Scale, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { flushSync } from 'react-dom'

import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { ExcelExportButton } from '@/components/CsvExportButton'
import { DataTable } from '@/components/DataTable'
import { MpinDialog } from '@/components/MpinDialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useKarats } from '@/lib/appQueries'
import { useAuth } from '@/lib/auth'
import { fetchAllStock, useBulkDeleteStock, useGroupStock, useJewelleryTypes } from '@/lib/inventoryQueries'
import { downloadCsv } from '@/lib/csv'
import { downloadPdf } from '@/lib/share'
import { useT } from '@/lib/i18n'
import { BulkEditDialog } from '@/pages/app/inventory/StockList'
import { STOCK_CLASSES, STOCK_STATUSES, type GroupStockDto } from '@/shared'

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
  const [jewelleryTypeId, setJewelleryTypeId] = useState('')
  const { data: typeOpts } = useJewelleryTypes(stockClass || undefined)
  const { data: karats } = useKarats()
  const karatCodes = [...new Set((karats ?? []).map((k) => k.code))]
  const filters = { stockClass: stockClass || undefined, status, method: method || undefined, karatCode: karatCode || undefined, q: q || undefined, jewelleryTypeId: jewelleryTypeId || undefined }
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
      if (ids.length === 0) return void toast.error(t('inv.group.no_items'))
      if (action === 'tags') return navigate('/app/inventory/tags', { state: { ids } })
      if (ids.length > BULK_MAX) return void toast.error(t('inv.group.too_many', { n: ids.length, max: BULK_MAX }))
      setBulkIds(ids)
      if (action === 'edit') setBulkEditing(true)
      else setBulkDeleting(true)
    } catch {
      toast.error(t('inv.group.load_failed'))
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
    { accessorKey: 'groupName', header: t('stock.col_group') },
    { id: 'hsn', header: 'HSN', cell: ({ row }) => row.original.hsnCode ?? '—' },
    { accessorKey: 'karatCode', header: t('stock.col_karat'), cell: ({ row }) => row.original.karatCode ?? '—' },
    { accessorKey: 'items', header: t('bill.col_items') },
    { accessorKey: 'pcs', header: t('stock.col_pcs') },
    { accessorKey: 'gross', header: t('stock.col_gross') },
    { accessorKey: 'net', header: t('stock.col_net') },
    { accessorKey: 'fine', header: t('stock.col_fine') },
    { accessorKey: 'value', header: t('gst.col_value'), cell: ({ row }) => inr(row.original.value) },
  ]

  /** Header + listed rows; shared by Export CSV and Excel. */
  const exportRows = () => {
    const header = ['Group', 'HSN', 'Karat', 'Items', 'Pcs', 'Gross', 'Net', 'Fine', 'Value']
    const body = (data ?? []).map((g) => [g.groupName, g.hsnCode ?? '', g.karatCode ?? '', g.items, g.pcs, g.gross, g.net, g.fine, g.value])
    return [header, ...body]
  }
  const exportFile = `group-stock${stockClass ? `-${stockClass.toLowerCase()}` : ''}.csv`
  const exportCsv = () => downloadCsv(exportFile, exportRows())

  // PDF = browser print of the listed groups (the endpoint is unpaged, so these are all rows) via the hidden .print-area.
  const [printing, setPrinting] = useState(false)
  const exportPdf = () => {
    flushSync(() => setPrinting(true))
    window.addEventListener('afterprint', () => setPrinting(false), { once: true })
    downloadPdf()
  }

  // Summary numbers derived from the rows already fetched (no extra requests).
  const totalItems = rows.reduce((sum, g) => sum + g.items, 0)
  const totalPcs = rows.reduce((sum, g) => sum + g.pcs, 0)
  const totalFine = rows.reduce((sum, g) => sum + Number(g.fine), 0)
  const totalValue = rows.reduce((sum, g) => sum + Number(g.value), 0)
  const scope = stockClass ? t('inv.group.class_only', { cls: t(`class.${stockClass}`) }) : t('inv.group.every_class')
  const itemsLabel = (n: number) => t(n === 1 ? 'inv.count.item_one' : 'inv.count.item_other', { n })
  const groupsLabel = (n: number) => t(n === 1 ? 'inv.count.group_one' : 'inv.count.group_other', { n })

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
        {tile(t('inv.group.groups_listed'), data ? String(rows.length) : '—', scope, Layers)}
        {tile(t('inv.group.total_pieces'), data ? String(totalPcs) : '—', data ? t('inv.group.stock_entries', { n: totalItems }) : undefined, Boxes)}
        {tile(t('inv.newstock.fine_weight'), data ? `${totalFine.toFixed(3)} g` : '—', t('inv.group.sum_listed'), Scale)}
        {tile(t('inv.group.total_value'), data ? inr(String(totalValue)) : '—', t('inv.group.sum_listed'), IndianRupee)}
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 pt-6">
          <Select value={stockClass || 'all'} onValueChange={(v) => { setJewelleryTypeId(''); changeFilter(setStockClass)(v === 'all' ? '' : v) }}>
            <SelectTrigger className="w-40" aria-label="Stock class">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('stock.all_classes')}</SelectItem>
              {STOCK_CLASSES.map((c) => (
                <SelectItem key={c} value={c}>
                  {t(`class.${c}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={changeFilter(setStatus)}>
            <SelectTrigger className="w-36" aria-label="Status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{t('girvi.status_all')}</SelectItem>
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
              <SelectItem value="all">{t('inv.f.tag_loose')}</SelectItem>
              <SelectItem value="TAG">{t('inv.f.tag_only')}</SelectItem>
              <SelectItem value="LOOSE">{t('inv.f.loose_only')}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={karatCode || 'all'} onValueChange={(v) => changeFilter(setKaratCode)(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-32" aria-label="Purity">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('inv.f.any_purity')}</SelectItem>
              {karatCodes.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={jewelleryTypeId || 'all'} onValueChange={(v) => changeFilter(setJewelleryTypeId)(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-40" aria-label="Type (collection)">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('bill.all_types')}</SelectItem>
              {typeOpts?.map((jt) => (
                <SelectItem key={jt.id} value={String(jt.id)}>{jt.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input className="max-w-xs" placeholder={t('inv.f.search_tag_huid')} aria-label="Search stock" value={q} onChange={(e) => changeFilter(setQ)(e.target.value)} />
          <Button className="ml-auto" variant="outline" disabled={!data?.length} onClick={exportCsv}>{t('common.export_csv')}</Button>
          <ExcelExportButton filename={exportFile} rows={exportRows} disabled={!data?.length} />
          <Button variant="outline" disabled={!data?.length} onClick={exportPdf}>{t('inv.f.export_pdf')}</Button>
        </CardContent>
      </Card>

      {selectedRows.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border bg-muted/40 px-4 py-3 text-sm">
          <span>{t('inv.group.chosen', { groups: groupsLabel(selectedRows.length), items: itemsLabel(selectedItems) })}</span>
          {canEdit && <Button size="sm" variant="outline" disabled={!!resolving} onClick={() => runBulk('edit')}>{resolving === 'edit' ? t('inv.group.loading_items') : t('stock.edit_selected')}</Button>}
          {canTags && <Button size="sm" variant="outline" disabled={!!resolving} onClick={() => runBulk('tags')}>{resolving === 'tags' ? t('inv.group.loading_items') : t('inv.f.print_tags')}</Button>}
          {canDelete && <Button size="sm" variant="ghost" disabled={!!resolving} onClick={() => runBulk('delete')}>{resolving === 'delete' ? t('inv.group.loading_items') : t('stock.delete_selected')}</Button>}
          <Button size="sm" variant="ghost" onClick={clearSelection}>{t('stock.clear')}</Button>
        </div>
      )}

      <Card className="p-4">
        <DataTable columns={columns} data={rows} isLoading={isLoading} emptyText={t('inv.group.no_stock')} />
      </Card>

      {printing && (
        <div className="print-area hidden print:block">
          <h2 className="mb-1 text-lg font-semibold">{t('inv.group.print_title', { status, scope })}</h2>
          <p className="mb-3 text-xs">{groupsLabel(rows.length)}</p>
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b text-left">
                {/* HSN is not a key: t() returns it unchanged */}
                {['stock.col_group', 'HSN', 'stock.col_karat', 'bill.col_items', 'stock.col_pcs', 'stock.col_gross', 'stock.col_net', 'stock.col_fine', 'gst.col_value'].map((h) => <th key={h} className="p-1">{t(h)}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((g) => (
                <tr key={rowKey(g)} className="border-b">
                  <td className="p-1">{g.groupName}</td><td className="p-1">{g.hsnCode ?? '—'}</td><td className="p-1">{g.karatCode ?? '—'}</td><td className="p-1">{g.items}</td>
                  <td className="p-1">{g.pcs}</td><td className="p-1">{g.gross}</td><td className="p-1">{g.net}</td><td className="p-1">{g.fine}</td><td className="p-1">{inr(g.value)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-semibold">
                <td className="p-1" colSpan={3}>{t('bill.col_total')}</td>
                <td className="p-1">{totalItems}</td><td className="p-1">{totalPcs}</td>
                <td className="p-1">{rows.reduce((sum, g) => sum + Number(g.gross), 0).toFixed(3)}</td>
                <td className="p-1">{rows.reduce((sum, g) => sum + Number(g.net), 0).toFixed(3)}</td>
                <td className="p-1">{totalFine.toFixed(3)}</td><td className="p-1">{inr(String(totalValue))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {bulkEditing && <BulkEditDialog ids={bulkIds} onClose={() => { setBulkEditing(false); clearSelection() }} />}
      <MpinDialog open={bulkDeleting} title={t('jbill.delete_title', { no: itemsLabel(bulkIds.length) })} onConfirm={async (mpin) => { await bulkDelete.mutateAsync({ ids: bulkIds, mpin }); clearSelection() }} onClose={() => setBulkDeleting(false)} />
    </div>
  )
}
