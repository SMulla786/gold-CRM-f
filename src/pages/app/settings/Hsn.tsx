import { useState } from 'react'

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
  const { data, isLoading } = useHsn({ q: q || undefined, category: category || undefined })
  const toggle = useToggleHsn()

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
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
      </div>

      <div className="rounded-md border">
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
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">No HSN codes</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
