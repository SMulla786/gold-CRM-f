import { CircleCheck, CircleOff, FileDigit, Layers, type LucideIcon } from 'lucide-react'
import { useState } from 'react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useHsn, useToggleHsn } from '@/lib/appQueries'
import { useAuth } from '@/lib/auth'
import { HSN_CATEGORIES } from '@/shared'

export function Hsn() {
  const { can } = useAuth()
  const canEdit = can('settings.misc', 'edit')
  const [q, setQ] = useState('')
  const [category, setCategory] = useState('')
  const [onlyActive, setOnlyActive] = useState(false)
  const { data, isLoading } = useHsn({ q: q || undefined, category: category || undefined, onlyActive: onlyActive ? 'true' : undefined })
  const toggle = useToggleHsn()

  // Summary numbers derived from the list already fetched (no extra requests).
  const rows = data ?? []
  const enabledCount = rows.filter((h) => h.active).length
  const categoryCount = new Set(rows.map((h) => h.category)).size
  const rateSlabs = new Set(rows.map((h) => h.gstRate)).size

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
        {tile('Codes listed', data ? String(rows.length) : '—', 'Matching current filters', FileDigit)}
        {tile('Enabled for use', data ? String(enabledCount) : '—', data ? `of ${rows.length} listed` : undefined, CircleCheck)}
        {tile('Not in use', data ? String(rows.length - enabledCount) : '—', 'Switched off for this business', CircleOff)}
        {tile('Categories', data ? String(categoryCount) : '—', data ? `${rateSlabs} tax rate slabs` : undefined, Layers)}
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 pt-6">
          <Input className="max-w-xs" placeholder="Search HSN / product…" value={q} onChange={(e) => setQ(e.target.value)} />
          <Select value={category || 'all'} onValueChange={(v) => setCategory(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-44" aria-label="Category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {HSN_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c.charAt(0) + c.slice(1).toLowerCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <label className="flex h-9 items-center gap-2 text-sm">
            <Checkbox checked={onlyActive} onCheckedChange={(v) => setOnlyActive(Boolean(v))} />
            Show active (ON) HSN codes only
          </label>
        </CardContent>
      </Card>

      <Card className="overflow-x-auto p-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Use</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>HSN</TableHead>
              <TableHead>GST %</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">Loading…</TableCell>
              </TableRow>
            ) : data?.length ? (
              data.map((h) => (
                <TableRow key={h.id}>
                  <TableCell>
                    <Checkbox aria-label={`Enable HSN ${h.code}`} checked={h.active} disabled={!canEdit} onCheckedChange={(v) => toggle.mutate({ id: h.id, active: Boolean(v) })} />
                  </TableCell>
                  <TableCell>{h.category}</TableCell>
                  <TableCell>{h.productType}</TableCell>
                  <TableCell>{h.code}</TableCell>
                  <TableCell>{h.gstRate}%</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  <div className="flex flex-col items-center justify-center gap-2 py-4">
                    <span className="icon-chip"><FileDigit className="size-5" aria-hidden /></span>
                    No HSN codes
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
