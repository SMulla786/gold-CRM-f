import { CalendarClock, CircleCheck, IndianRupee, Layers, Users, type LucideIcon } from 'lucide-react'
import { Fragment, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { downloadCsv } from '@/lib/csv'
import { useSchemeDues, useSchemeGroups, useSchemes } from '@/lib/schemesQueries'
import { businessDayISO, SCHEME_KINDS, type SchemeDueRowDto } from '@/shared'

const inr = (s: string | number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(s))
const date = (s: string) => new Date(s).toLocaleDateString('en-IN')
const KIND_LABEL: Record<string, string> = { SAVING: 'Saving', ANJUMAN: 'Anjuman' }
type View = 'flat' | 'group' | 'scheme'

function DueRow({ d }: { d: SchemeDueRowDto }) {
  return (
    <TableRow>
      <TableCell className="font-medium">{d.assignId}</TableCell><TableCell>{d.displayName}</TableCell>
      <TableCell className="tabular-nums">{d.party?.mobile || '—'}</TableCell>
      <TableCell>{d.scheme.name}</TableCell><TableCell>{d.group?.name ?? '—'}</TableCell>
      <TableCell className="tabular-nums">{inr(d.emiAmount)}</TableCell><TableCell className="tabular-nums">{d.emisDue}</TableCell>
      <TableCell className="tabular-nums font-medium">{inr(d.dueAmount)}</TableCell><TableCell>{date(d.oldestDueDate)}</TableCell>
    </TableRow>
  )
}

/** Rows bucketed by a label, sorted by label (group-wise / scheme-wise views). */
function bucket(rows: SchemeDueRowDto[], label: (d: SchemeDueRowDto) => string): [string, SchemeDueRowDto[]][] {
  const m: Record<string, SchemeDueRowDto[]> = {}
  for (const d of rows) (m[label(d)] ??= []).push(d)
  return Object.entries(m).sort((a, b) => a[0].localeCompare(b[0]))
}

export function SchemeDues() {
  const [sp] = useSearchParams()
  const [kind, setKind] = useState(sp.get('kind') ?? '')
  const [schemeId, setSchemeId] = useState('')
  const [groupId, setGroupId] = useState('')
  const [customer, setCustomer] = useState('')
  const [view, setView] = useState<View>('flat')
  const { data: schemes } = useSchemes({ active: 'true', kind: kind || undefined, pageSize: 100 })
  const { data: groups } = useSchemeGroups(schemeId ? Number(schemeId) : undefined)
  const { data: allDues, isLoading } = useSchemeDues({ kind: kind || undefined, schemeId: schemeId ? Number(schemeId) : undefined, groupId: groupId ? Number(groupId) : undefined })
  // Customer filter is client-side: /schemes/dues returns the full (unpaged) list and has no text query.
  const dues = useMemo(() => {
    const kw = customer.trim().toLowerCase()
    if (!kw || !allDues) return allDues
    return allDues.filter((d) => [d.displayName, d.assignId, d.party?.name ?? '', d.party?.mobile ?? ''].some((s) => s.toLowerCase().includes(kw)))
  }, [allDues, customer])
  const grouped = useMemo(() => bucket(dues ?? [], (d) => d.group?.name ?? 'No group'), [dues])
  const bySchemes = useMemo(() => bucket(dues ?? [], (d) => d.scheme.name), [dues])

  const exportCsv = () => {
    const rows = [['Assign', 'Member', 'Mobile', 'Scheme', 'Group', 'EMI', 'Due count', 'Due amount', 'Oldest due']]
    for (const d of dues ?? []) rows.push([d.assignId, d.displayName, d.party.mobile ?? '', d.scheme.name, d.group?.name ?? '', d.emiAmount, String(d.emisDue), d.dueAmount, date(d.oldestDueDate)])
    downloadCsv(`scheme-dues-${businessDayISO()}.csv`, rows)
  }

  // Summary numbers derived from the dues list already fetched (no extra requests).
  const dueEmis = (dues ?? []).reduce((sum, d) => sum + d.emisDue, 0)
  const dueTotal = (dues ?? []).reduce((sum, d) => sum + Number(d.dueAmount), 0)
  const emiTotal = (dues ?? []).reduce((sum, d) => sum + Number(d.emiAmount), 0)
  const sumEmis = (items: SchemeDueRowDto[]) => items.reduce((a, d) => a + d.emisDue, 0)
  const sumDue = (items: SchemeDueRowDto[]) => inr(items.reduce((a, d) => a + Number(d.dueAmount), 0))

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

  const empty = (cols: number) => (
    <TableRow>
      <TableCell colSpan={cols} className="h-32 text-center text-muted-foreground">
        <div className="flex flex-col items-center justify-center gap-2">
          <span className="icon-chip"><CircleCheck className="size-5" aria-hidden /></span>
          No dues
        </div>
      </TableCell>
    </TableRow>
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
          <Input className="max-w-xs" placeholder="Customer / mobile / assign…" aria-label="Customer" value={customer} onChange={(e) => setCustomer(e.target.value)} />
          <Select value={kind || 'all'} onValueChange={(v) => { setKind(v === 'all' ? '' : v); setSchemeId(''); setGroupId('') }}>
            <SelectTrigger className="w-36" aria-label="Kind"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All kinds</SelectItem>{SCHEME_KINDS.map((k) => <SelectItem key={k} value={k}>{KIND_LABEL[k]}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={schemeId || 'all'} onValueChange={(v) => { setSchemeId(v === 'all' ? '' : v); setGroupId('') }}>
            <SelectTrigger className="w-56" aria-label="Scheme"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All schemes</SelectItem>{schemes?.items.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={groupId || 'all'} onValueChange={(v) => setGroupId(v === 'all' ? '' : v)} disabled={!schemeId}>
            <SelectTrigger className="w-40" aria-label="Group" title={schemeId ? undefined : 'Pick a scheme first'}><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All groups</SelectItem>{groups?.map((g) => <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>)}</SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => setView((v) => (v === 'group' ? 'flat' : 'group'))}>{view === 'group' ? 'Flat list' : 'Group-wise'}</Button>
          <Button variant="outline" size="sm" onClick={() => setView((v) => (v === 'scheme' ? 'flat' : 'scheme'))}>{view === 'scheme' ? 'Flat list' : 'Scheme-wise'}</Button>
          <Button className="ml-auto" variant="outline" size="sm" disabled={!dues?.length} onClick={exportCsv}>Export CSV</Button>
        </CardContent>
      </Card>

      <Card className="overflow-x-auto p-2">
        {view === 'scheme' ? (
          <Table>
            <TableHeader><TableRow><TableHead>Scheme</TableHead><TableHead>Members</TableHead><TableHead>EMIs due</TableHead><TableHead>Amount</TableHead></TableRow></TableHeader>
            <TableBody>
              {isLoading ? <TableRow><TableCell colSpan={4} className="h-16 text-center text-muted-foreground">Loading…</TableCell></TableRow>
                : !dues?.length ? empty(4)
                : <>
                    {bySchemes.map(([name, items]) => (
                      <TableRow key={`s-${name}`}>
                        <TableCell className="font-medium">{name}</TableCell><TableCell className="tabular-nums">{items.length}</TableCell>
                        <TableCell className="tabular-nums">{sumEmis(items)}</TableCell><TableCell className="tabular-nums font-medium">{sumDue(items)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/50 font-semibold">
                      <TableCell>Total</TableCell><TableCell className="tabular-nums">{dues.length}</TableCell>
                      <TableCell className="tabular-nums">{dueEmis}</TableCell><TableCell className="tabular-nums">{inr(dueTotal)}</TableCell>
                    </TableRow>
                  </>}
            </TableBody>
          </Table>
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>Assign</TableHead><TableHead>Member</TableHead><TableHead>Contact</TableHead><TableHead>Scheme</TableHead><TableHead>Group</TableHead><TableHead>EMI</TableHead><TableHead>Due</TableHead><TableHead>Amount</TableHead><TableHead>Oldest</TableHead></TableRow></TableHeader>
            <TableBody>
              {isLoading ? <TableRow><TableCell colSpan={9} className="h-16 text-center text-muted-foreground">Loading…</TableCell></TableRow>
                : !dues?.length ? empty(9)
                : view === 'group' ? grouped.map(([name, items]) => (
                    <Fragment key={`g-${name}`}>
                      <TableRow className="bg-muted/50">
                        <TableCell colSpan={6} className="font-semibold">{name} <span className="font-normal text-muted-foreground">· {items.length}</span></TableCell>
                        <TableCell className="tabular-nums">{sumEmis(items)}</TableCell>
                        <TableCell className="tabular-nums font-semibold">{sumDue(items)}</TableCell>
                        <TableCell />
                      </TableRow>
                      {items.map((d) => <DueRow key={d.enrollmentId} d={d} />)}
                    </Fragment>
                  ))
                : dues.map((d) => <DueRow key={d.enrollmentId} d={d} />)}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  )
}
