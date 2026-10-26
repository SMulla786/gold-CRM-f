import { ClipboardList, Coins, Gem, Hourglass, Inbox, Printer, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { PartyCombobox } from '@/components/PartyCombobox'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAuth } from '@/lib/auth'
import { useKarigarIssues, useReceiveKarigarIssue } from '@/lib/ordersQueries'
import type { KarigarIssueDto, PartyRefDto } from '@/shared'

const date = (s: string) => new Date(s).toLocaleDateString('en-IN')
const n = (s: string) => Number(s) || 0
// same choices as DataTable's entries picker (backend max 100)
const PAGE_SIZES = [10, 20, 50, 100]

interface RItem { orderItemId: number; label: string; returnedGross: string; returnedLess: string; touch: string; ghatAllowance: string; labour: string; tagNo: string }

function ReceiveDialog({ issue, onClose }: { issue: KarigarIssueDto; onClose: () => void }) {
  const receive = useReceiveKarigarIssue()
  const [items, setItems] = useState<RItem[]>(
    issue.items.filter((it) => it.status === 'ASSIGNED').map((it) => ({ orderItemId: it.id, label: `${it.itemName.name} (ord #${it.order.orderNo})`, returnedGross: it.gross, returnedLess: it.less, touch: it.touch, ghatAllowance: '0', labour: '0', tagNo: '' })),
  )
  const set = (i: number, k: keyof RItem, v: string) => setItems((rs) => rs.map((r, j) => (j === i ? { ...r, [k]: v } : r)))
  const ok = items.every((r) => n(r.returnedGross) > 0)
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader><DialogTitle>Receive from {issue.karigar.name} · issue #{issue.issueNo}</DialogTitle></DialogHeader>
        <Card className="overflow-x-auto p-2">
          <Table>
            <TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Ret. gross</TableHead><TableHead>Less</TableHead><TableHead>Touch</TableHead><TableHead>Ghat (g)</TableHead><TableHead>Labour ₹</TableHead><TableHead>Tag</TableHead></TableRow></TableHeader>
            <TableBody>
              {items.map((r, i) => (
                <TableRow key={r.orderItemId}>
                  <TableCell className="text-sm">{r.label}</TableCell>
                  <TableCell><Input className="w-20" type="number" step="0.001" aria-label="Returned gross" value={r.returnedGross} onChange={(e) => set(i, 'returnedGross', e.target.value)} /></TableCell>
                  <TableCell><Input className="w-16" type="number" step="0.001" aria-label="Returned less" value={r.returnedLess} onChange={(e) => set(i, 'returnedLess', e.target.value)} /></TableCell>
                  <TableCell><Input className="w-16" type="number" step="0.01" aria-label="Touch" value={r.touch} onChange={(e) => set(i, 'touch', e.target.value)} /></TableCell>
                  <TableCell><Input className="w-16" type="number" step="0.001" aria-label="Ghat" value={r.ghatAllowance} onChange={(e) => set(i, 'ghatAllowance', e.target.value)} /></TableCell>
                  <TableCell><Input className="w-20" type="number" aria-label="Labour" value={r.labour} onChange={(e) => set(i, 'labour', e.target.value)} /></TableCell>
                  <TableCell><Input className="w-24" aria-label="Tag" placeholder="auto" value={r.tagNo} onChange={(e) => set(i, 'tagNo', e.target.value.toUpperCase())} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
        <DialogFooter>
          <Button disabled={!ok || receive.isPending} onClick={async () => {
            await receive.mutateAsync({ id: issue.id, body: { items: items.map((r) => ({ orderItemId: r.orderItemId, returnedGross: n(r.returnedGross), returnedLess: n(r.returnedLess), touch: r.touch !== '' ? n(r.touch) : undefined, ghatAllowance: n(r.ghatAllowance), labour: n(r.labour), tagNo: r.tagNo || undefined })) } })
            onClose()
          }}>Receive & tag finished pieces</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function KarigarIssues() {
  const { can } = useAuth()
  const canReceive = can('orders.karigar_list', 'edit')
  const [status, setStatus] = useState('OPEN')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [q, setQ] = useState('')
  const [karigar, setKarigar] = useState<PartyRefDto | null>(null)
  const { data, isLoading } = useKarigarIssues({ status: status || undefined, q: q.trim() || undefined, karigarId: karigar?.id, page, pageSize })
  const pageCount = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1
  const [receiving, setReceiving] = useState<KarigarIssueDto | null>(null)

  // Summary numbers derived from the page already fetched (no extra requests).
  const shown = data?.items ?? []
  const openShown = shown.filter((iss) => iss.status === 'OPEN').length
  const piecesShown = shown.reduce((sum, iss) => sum + iss.items.length, 0)
  const goldShown = shown.reduce((sum, iss) => sum + n(iss.goldFine), 0)
  const silverShown = shown.reduce((sum, iss) => sum + n(iss.silverFine), 0)

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
        {tile('Issues', data ? String(data.total) : '—', 'Matching current filter', ClipboardList)}
        {tile('Open on this page', data ? String(openShown) : '—', data ? `of ${shown.length} shown · ${piecesShown} pieces` : undefined, Hourglass)}
        {tile('Gold fine on this page', data ? `${goldShown.toFixed(3)} g` : '—', 'Fine metal sent out', Coins)}
        {tile('Silver fine on this page', data ? `${silverShown.toFixed(3)} g` : '—', 'Fine metal sent out', Gem)}
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 pt-6">
          <Select value={status || 'all'} onValueChange={(v) => { setStatus(v === 'all' ? '' : v); setPage(1) }}>
            <SelectTrigger className="w-44" aria-label="Issue status"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="OPEN">Open</SelectItem><SelectItem value="RECEIVED">Received</SelectItem><SelectItem value="CANCELLED">Cancelled</SelectItem></SelectContent>
          </Select>
          <Input className="max-w-xs" aria-label="Search issues" placeholder="Search karigar / order no / item…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} />
          <div className="w-64">
            <PartyCombobox value={karigar} onChange={(p) => { setKarigar(p); setPage(1) }} type="KARIGAR" ariaLabel="Filter by karigar" placeholder="All karigars" />
          </div>
          {karigar && <Button variant="ghost" size="sm" onClick={() => { setKarigar(null); setPage(1) }}>Clear filter</Button>}
        </CardContent>
      </Card>

      {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : data?.items.length ? (
        <div className="stagger grid gap-4">
          {data.items.map((iss) => (
            <Card key={iss.id}>
              <CardHeader className="flex-row items-start justify-between gap-3 pb-2">
                <CardTitle className="text-sm">Issue #{iss.issueNo} · {iss.karigar.name} <Badge variant={iss.status === 'OPEN' ? 'secondary' : 'default'} className="ml-2">{iss.status}</Badge></CardTitle>
                <div className="flex shrink-0 gap-2">
                  <Button asChild size="sm" variant="outline"><Link to={`/app/orders/karigar/${iss.id}/print`}><Printer className="size-4" aria-hidden />Print slip</Link></Button>
                  {canReceive && iss.status === 'OPEN' && <Button size="sm" onClick={() => setReceiving(iss)}>Receive</Button>}
                </div>
              </CardHeader>
              <CardContent className="space-y-1 text-sm text-muted-foreground">
                <div>{date(iss.issueDate)}{iss.dueDate ? ` · due ${date(iss.dueDate)}` : ''} · issued {Number(iss.goldFine) ? `${iss.goldFine}g Au ` : ''}{Number(iss.silverFine) ? `${iss.silverFine}g Ag ` : ''}{Number(iss.cash) + Number(iss.online) > 0 ? `₹${Number(iss.cash) + Number(iss.online)}` : ''}{iss.wastagePercent != null ? ` · wastage ${iss.wastagePercent}%` : ''}{iss.wastageGm != null ? ` · wastage ${iss.wastageGm}g` : ''}</div>
                <div>{iss.items.map((it) => `${it.itemName.name} (ord #${it.order.orderNo})`).join(', ')}</div>
                <ul className="space-y-0.5 text-xs tabular-nums">
                  {iss.items.map((it) => (
                    <li key={it.id}>
                      {it.itemName.name} · {it.metal} {it.karatCode ?? ''} · {it.pcs} pc · gross {it.gross}g · fine {it.fine}g
                      {' · '}for {it.order.party?.name ?? '—'}{it.order.party?.mobile ? ` (${it.order.party.mobile})` : ''}
                      {it.status === 'RECEIVED' && ` · returned ${it.returnedGross ?? '—'}g / fine ${it.returnedFine ?? '—'}g · ghat ${it.ghatAllowance ?? '0.000'}g · charges ₹${it.karigarLabour ?? '0.00'}`}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
          {data.total > PAGE_SIZES[0] && (
            <div className="flex flex-wrap items-center justify-end gap-2 text-sm">
              <label className="mr-auto flex items-center gap-2 text-muted-foreground">
                Entries
                <select className="h-8 rounded-lg border bg-card px-2 text-foreground" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }}>
                  {PAGE_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              <span className="text-muted-foreground">Page {data.page} of {pageCount} · {data.total} issues</span>
              {pageCount > 1 && <>
                <Button variant="outline" size="sm" disabled={data.page <= 1} onClick={() => setPage(data.page - 1)}>Previous</Button>
                <Button variant="outline" size="sm" disabled={data.page >= pageCount} onClick={() => setPage(data.page + 1)}>Next</Button>
              </>}
            </div>
          )}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <span className="icon-chip"><Inbox className="size-5" aria-hidden /></span>
            <p className="text-sm text-muted-foreground">No issues.</p>
          </CardContent>
        </Card>
      )}

      {receiving && <ReceiveDialog issue={receiving} onClose={() => setReceiving(null)} />}
    </div>
  )
}
