import type { ColumnDef } from '@tanstack/react-table'
import { Boxes, Gem, History, Layers, Scale, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { AuthedImage } from '@/components/AuthedImage'
import { DataTable } from '@/components/DataTable'
import { MpinDialog } from '@/components/MpinDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useKarats } from '@/lib/appQueries'
import { fetchAllStock, useBulkDeleteStock, useBulkEditStock, useDeleteStock, useItemGroups, useItemNames, useRemoveStockPhoto, useStock, useStockLedger, useUpdateStock, useUploadStockPhoto } from '@/lib/inventoryQueries'
import { useAuth } from '@/lib/auth'
import { downloadCsv } from '@/lib/csv'
import { useT } from '@/lib/i18n'
import { plural } from '@/lib/plural'
import { CheckoutDraftDialog } from '@/pages/app/billing/CheckoutDraftDialog'
import { CHARGE_UNITS, STOCK_CLASSES, STOCK_STATUSES, type StockItemDto } from '@/shared'

const CLASS_LABEL: Record<string, string> = { GOLD: 'Gold', SILVER: 'Silver', STONE: 'Stone', ARTIFICIAL: 'Artificial', FRANCHISE: 'Franchise' }
const UNIT_SHORT: Record<string, string> = { PER_GRAM: '/g', PERCENT: '%', FIXED: 'fixed' }

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
  const uploadPhoto = useUploadStockPhoto()
  const removePhoto = useRemoveStockPhoto()
  const [photoVer, setPhotoVer] = useState(0)
  const [photoRemoved, setPhotoRemoved] = useState(false)
  const hasPhoto = (!!item.photoUrl && !photoRemoved) || photoVer > 0
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
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
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
        <div className="space-y-1.5">
          <Label htmlFor="e-photo">Photo</Label>
          <div className="flex items-center gap-3">
            {hasPhoto && <AuthedImage path={`/app/files/stock/${item.id}/photo`} ver={photoVer} alt={item.itemName.name} className="h-16 w-16 rounded-md border object-cover" />}
            <Input id="e-photo" type="file" accept="image/jpeg,image/png,image/webp" disabled={uploadPhoto.isPending}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPhoto.mutate({ id: item.id, file: f }, { onSuccess: () => { setPhotoRemoved(false); setPhotoVer((v) => v + 1) } }) }} />
            {hasPhoto && (
              <Button type="button" variant="ghost" size="sm" disabled={removePhoto.isPending}
                onClick={() => removePhoto.mutate(item.id, { onSuccess: () => { setPhotoRemoved(true); setPhotoVer(0) } })}>
                Remove photo
              </Button>
            )}
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
          <DialogTitle>Edit {plural(ids.length, 'item')}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">Only the fields you fill are applied to every selected item.</p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
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

const DETAIL_FIELDS: [string, (i: StockItemDto) => string][] = [
  ['Class', (i) => CLASS_LABEL[i.stockClass] ?? i.stockClass], ['Group', (i) => i.group.name], ['Item', (i) => i.itemName.name],
  ['Method', (i) => i.method], ['Tag', (i) => i.tagNo ?? '—'], ['HUID', (i) => i.huid ?? '—'], ['HSN', (i) => i.hsnCode ?? '—'],
  ['Karat', (i) => i.karatCode ?? '—'], ['Pcs', (i) => String(i.pcs)], ['Gross', (i) => i.gross], ['Less', (i) => i.less],
  ['Net', (i) => i.net], ['Tunch', (i) => i.tunch], ['Wastage %', (i) => i.wastage], ['Fine', (i) => i.fine],
  ['Stone', (i) => i.stoneCharge], ['Labour', (i) => `${i.labour} (${i.labourUnit})`], ['Other', (i) => i.other],
  ['Rate', (i) => i.rate ?? '—'], ['Cost', (i) => i.purchaseCost ?? '—'], ['Branch', (i) => i.branch.name], ['Remarks', (i) => i.remarks ?? '—'],
]

