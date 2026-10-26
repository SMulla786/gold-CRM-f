import { CalendarClock, CircleCheck, IndianRupee, Layers, Users, type LucideIcon } from 'lucide-react'
import { Fragment, useMemo, useState } from 'react'
import { flushSync } from 'react-dom'
import { useSearchParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { downloadCsv } from '@/lib/csv'
import { downloadPdf } from '@/lib/share'
import { useSchemeDueMonths, useSchemeDues, useSchemeGroups, useSchemes } from '@/lib/schemesQueries'
import { businessDayISO, SCHEME_KINDS, type SchemeDueRowDto } from '@/shared'
import { ClientPager, useClientPage } from './ClientPager'

const inr = (s: string | number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(s))
const date = (s: string) => new Date(s).toLocaleDateString('en-IN')
const KIND_LABEL: Record<string, string> = { SAVING: 'Saving', ANJUMAN: 'Anjuman' }
type View = 'flat' | 'group' | 'scheme' | 'month'

function DueRow({ d, sn }: { d: SchemeDueRowDto; sn: number }) {
  return (
    <TableRow>
      <TableCell className="tabular-nums text-muted-foreground">{sn}</TableCell>
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
  const [schemeId, setSchemeId] = useState(sp.get('schemeId') ?? '')
  const [groupId, setGroupId] = useState('')
  const [customer, setCustomer] = useState('')
  const [view, setView] = useState<View>('flat')
  const { data: schemes } = useSchemes({ active: 'true', kind: kind || undefined, pageSize: 100 })
  const { data: groups } = useSchemeGroups(schemeId ? Number(schemeId) : undefined)
  const filters = { kind: kind || undefined, schemeId: schemeId ? Number(schemeId) : undefined, groupId: groupId ? Number(groupId) : undefined, q: customer.trim() || undefined }
  const { data: dues, isLoading } = useSchemeDues(filters)
  const { data: months, isLoading: monthsLoading } = useSchemeDueMonths(filters, view === 'month')
  const grouped = useMemo(() => bucket(dues ?? [], (d) => d.group?.name ?? 'No group'), [dues])
  const bySchemes = useMemo(() => bucket(dues ?? [], (d) => d.scheme.name), [dues])
  // on-screen paging only (flat + per-month lists); CSV/PDF still export every row
  const duePage = useClientPage(dues)
  const monthPage = useClientPage(months)

  const exportCsv = () => {
    const rows = [['Assign', 'Member', 'Mobile', 'Scheme', 'Group', 'EMI', 'Due count', 'Due amount', 'Oldest due']]
    for (const d of dues ?? []) rows.push([d.assignId, d.displayName, d.party.mobile ?? '', d.scheme.name, d.group?.name ?? '', d.emiAmount, String(d.emisDue), d.dueAmount, date(d.oldestDueDate)])
    downloadCsv(`scheme-dues-${businessDayISO()}.csv`, rows)
  }

  // PDF = browser print of the filtered list (the endpoint is unpaged, so these are all rows) via the hidden .print-area.
  const [printing, setPrinting] = useState(false)
  const exportPdf = () => {
    flushSync(() => setPrinting(true))
    window.addEventListener('afterprint', () => setPrinting(false), { once: true })
    downloadPdf()
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
          <Button variant="outline" size="sm" onClick={() => setView((v) => (v === 'month' ? 'flat' : 'month'))}>{view === 'month' ? 'Flat list' : 'Per month'}</Button>
          <Button className="ml-auto" variant="outline" size="sm" disabled={!dues?.length} onClick={exportCsv}>Export CSV</Button>
          <Button variant="outline" size="sm" disabled={!dues?.length} onClick={exportPdf}>Export PDF</Button>
        </CardContent>
      </Card>

      <Card className="overflow-x-auto p-2">
        {view === 'month' ? (
          <Table>
            <TableHeader><TableRow><TableHead>S.N.</TableHead><TableHead>Assign</TableHead><TableHead>Member</TableHead><TableHead>Contact</TableHead><TableHead>Scheme</TableHead><TableHead>Group</TableHead><TableHead>EMI #</TableHead><TableHead>EMI date</TableHead><TableHead>Amount</TableHead></TableRow></TableHeader>
            <TableBody>
              {monthsLoading ? <TableRow><TableCell colSpan={9} className="h-16 text-center text-muted-foreground">Loading…</TableCell></TableRow>
                : !months?.length ? empty(9)
                : monthPage.pageRows.map((m, i) => (
                    <TableRow key={`${m.enrollmentId}-${m.emiNo}`}>
                      <TableCell className="tabular-nums text-muted-foreground">{monthPage.start + i + 1}</TableCell><TableCell className="font-medium">{m.assignId}</TableCell>
                      <TableCell>{m.party?.name}</TableCell><TableCell className="tabular-nums">{m.party?.mobile || '—'}</TableCell>
                      <TableCell>{m.scheme.name}</TableCell><TableCell>{m.group?.name ?? '—'}</TableCell>
                      <TableCell className="tabular-nums">{m.emiNo}</TableCell><TableCell>{date(m.emiDate)}</TableCell><TableCell className="tabular-nums font-medium">{inr(m.amount)}</TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
        ) : view === 'scheme' ? (
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
            <TableHeader><TableRow><TableHead>S.N.</TableHead><TableHead>Assign</TableHead><TableHead>Member</TableHead><TableHead>Contact</TableHead><TableHead>Scheme</TableHead><TableHead>Group</TableHead><TableHead>EMI</TableHead><TableHead>Due</TableHead><TableHead>Amount</TableHead><TableHead>Oldest</TableHead></TableRow></TableHeader>
            <TableBody>
              {isLoading ? <TableRow><TableCell colSpan={10} className="h-16 text-center text-muted-foreground">Loading…</TableCell></TableRow>
                : !dues?.length ? empty(10)
                : view === 'group' ? grouped.map(([name, items]) => (
                    <Fragment key={`g-${name}`}>
                      <TableRow className="bg-muted/50">
                        <TableCell colSpan={7} className="font-semibold">{name} <span className="font-normal text-muted-foreground">· {items.length}</span></TableCell>
                        <TableCell className="tabular-nums">{sumEmis(items)}</TableCell>
                        <TableCell className="tabular-nums font-semibold">{sumDue(items)}</TableCell>
                        <TableCell />
                      </TableRow>
                      {items.map((d, i) => <DueRow key={d.enrollmentId} d={d} sn={i + 1} />)}
                    </Fragment>
                  ))
                : duePage.pageRows.map((d, i) => <DueRow key={d.enrollmentId} d={d} sn={duePage.start + i + 1} />)}
            </TableBody>
          </Table>
        )}
        {view === 'flat' && <ClientPager {...duePage.pager} />}
        {view === 'month' && <ClientPager {...monthPage.pager} />}
      </Card>

      {printing && dues && (
        <div className="print-area hidden print:block">
          <h2 className="mb-1 text-lg font-semibold">Scheme dues · {businessDayISO()}</h2>
          <p className="mb-3 text-xs">{dues.length} members · {dueEmis} EMIs · {inr(dueTotal)}</p>
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b text-left">{['S.N.', 'Assign', 'Member', 'Contact', 'Scheme', 'Group', 'EMI', 'Due', 'Amount', 'Oldest'].map((h) => <th key={h} className="p-1">{h}</th>)}</tr>
            </thead>
            <tbody>
              {dues.map((d, i) => (
                <tr key={d.enrollmentId} className="border-b">
                  <td className="p-1">{i + 1}</td><td className="p-1">{d.assignId}</td><td className="p-1">{d.displayName}</td><td className="p-1">{d.party?.mobile ?? ''}</td>
                  <td className="p-1">{d.scheme.name}</td><td className="p-1">{d.group?.name ?? '—'}</td><td className="p-1">{inr(d.emiAmount)}</td>
                  <td className="p-1">{d.emisDue}</td><td className="p-1">{inr(d.dueAmount)}</td><td className="p-1">{date(d.oldestDueDate)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-semibold"><td className="p-1" colSpan={7}>Total</td><td className="p-1">{dueEmis}</td><td className="p-1">{inr(dueTotal)}</td><td /></tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
