import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useShortage, useUpdateItemGroup, useUpdateItemName } from '@/lib/inventoryQueries'
import { useAuth } from '@/lib/auth'
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
        <div className="grid grid-cols-2 gap-3">
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
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
      </div>

      <div className="rounded-md border">
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
                  <TableCell>{r.currentWeight} g · {r.currentPcs} pcs</TableCell>
                  <TableCell className="text-muted-foreground">{r.minWeight ?? '—'} / {r.maxWeight ?? '—'}</TableCell>
                  <TableCell><Badge variant={badge(r.status)}>{r.status}</Badge></TableCell>
                  <TableCell>{canEdit && <Button variant="ghost" size="sm" onClick={() => setEditing(r)}>Edit limits</Button>}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">Nothing below minimum</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {editing && <LimitsDialog row={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}