function StockDetailSheet({ item, onClose }: { item: StockItemDto; onClose: () => void }) {
  const { data, isLoading } = useStockLedger(item)
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{item.tagNo ?? item.itemName.name}</SheetTitle>
        </SheetHeader>
        <div className="space-y-6 px-4 pb-6">
          {item.photoUrl && <AuthedImage path={`/app/files/stock/${item.id}/photo`} alt={item.itemName.name} className="max-h-48 rounded-md border object-contain" />}
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {DETAIL_FIELDS.map(([label, get]) => (
              <div key={label}>
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="font-medium">{get(item)}</dd>
              </div>
            ))}
          </dl>
          <div>
            <h3 className="mb-2 text-sm font-semibold">Movement history</h3>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : data && data.items.length > 0 ? (
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left text-muted-foreground">
                    <tr><th className="p-2">Date</th><th className="p-2">Source</th><th className="p-2">Dir</th><th className="p-2 text-right">Gross</th><th className="p-2 text-right">Net</th><th className="p-2 text-right">Fine</th></tr>
                  </thead>
                  <tbody>
                    {data.items.map((r) => (
                      <tr key={r.id} className={r.reversed ? 'text-muted-foreground line-through' : ''}>
                        <td className="p-2">{new Date(r.txnDate).toLocaleDateString('en-IN')}</td>
                        <td className="p-2">{r.source}</td>
                        <td className="p-2">{r.direction}</td>
                        <td className="p-2 text-right">{r.gross ?? '—'}</td>
                        <td className="p-2 text-right">{r.net ?? '—'}</td>
                        <td className="p-2 text-right">{r.fine ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
                <span className="icon-chip"><History className="size-5" aria-hidden /></span>
                <p className="text-sm text-muted-foreground">No movements.</p>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

export function StockList() {
  const t = useT()
  const { can } = useAuth()
  const canEdit = can('inventory.all_stock', 'edit')
  const canDelete = can('inventory.all_stock', 'delete')
  const [page, setPage] = useState(1)
  // seed-only from ?class= (dashboard links); user edits take over after mount.
  const [params] = useSearchParams()
  const [stockClass, setStockClass] = useState(() => {
    const c = params.get('class') ?? ''
    return (STOCK_CLASSES as readonly string[]).includes(c) ? c : ''
  })
  const [status, setStatus] = useState('AVAILABLE')
  const [q, setQ] = useState('')
  // Extra filters (all already accepted by stockListQuery). '' = any.
  const [method, setMethod] = useState('')
  const [groupId, setGroupId] = useState('')
  const [itemNameId, setItemNameId] = useState('')
  const [karatCode, setKaratCode] = useState('')
  const [minWeight, setMinWeight] = useState('')
  const [maxWeight, setMaxWeight] = useState('')
  const { data: groupOpts } = useItemGroups({ stockClass: stockClass || undefined, pageSize: 100 })
  const { data: nameOpts } = useItemNames({ stockClass: stockClass || undefined, groupId: groupId ? Number(groupId) : undefined, pageSize: 100 })
  const { data: karats } = useKarats()
  const karatCodes = [...new Set((karats ?? []).map((k) => k.code))]
  const filters = {
    status,
    stockClass: stockClass || undefined,
    q: q || undefined,
    method: method || undefined,
    groupId: groupId || undefined,
    itemNameId: itemNameId || undefined,
    karatCode: karatCode || undefined,
    minWeight: minWeight || undefined,
    maxWeight: maxWeight || undefined,
  }
  const { data, isLoading } = useStock({ page, ...filters })
  const navigate = useNavigate()
  const canTags = can('inventory.tag_print', 'view')
  const del = useDeleteStock()
  const bulkDelete = useBulkDeleteStock()
  const [deleting, setDeleting] = useState<StockItemDto | null>(null)
  const [editing, setEditing] = useState<StockItemDto | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [bulkEditing, setBulkEditing] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [viewing, setViewing] = useState<StockItemDto | null>(null)
  const [exporting, setExporting] = useState(false)
  const [checkout, setCheckout] = useState(false)
  const canCheckout = can('billing.showroom_drafts', 'edit')

  const exportCsv = async () => {
    setExporting(true)
    try {
      const all = await fetchAllStock(filters)
      const header = ['Tag', 'Item', 'Group', 'Class', 'Karat', 'Pcs', 'Gross', 'Net', 'Fine', 'Stone', 'Labour', 'Rate', 'Cost', 'Branch', 'Status']
      const body = all.map((i) => [i.tagNo ?? '', i.itemName.name, i.group.name, i.stockClass, i.karatCode ?? '', i.pcs, i.gross, i.net, i.fine, i.stoneCharge, i.labour, i.rate ?? '', i.purchaseCost ?? '', i.branch.name, i.status])
      downloadCsv(`stock-${status.toLowerCase()}.csv`, [header, ...body])
    } finally {
      setExporting(false)
    }
  }

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

  // Summary numbers derived from the page already fetched (no extra requests).
  const g3 = (n: number) => `${n.toFixed(3)} g`
  const pcsOnPage = rows.reduce((sum, r) => sum + Number(r.pcs), 0)
  const grossOnPage = rows.reduce((sum, r) => sum + Number(r.gross), 0)
  const netOnPage = rows.reduce((sum, r) => sum + Number(r.net), 0)
  const fineOnPage = rows.reduce((sum, r) => sum + Number(r.fine), 0)

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

  const columns: ColumnDef<StockItemDto, unknown>[] = [
    ...(canEdit || canDelete || canCheckout
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
    { header: t('stock.col_tag_item'), cell: ({ row }) => <button type="button" className="rounded-sm font-medium text-primary hover:underline focus-visible:underline focus-visible:outline-none" onClick={() => setViewing(row.original)}>{row.original.tagNo ?? row.original.itemName.name}</button> },
    { id: 'item', header: 'Item', cell: ({ row }) => row.original.itemName.name },
    { id: 'huid', header: 'HUID', cell: ({ row }) => row.original.huid ?? '—' },
    { header: t('stock.col_group'), cell: ({ row }) => row.original.group.name },
    { id: 'hsn', header: 'HSN', cell: ({ row }) => row.original.hsnCode ?? '—' },
    { accessorKey: 'karatCode', header: t('stock.col_karat'), cell: ({ row }) => row.original.karatCode ?? '—' },
    { accessorKey: 'pcs', header: t('stock.col_pcs') },
    { accessorKey: 'gross', header: t('stock.col_gross') },
    { accessorKey: 'net', header: t('stock.col_net') },
    { id: 'tunch', header: 'Tunch', cell: ({ row }) => row.original.tunch },
    { id: 'wastage', header: 'Wst %', cell: ({ row }) => row.original.wastage },
    { accessorKey: 'fine', header: t('stock.col_fine') },
    { id: 'labour', header: 'Labour', cell: ({ row }) => <span className="whitespace-nowrap">{row.original.labour} {UNIT_SHORT[row.original.labourUnit] ?? row.original.labourUnit}</span> },
    { id: 'rate', header: 'Rate', cell: ({ row }) => row.original.rate ?? '—' },
    { header: t('stock.col_branch'), cell: ({ row }) => row.original.branch.name },
    { accessorKey: 'status', header: t('stock.col_status'), cell: ({ row }) => <Badge variant={row.original.status === 'AVAILABLE' ? 'default' : 'secondary'}>{row.original.status}</Badge> },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) =>
        row.original.status === 'AVAILABLE' ? (
          <div className="flex gap-2">
            {canEdit && <Button variant="outline" size="sm" onClick={() => setEditing(row.original)}>{t('common.edit')}</Button>}
            {canDelete && <Button variant="ghost" size="sm" onClick={() => setDeleting(row.original)}>{t('common.delete')}</Button>}
          </div>
        ) : null,
    },
  ]

  return (
    <div className="space-y-8">
      <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tile('Matching items', data ? String(data.total) : '—', 'With current filters', Boxes)}
        {tile('Pieces on this page', data ? String(pcsOnPage) : '—', data ? `${rows.length} rows shown` : undefined, Layers)}
        {tile('Gross wt on this page', data ? g3(grossOnPage) : '—', data ? `Net ${g3(netOnPage)}` : undefined, Scale)}
        {tile('Fine wt on this page', data ? g3(fineOnPage) : '—', 'All classes combined', Gem)}
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 pt-6">
          <Input className="max-w-xs" placeholder={t('stock.search')} value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} />
          <Select value={stockClass || 'all'} onValueChange={(v) => { setStockClass(v === 'all' ? '' : v); setGroupId(''); setItemNameId(''); setPage(1) }}>
            <SelectTrigger className="w-36" aria-label="Stock class">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('stock.all_classes')}</SelectItem>
              {STOCK_CLASSES.map((c) => (
                <SelectItem key={c} value={c}>{t(`class.${c}`)}</SelectItem>
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
          <Select value={method || 'all'} onValueChange={(v) => { setMethod(v === 'all' ? '' : v); setPage(1) }}>
            <SelectTrigger className="w-32" aria-label="Entry type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tag + Loose</SelectItem>
              <SelectItem value="TAG">Tag only</SelectItem>
              <SelectItem value="LOOSE">Loose only</SelectItem>
            </SelectContent>
          </Select>
          <Select value={groupId || 'all'} onValueChange={(v) => { setGroupId(v === 'all' ? '' : v); setItemNameId(''); setPage(1) }}>
            <SelectTrigger className="w-40" aria-label="Item group">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All groups</SelectItem>
              {groupOpts?.items.map((g) => (
                <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={itemNameId || 'all'} onValueChange={(v) => { setItemNameId(v === 'all' ? '' : v); setPage(1) }}>
            <SelectTrigger className="w-40" aria-label="Item">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All items</SelectItem>
              {nameOpts?.items.map((n) => (
                <SelectItem key={n.id} value={String(n.id)}>{n.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={karatCode || 'all'} onValueChange={(v) => { setKaratCode(v === 'all' ? '' : v); setPage(1) }}>
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
          <div className="flex items-center gap-1">
            <Input className="w-24" type="number" min={0} step="0.001" placeholder="Net from g" aria-label="Minimum net weight" value={minWeight} onChange={(e) => { setMinWeight(e.target.value); setPage(1) }} />
            <span className="text-muted-foreground" aria-hidden>–</span>
            <Input className="w-24" type="number" min={0} step="0.001" placeholder="Net to g" aria-label="Maximum net weight" value={maxWeight} onChange={(e) => { setMaxWeight(e.target.value); setPage(1) }} />
          </div>
          <Button className="ml-auto" variant="outline" disabled={exporting} onClick={exportCsv}>
            {exporting ? 'Exporting…' : t('common.export_csv')}
          </Button>
        </CardContent>
      </Card>

      {ids.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border bg-muted/40 px-4 py-3 text-sm">
          <span>{t('stock.selected', { n: ids.length })}</span>
          {canCheckout && <Button size="sm" onClick={() => setCheckout(true)}>{t('stock.add_to_cart')}</Button>}
          {canEdit && <Button size="sm" variant="outline" onClick={() => setBulkEditing(true)}>{t('stock.edit_selected')}</Button>}
          {canTags && <Button size="sm" variant="outline" onClick={() => navigate('/app/inventory/tags', { state: { ids } })}>Print tags</Button>}
          {canDelete && <Button size="sm" variant="ghost" onClick={() => setBulkDeleting(true)}>{t('stock.delete_selected')}</Button>}
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>{t('stock.clear')}</Button>
        </div>
      )}

      <Card className="p-4">
        <DataTable
          columns={columns}
          data={rows}
          isLoading={isLoading}
          emptyText={t('stock.no_items')}
          pagination={data ? { page: data.page, pageSize: data.pageSize, total: data.total, onPage: setPage } : undefined}
        />
      </Card>

      {checkout && <CheckoutDraftDialog stockItemIds={ids} onClose={() => setCheckout(false)} onDone={() => { setCheckout(false); setSelected(new Set()) }} />}
      {viewing && <StockDetailSheet item={viewing} onClose={() => setViewing(null)} />}
      {editing && <StockEditDialog item={editing} onClose={() => setEditing(null)} />}
      {bulkEditing && <BulkEditDialog ids={ids} onClose={() => { setBulkEditing(false); setSelected(new Set()) }} />}
      <MpinDialog open={!!deleting} title={`Delete ${deleting?.tagNo ?? deleting?.itemName.name ?? ''}`} onConfirm={(mpin) => del.mutateAsync({ id: deleting!.id, mpin })} onClose={() => setDeleting(null)} />
      <MpinDialog open={bulkDeleting} title={`Delete ${plural(ids.length, 'item')}`} onConfirm={async (mpin) => { await bulkDelete.mutateAsync({ ids, mpin }); setSelected(new Set()) }} onClose={() => setBulkDeleting(false)} />
    </div>
  )
}
