import { CalendarClock, CircleCheck, IndianRupee, Layers, Users, type LucideIcon } from 'lucide-react'
import { Fragment, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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

  // Summary numbers derived from the dues list already fetched (no extra requests).
  const dueEmis = (dues ?? []).reduce((sum, d) => sum + d.emisDue, 0)
  const dueTotal = (dues ?? []).reduce((sum, d) => sum + Number(d.dueAmount), 0)
  const emiTotal = (dues ?? []).reduce((sum, d) => sum + Number(d.emiAmount), 0)

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
        {tile('Members with dues', dues ? String(dues.length) : '—', 'Matching current filter', Users)}
        {tile('EMIs pending', dues ? String(dueEmis) : '—', 'Instalments outstanding', CalendarClock)}
        {tile('Total outstanding', dues ? inr(dueTotal) : '—', 'Sum of instalments due', IndianRupee)}
        {tile('Groups affected', dues ? String(grouped.length) : '—', dues ? `Monthly instalments ${inr(emiTotal)}` : undefined, Layers)}
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 pt-6">
          <Select value={schemeId || 'all'} onValueChange={(v) => setSchemeId(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-56" aria-label="Scheme"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All schemes</SelectItem>{schemes?.items.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => setGroupWise((v) => !v)}>{groupWise ? 'Flat list' : 'Group-wise'}</Button>
          <Button className="ml-auto" variant="outline" size="sm" disabled={!dues?.length} onClick={exportCsv}>Export CSV</Button>
        </CardContent>
      </Card>

      <Card className="overflow-x-auto p-2">
        <Table>
          <TableHeader><TableRow><TableHead>Assign</TableHead><TableHead>Member</TableHead><TableHead>Scheme</TableHead><TableHead>Group</TableHead><TableHead>EMI</TableHead><TableHead>Due</TableHead><TableHead>Amount</TableHead><TableHead>Oldest</TableHead></TableRow></TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={8} className="h-16 text-center text-muted-foreground">Loading…</TableCell></TableRow>
              : !dues?.length ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <span className="icon-chip"><CircleCheck className="size-5" aria-hidden /></span>
                        No dues
                      </div>
                    </TableCell>
                  </TableRow>
                )
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
      </Card>
    </div>
  )
}
