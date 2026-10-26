import type { ColumnDef } from '@tanstack/react-table'
import { ArrowLeftRight, Gem, Package, Route, type LucideIcon } from 'lucide-react'
import { useState } from 'react'

import { DataTable } from '@/components/DataTable'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useCreateStockTransfer, useStock, useStockTransfer, useStockTransfers } from '@/lib/inventoryQueries'
import { useAuth } from '@/lib/auth'
import { plural } from '@/lib/plural'
import type { BranchRef, StockTransferDto } from '@/shared'

const date = (s: string) => new Date(s).toLocaleDateString('en-IN')

function NewTransferDialog({ branches, onClose }: { branches: BranchRef[]; onClose: () => void }) {
  const create = useCreateStockTransfer()
  const [fromBranchId, setFrom] = useState('')
  const [toBranchId, setTo] = useState('')
  const [picked, setPicked] = useState<Set<number>>(new Set())
  const [remarks, setRemarks] = useState('')
  const { data: stock } = useStock(fromBranchId ? { branchId: Number(fromBranchId), status: 'AVAILABLE', pageSize: 100 } : {})
  const items = fromBranchId ? (stock?.items ?? []) : []
  const toggle = (id: number) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>New stock transfer</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>From branch</Label>
            <Select value={fromBranchId} onValueChange={(v) => { setFrom(v); setPicked(new Set()) }}>
              <SelectTrigger aria-label="From branch">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>To branch</Label>
            <Select value={toBranchId} onValueChange={setTo}>
              <SelectTrigger aria-label="To branch">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {branches.filter((b) => String(b.id) !== fromBranchId).map((b) => (
                  <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {fromBranchId && (
          <div className="overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10" />
                  <TableHead>Tag / Item</TableHead>
                  <TableHead>Karat</TableHead>
                  <TableHead>Net</TableHead>
                  <TableHead>Fine</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length ? (
                  items.map((it) => (
                    <TableRow key={it.id}>
                      <TableCell><Checkbox aria-label={`Select ${it.tagNo ?? it.id}`} checked={picked.has(it.id)} onCheckedChange={() => toggle(it.id)} /></TableCell>
                      <TableCell>{it.tagNo ?? it.itemName.name}</TableCell>
                      <TableCell>{it.karatCode ?? '—'}</TableCell>
                      <TableCell>{it.net}</TableCell>
                      <TableCell>{it.fine}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow><TableCell colSpan={5} className="h-16 text-center text-muted-foreground">No available items in this branch</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="t-remarks">Remarks</Label>
          <input id="t-remarks" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
        </div>

        <DialogFooter>
          <Button
            disabled={!fromBranchId || !toBranchId || picked.size === 0 || create.isPending}
            onClick={async () => { await create.mutateAsync({ fromBranchId: Number(fromBranchId), toBranchId: Number(toBranchId), stockItemIds: [...picked], remarks: remarks || undefined }); onClose() }}
          >
            Transfer {picked.size ? plural(picked.size, 'item') : 'items'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DetailDialog({ id, onClose }: { id: number; onClose: () => void }) {
  const { data, isLoading } = useStockTransfer(id)
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Transfer #{data?.transferNo ?? id}</DialogTitle>
        </DialogHeader>
        {isLoading || !data ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="space-y-3 text-sm">
            <div>{data.fromBranch.name} → {data.toBranch.name} · {date(data.txnDate)} · {plural(data.itemCount, 'item')}</div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tag / Item</TableHead>
                  <TableHead>Karat</TableHead>
                  <TableHead>Net</TableHead>
                  <TableHead>Fine</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((it) => (
                  <TableRow key={it.id}>
                    <TableCell>{it.tagNo ?? it.itemName.name}</TableCell>
                    <TableCell>{it.karatCode ?? '—'}</TableCell>
                    <TableCell>{it.net}</TableCell>
                    <TableCell>{it.fine}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {data.remarks && <p className="text-muted-foreground">Remarks: {data.remarks}</p>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export function StockTransfers() {
  const { me } = useAuth()
  const branches = me?.accessibleBranches ?? []
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const { data, isLoading } = useStockTransfers({ page, pageSize })
  const [creating, setCreating] = useState(false)
  const [detailId, setDetailId] = useState<number | null>(null)

  const columns: ColumnDef<StockTransferDto, unknown>[] = [
    { accessorKey: 'transferNo', header: '#', cell: ({ row }) => <button className="font-medium hover:underline" onClick={() => setDetailId(row.original.id)}>{row.original.transferNo}</button> },
    { accessorKey: 'txnDate', header: 'Date', cell: ({ row }) => date(row.original.txnDate) },
    { header: 'From → To', cell: ({ row }) => `${row.original.fromBranch.name} → ${row.original.toBranch.name}` },
    { accessorKey: 'itemCount', header: 'Items' },
    { accessorKey: 'fine', header: 'Fine' },
    { accessorKey: 'createdBy', header: 'By', cell: ({ row }) => row.original.createdBy ?? '—' },
  ]

  // Summary numbers derived from the page already fetched (no extra requests).
  const rows = data?.items ?? []
  const itemsMoved = rows.reduce((sum, t) => sum + t.itemCount, 0)
  const fineMoved = rows.reduce((sum, t) => sum + Number(t.fine), 0)
  const grossMoved = rows.reduce((sum, t) => sum + Number(t.gross), 0)
  const routes = new Set(rows.map((t) => `${t.fromBranch.id}-${t.toBranch.id}`)).size

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl">Stock transfers</h2>
          <p className="text-sm text-muted-foreground">Move whole items between your branches</p>
        </div>
        <Button onClick={() => setCreating(true)}>New transfer</Button>
      </div>

      <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tile('Transfers', data ? String(data.total) : '—', 'Across branches you can see', ArrowLeftRight)}
        {tile('Items moved', data ? String(itemsMoved) : '—', data ? `On this page (${rows.length} shown)` : undefined, Package)}
        {tile('Fine moved', data ? `${fineMoved.toFixed(3)} g` : '—', data ? `Gross ${grossMoved.toFixed(3)} g on this page` : undefined, Gem)}
        {tile('Routes', data ? String(routes) : '—', 'Distinct branch pairs on this page', Route)}
      </div>

      <Card className="p-4">
        <DataTable
          columns={columns}
          data={data?.items ?? []}
          isLoading={isLoading}
          emptyText="No transfers"
          pagination={data ? { page: data.page, pageSize: data.pageSize, total: data.total, onPage: setPage, onPageSize: setPageSize } : undefined}
        />
      </Card>
      {creating && <NewTransferDialog branches={branches} onClose={() => setCreating(false)} />}
      {detailId && <DetailDialog id={detailId} onClose={() => setDetailId(null)} />}
    </div>
  )
}
