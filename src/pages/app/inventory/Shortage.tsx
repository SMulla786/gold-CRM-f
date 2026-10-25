import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useShortage } from '@/lib/inventoryQueries'
import { STOCK_CLASSES } from '@/shared'

const CLASS_LABEL: Record<string, string> = { GOLD: 'Gold', SILVER: 'Silver', STONE: 'Stone', ARTIFICIAL: 'Artificial', FRANCHISE: 'Franchise' }
const badge = (s: string) => (s === 'SHORTAGE' ? 'destructive' : s === 'WARNING' ? 'secondary' : 'default')

export function Shortage() {
  const [stockClass, setStockClass] = useState('')
  const [status, setStatus] = useState('')
  const { data, isLoading } = useShortage({ stockClass: stockClass || undefined, status: status || undefined })

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
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">Loading…</TableCell></TableRow>
            ) : data?.length ? (
              data.map((r) => (
                <TableRow key={`${r.level}-${r.id}`}>
                  <TableCell className="text-muted-foreground">{r.level}</TableCell>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell>{CLASS_LABEL[r.stockClass]}</TableCell>
                  <TableCell>{r.currentWeight} g · {r.currentPcs} pcs</TableCell>
                  <TableCell className="text-muted-foreground">{r.minWeight ?? '—'} / {r.maxWeight ?? '—'}</TableCell>
                  <TableCell><Badge variant={badge(r.status)}>{r.status}</Badge></TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">Nothing below minimum</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
