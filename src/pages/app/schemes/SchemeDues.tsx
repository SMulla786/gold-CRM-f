import { Fragment, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { downloadCsv } from '@/lib/csv'
import { useSchemeDues, useSchemes } from '@/lib/schemesQueries'
import { businessDayISO, type SchemeDueRowDto } from '@/shared'

const inr = (s: string | number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(s))
const date = (s: string) => new Date(s).toLocaleDateString('en-IN')

function DueRow({ d }: { d: SchemeDueRowDto }) {
  return (
    <TableRow>
      <TableCell className="font-medium">{d.assignId}</TableCell><TableCell>{d.displayName}</TableCell>
      <TableCell>{d.scheme.name}</TableCell><TableCell>{d.group?.name ?? '—'}</TableCell>
      <TableCell className="tabular-nums">{inr(d.emiAmount)}</TableCell><TableCell className="tabular-nums">{d.emisDue}</TableCell>
      <TableCell className="tabular-nums font-medium">{inr(d.dueAmount)}</TableCell><TableCell>{date(d.oldestDueDate)}</TableCell>
    </TableRow>
  )
}

export function SchemeDues() {
  const [schemeId, setSchemeId] = useState('')
  const [groupWise, setGroupWise] = useState(false)
  const { data: schemes } = useSchemes({ active: 'true', pageSize: 100 })
  const { data: dues, isLoading } = useSchemeDues({ schemeId: schemeId ? Number(schemeId) : undefined })
  const grouped = useMemo(() => {
    const m: Record<string, SchemeDueRowDto[]> = {}
    for (const d of dues ?? []) (m[d.group?.name ?? 'No group'] ??= []).push(d)
    return Object.entries(m).sort((a, b) => a[0].localeCompare(b[0]))
  }, [dues])

  const exportCsv = () => {
    const rows = [['Assign', 'Member', 'Mobile', 'Scheme', 'Group', 'EMI', 'Due count', 'Due amount', 'Oldest due']]
    for (const d of dues ?? []) rows.push([d.assignId, d.displayName, d.party.mobile ?? '', d.scheme.name, d.group?.name ?? '', d.emiAmount, String(d.emisDue), d.dueAmount, date(d.oldestDueDate)])
    downloadCsv(`scheme-dues-${businessDayISO()}.csv`, rows)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={schemeId || 'all'} onValueChange={(v) => setSchemeId(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-56" aria-label="Scheme"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All schemes</SelectItem>{schemes?.items.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={() => setGroupWise((v) => !v)}>{groupWise ? 'Flat list' : 'Group-wise'}</Button>
        <Button className="ml-auto" variant="outline" size="sm" disabled={!dues?.length} onClick={exportCsv}>Export CSV</Button>
      </div>
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader><TableRow><TableHead>Assign</TableHead><TableHead>Member</TableHead><TableHead>Scheme</TableHead><TableHead>Group</TableHead><TableHead>EMI</TableHead><TableHead>Due</TableHead><TableHead>Amount</TableHead><TableHead>Oldest</TableHead></TableRow></TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={8} className="h-16 text-center text-muted-foreground">Loading…</TableCell></TableRow>
              : !dues?.length ? <TableRow><TableCell colSpan={8} className="h-16 text-center text-muted-foreground">No dues</TableCell></TableRow>
              : groupWise ? grouped.map(([name, items]) => (
                  <Fragment key={`g-${name}`}>
                    <TableRow className="bg-muted/50">
                      <TableCell colSpan={5} className="font-semibold">{name} <span className="font-normal text-muted-foreground">· {items.length}</span></TableCell>
                      <TableCell className="tabular-nums">{items.reduce((a, d) => a + d.emisDue, 0)}</TableCell>
                      <TableCell className="tabular-nums font-semibold">{inr(items.reduce((a, d) => a + Number(d.dueAmount), 0))}</TableCell>
                      <TableCell />
                    </TableRow>
                    {items.map((d) => <DueRow key={d.enrollmentId} d={d} />)}
                  </Fragment>
                ))
              : dues.map((d) => <DueRow key={d.enrollmentId} d={d} />)}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
