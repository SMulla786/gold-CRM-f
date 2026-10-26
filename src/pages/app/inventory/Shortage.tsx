import type { ColumnDef } from '@tanstack/react-table'
import { Layers, PackageCheck, PackageX, TrendingDown, type LucideIcon } from 'lucide-react'
import { useState } from 'react'

import { DataTable } from '@/components/DataTable'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useJewelleryTypes, useShortage, useStock, useUpdateItemGroup, useUpdateItemName } from '@/lib/inventoryQueries'
import { useAuth } from '@/lib/auth'
import { useT } from '@/lib/i18n'
import { STOCK_CLASSES, type ShortageRowDto, type StockItemDto } from '@/shared'

const LIMIT_LABEL = { minWeight: 'inv.shortage.min_weight', maxWeight: 'inv.shortage.max_weight', minPcs: 'inv.shortage.min_pcs', maxPcs: 'inv.shortage.max_pcs' } as const

function LimitsDialog({ row, onClose }: { row: ShortageRowDto; onClose: () => void }) {
  const t = useT()
  const updateGroup = useUpdateItemGroup()
  const updateName = useUpdateItemName()
  const [f, setF] = useState({ minWeight: row.minWeight ?? '', maxWeight: row.maxWeight ?? '', minPcs: row.minPcs?.toString() ?? '', maxPcs: row.maxPcs?.toString() ?? '' })
  const save = async () => {
    const body: Record<string, unknown> = {}
    if (f.minWeight !== '') body.minWeight = Number(f.minWeight)
    if (f.maxWeight !== '') body.maxWeight = Number(f.maxWeight)
    if (f.minPcs !== '') body.minPcs = Number(f.minPcs)
    if (f.maxPcs !== '') body.maxPcs = Number(f.maxPcs)
    if (row.level === 'GROUP') await updateGroup.mutateAsync({ id: row.id, body })
    else await updateName.mutateAsync({ id: row.id, body })
    onClose()
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('inv.shortage.limits_title', { name: row.name })}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          {(['minWeight', 'maxWeight', 'minPcs', 'maxPcs'] as const).map((k) => (
            <div key={k} className="space-y-1.5">
              <Label htmlFor={`sl-${k}`}>{t(LIMIT_LABEL[k])}</Label>
              <Input id={`sl-${k}`} type="number" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={updateGroup.isPending || updateName.isPending}>{t('inv.shortage.save_limits')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Read-only list of the AVAILABLE stock behind one shortage row (group or item name). */
function StockDrillDialog({ row, onClose }: { row: ShortageRowDto; onClose: () => void }) {
  const t = useT()
  const drillCols: ColumnDef<StockItemDto, unknown>[] = [
    { id: 'tag', header: t('stock.col_tag_item'), cell: ({ row }) => row.original.tagNo ?? row.original.itemName.name },
    { id: 'item', header: t('bill.col_item'), cell: ({ row }) => row.original.itemName.name },
    { id: 'karat', header: t('stock.col_karat'), cell: ({ row }) => row.original.karatCode ?? '—' },
    { accessorKey: 'pcs', header: t('stock.col_pcs') },
    { accessorKey: 'gross', header: t('stock.col_gross') },
    { accessorKey: 'net', header: t('stock.col_net') },
    { id: 'branch', header: t('stock.col_branch'), cell: ({ row }) => row.original.branch.name },
  ]
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const { data, isLoading } = useStock({ page, pageSize, status: 'AVAILABLE', ...(row.level === 'GROUP' ? { groupId: row.id } : { itemNameId: row.id }) })
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t('inv.shortage.drill_title', { name: row.name })}</DialogTitle>
        </DialogHeader>
        <DataTable
          columns={drillCols}
          data={data?.items ?? []}
          isLoading={isLoading}
          emptyText={t('inv.shortage.drill_empty')}
          pagination={data ? { page: data.page, pageSize: data.pageSize, total: data.total, onPage: setPage, onPageSize: setPageSize } : undefined}
        />
      </DialogContent>
    </Dialog>
  )
}

const badge = (s: string) => (s === 'SHORTAGE' ? 'destructive' : s === 'WARNING' ? 'secondary' : 'default')
const PAGE_SIZES = [10, 50, 100]

export function Shortage() {
  const t = useT()
  const { can } = useAuth()
  const canEdit = can('inventory.item_masters', 'edit')
  const [stockClass, setStockClass] = useState('')
  const [status, setStatus] = useState('')
  const [jewelleryTypeId, setJewelleryTypeId] = useState('')
  const [q, setQ] = useState('')
  const { data: types } = useJewelleryTypes(stockClass || undefined)
  const { data, isLoading } = useShortage({ stockClass: stockClass || undefined, status: status || undefined, jewelleryTypeId: jewelleryTypeId || undefined, q: q || undefined })
  const [editing, setEditing] = useState<ShortageRowDto | null>(null)
  const [drill, setDrill] = useState<ShortageRowDto | null>(null)
  // Client-side paging over the (unpaged) shortage rows.
  const [pageSize, setPageSize] = useState(10)
  const [page, setPage] = useState(1)
  const resetFilters = () => { setStockClass(''); setStatus(''); setJewelleryTypeId(''); setQ(''); setPage(1) }

  // Summary counts derived from the rows already fetched (no extra requests).
  const rows = data ?? []
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize))
  const curPage = Math.min(page, pageCount)
  const pageRows = rows.slice((curPage - 1) * pageSize, curPage * pageSize)
  const underMin = rows.filter((r) => r.status === 'SHORTAGE').length
  const nearMin = rows.filter((r) => r.status === 'WARNING').length
  const healthy = rows.filter((r) => r.status === 'OK').length
  const pcs = (n: number) => t(n === 1 ? 'dash.pcs_one' : 'dash.pcs_other', { n })

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
        {tile(t('inv.shortage.rows_listed'), data ? String(rows.length) : '—', t('inv.shortage.rows_listed_sub'), Layers)}
        {tile(t('inv.shortage.under_min'), data ? String(underMin) : '—', t('inv.shortage.under_min_sub'), PackageX)}
        {tile(t('inv.shortage.near_min'), data ? String(nearMin) : '—', t('inv.shortage.near_min_sub'), TrendingDown)}
        {tile(t('inv.shortage.healthy'), data ? String(healthy) : '—', t('inv.shortage.healthy_sub'), PackageCheck)}
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 pt-6">
          <Input className="max-w-xs" placeholder={t('inv.shortage.search')} aria-label="Search groups" value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} />
          <Select value={stockClass || 'all'} onValueChange={(v) => { setStockClass(v === 'all' ? '' : v); setJewelleryTypeId(''); setPage(1) }}>
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
          <Select value={status || 'all'} onValueChange={(v) => { setStatus(v === 'all' ? '' : v); setPage(1) }}>
            <SelectTrigger className="w-40" aria-label="Status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('daybook.all')}</SelectItem>
              <SelectItem value="SHORTAGE">{t('inv.shortage.st_shortage')}</SelectItem>
              <SelectItem value="WARNING">{t('inv.shortage.st_warning')}</SelectItem>
              <SelectItem value="OK">{t('inv.shortage.st_ok')}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={jewelleryTypeId || 'all'} onValueChange={(v) => { setJewelleryTypeId(v === 'all' ? '' : v); setPage(1) }}>
            <SelectTrigger className="w-44" aria-label="Jewellery type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('inv.shortage.all_types')}</SelectItem>
              {types?.map((jt) => (
                <SelectItem key={jt.id} value={String(jt.id)}>
                  {jt.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="ghost" disabled={!stockClass && !status && !jewelleryTypeId && !q} onClick={resetFilters}>{t('inv.shortage.reset')}</Button>
        </CardContent>
      </Card>

      <Card className="overflow-x-auto p-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('inv.shortage.col_level')}</TableHead>
              <TableHead>{t('inv.shortage.col_name')}</TableHead>
              <TableHead>{t('gst.col_class')}</TableHead>
              <TableHead>{t('daybook.col_type')}</TableHead>
              <TableHead>{t('inv.shortage.col_current')}</TableHead>
              <TableHead>{t('inv.shortage.col_min_max')}</TableHead>
              <TableHead>{t('stock.col_status')}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={8} className="h-24 text-center text-muted-foreground">{t('common.loading')}</TableCell></TableRow>
            ) : data?.length ? (
              pageRows.map((r) => (
                <TableRow key={`${r.level}-${r.id}`} className="cursor-pointer" onClick={() => setDrill(r)}>
                  <TableCell className="text-muted-foreground">{r.level}</TableCell>
                  <TableCell className="font-medium">
                    <button type="button" className="rounded-sm text-left font-medium text-primary hover:underline focus-visible:underline focus-visible:outline-none" title={t('inv.shortage.show_stock')} onClick={(e) => { e.stopPropagation(); setDrill(r) }}>
                      {r.name}
                    </button>
                  </TableCell>
                  <TableCell>{t(`class.${r.stockClass}`)}</TableCell>
                  <TableCell className="text-muted-foreground">{r.jewelleryType ?? '—'}</TableCell>
                  <TableCell className="tabular-nums">{r.currentWeight} g · {pcs(r.currentPcs)}</TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">
                    {r.minWeight ?? '—'} / {r.maxWeight ?? '—'}
                    {(r.minPcs != null || r.maxPcs != null) && <div className="text-xs">{t('inv.shortage.pcs_range', { min: r.minPcs ?? '—', max: r.maxPcs ?? '—' })}</div>}
                  </TableCell>
                  <TableCell><Badge variant={badge(r.status)}>{r.status}</Badge></TableCell>
                  <TableCell>{canEdit && <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setEditing(r) }}>{t('inv.shortage.edit_limits')}</Button>}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  <div className="flex flex-col items-center justify-center gap-2 py-4">
                    <span className="icon-chip"><PackageCheck className="size-5" aria-hidden /></span>
                    <span>{t('inv.shortage.empty')}</span>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        {rows.length > 0 && (
          <div className="flex flex-wrap items-center justify-end gap-2 px-2 pt-3 pb-1 text-sm">
            <div className="mr-auto flex items-center gap-2 text-muted-foreground">
              <span>{t('inv.shortage.show')}</span>
              <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1) }}>
                <SelectTrigger className="h-8 w-20" aria-label="Rows per page">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZES.map((s) => (
                    <SelectItem key={s} value={String(s)}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <span className="text-muted-foreground">{t('inv.shortage.page_of', { page: curPage, pages: pageCount, rows: t(rows.length === 1 ? 'inv.count.row_one' : 'inv.count.row_other', { n: rows.length }) })}</span>
            <Button variant="outline" size="sm" disabled={curPage <= 1} onClick={() => setPage(curPage - 1)}>{t('table.previous')}</Button>
            <Button variant="outline" size="sm" disabled={curPage >= pageCount} onClick={() => setPage(curPage + 1)}>{t('table.next')}</Button>
          </div>
        )}
      </Card>
      {editing && <LimitsDialog row={editing} onClose={() => setEditing(null)} />}
      {drill && <StockDrillDialog row={drill} onClose={() => setDrill(null)} />}
    </div>
  )
}
