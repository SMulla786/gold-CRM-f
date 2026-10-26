import { Layers, PackageCheck, PackageX, TrendingDown, type LucideIcon } from 'lucide-react'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useShortage, useUpdateItemGroup, useUpdateItemName } from '@/lib/inventoryQueries'
import { useAuth } from '@/lib/auth'
import { plural } from '@/lib/plural'
import { STOCK_CLASSES, type ShortageRowDto } from '@/shared'

function LimitsDialog({ row, onClose }: { row: ShortageRowDto; onClose: () => void }) {
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
          <DialogTitle>Limits · {row.name}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          {(['minWeight', 'maxWeight', 'minPcs', 'maxPcs'] as const).map((k) => (
            <div key={k} className="space-y-1.5">
              <Label htmlFor={`sl-${k}`}>{k}</Label>
              <Input id={`sl-${k}`} type="number" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={updateGroup.isPending || updateName.isPending}>Save limits</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const CLASS_LABEL: Record<string, string> = { GOLD: 'Gold', SILVER: 'Silver', STONE: 'Stone', ARTIFICIAL: 'Artificial', FRANCHISE: 'Franchise' }
const badge = (s: string) => (s === 'SHORTAGE' ? 'destructive' : s === 'WARNING' ? 'secondary' : 'default')

export function Shortage() {
  const { can } = useAuth()
  const canEdit = can('inventory.item_masters', 'edit')
  const [stockClass, setStockClass] = useState('')
  const [status, setStatus] = useState('')
  const { data, isLoading } = useShortage({ stockClass: stockClass || undefined, status: status || undefined })
  const [editing, setEditing] = useState<ShortageRowDto | null>(null)

  // Summary counts derived from the rows already fetched (no extra requests).
  const rows = data ?? []
  const underMin = rows.filter((r) => r.status === 'SHORTAGE').length
  const nearMin = rows.filter((r) => r.status === 'WARNING').length
  const healthy = rows.filter((r) => r.status === 'OK').length

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
        {tile('Rows listed', data ? String(rows.length) : '—', 'Matching current filters', Layers)}
        {tile('Under minimum', data ? String(underMin) : '—', 'Reorder now', PackageX)}
        {tile('Near minimum', data ? String(nearMin) : '—', 'Within 20% above min', TrendingDown)}
        {tile('Healthy', data ? String(healthy) : '—', 'No reorder needed', PackageCheck)}
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 pt-6">
          <Select value={stockClass || 'all'} onValueChange={(v) => setStockClass(v === 'all' ? '' : v)}>
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
          <Select value={status || 'all'} onValueChange={(v) => setStatus(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-40" aria-label="Status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="SHORTAGE">Shortage</SelectItem>
              <SelectItem value="WARNING">Warning</SelectItem>
              <SelectItem value="OK">OK</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card className="overflow-x-auto p-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Level</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Class</TableHead>
              <TableHead>Current</TableHead>
              <TableHead>Min / Max</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">Loading…</TableCell></TableRow>
            ) : data?.length ? (
              data.map((r) => (
                <TableRow key={`${r.level}-${r.id}`}>
                  <TableCell className="text-muted-foreground">{r.level}</TableCell>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell>{CLASS_LABEL[r.stockClass]}</TableCell>
                  <TableCell className="tabular-nums">{r.currentWeight} g · {plural(r.currentPcs, 'pc')}</TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">{r.minWeight ?? '—'} / {r.maxWeight ?? '—'}</TableCell>
                  <TableCell><Badge variant={badge(r.status)}>{r.status}</Badge></TableCell>
                  <TableCell>{canEdit && <Button variant="ghost" size="sm" onClick={() => setEditing(r)}>Edit limits</Button>}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  <div className="flex flex-col items-center justify-center gap-2 py-4">
                    <span className="icon-chip"><PackageCheck className="size-5" aria-hidden /></span>
                    <span>Nothing below minimum</span>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
      {editing && <LimitsDialog row={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}
