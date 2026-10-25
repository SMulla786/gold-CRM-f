import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { downloadCsv } from '@/lib/csv'
import { useSchemeDues, useSchemes } from '@/lib/schemesQueries'

const inr = (s: string) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(s))
const date = (s: string) => new Date(s).toLocaleDateString('en-IN')

export function SchemeDues() {
  const [schemeId, setSchemeId] = useState('')
  const { data: schemes } = useSchemes({ active: 'true', pageSize: 100 })
  const { data: dues, isLoading } = useSchemeDues({ schemeId: schemeId ? Number(schemeId) : undefined })

  const exportCsv = () => {
    const rows = [['Assign', 'Member', 'Mobile', 'Scheme', 'Group', 'EMI', 'Due count', 'Due amount', 'Oldest due']]
    for (const d of dues ?? []) rows.push([d.assignId, d.displayName, d.party.mobile ?? '', d.scheme.name, d.group?.name ?? '', d.emiAmount, String(d.emisDue), d.dueAmount, date(d.oldestDueDate)])
    downloadCsv(`scheme-dues-${new Date().toISOString().slice(0, 10)}.csv`, rows)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={schemeId || 'all'} onValueChange={(v) => setSchemeId(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-56" aria-label="Scheme"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All schemes</SelectItem>{schemes?.items.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
        </Select>
        <Button className="ml-auto" variant="outline" size="sm" disabled={!dues?.length} onClick={exportCsv}>Export CSV</Button>
      </div>
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader><TableRow><TableHead>Assign</TableHead><TableHead>Member</TableHead><TableHead>Scheme</TableHead><TableHead>Group</TableHead><TableHead>EMI</TableHead><TableHead>Due</TableHead><TableHead>Amount</TableHead><TableHead>Oldest</TableHead></TableRow></TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={8} className="h-16 text-center text-muted-foreground">Loading…</TableCell></TableRow>
              : dues?.length ? dues.map((d) => (
                <TableRow key={d.enrollmentId}>
                  <TableCell className="font-medium">{d.assignId}</TableCell><TableCell>{d.displayName}</TableCell>
                  <TableCell>{d.scheme.name}</TableCell><TableCell>{d.group?.name ?? '—'}</TableCell>
                  <TableCell className="tabular-nums">{inr(d.emiAmount)}</TableCell><TableCell className="tabular-nums">{d.emisDue}</TableCell>
                  <TableCell className="tabular-nums font-medium">{inr(d.dueAmount)}</TableCell><TableCell>{date(d.oldestDueDate)}</TableCell>
                </TableRow>
              )) : <TableRow><TableCell colSpan={8} className="h-16 text-center text-muted-foreground">No dues</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
