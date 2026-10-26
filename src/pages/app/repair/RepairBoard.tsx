import { CalendarClock, Inbox, PackageCheck, Search, Wrench, Zap, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/lib/auth'
import { useRepairs, useRepairStatus } from '@/lib/repairQueries'
import { businessDayISO, type RepairTicketDto } from '@/shared'

import { AssignKarigarDialog, DeliverDialog, NewTicketDialog, QADialog, RepairThumb, TicketDetailsDialog } from './RepairDialogs'
import { RepairTabs } from './RepairTabs'
import { ASSIGNABLE, date, inr, n } from './repairUtils'

const today = businessDayISO
const COLUMNS = ['RECEIVED', 'IN_PROGRESS', 'IN_REVIEW', 'READY'] as const
const COL_LABEL: Record<string, string> = { RECEIVED: 'Received', IN_PROGRESS: 'In progress', IN_REVIEW: 'In review (QA)', READY: 'Ready' }
const NEXT: Record<string, 'IN_PROGRESS' | 'IN_REVIEW'> = { RECEIVED: 'IN_PROGRESS', IN_PROGRESS: 'IN_REVIEW' }

export function RepairBoard() {
  const { can } = useAuth()
  const canEdit = can('repair.entry', 'edit')
  const [q, setQ] = useState('')
  const kw = q.trim() || undefined
  // One query per open column so closed tickets never eat into the 100-row cap; closed ones only need totals.
  // shortcut: each column still shows at most 100 tickets, use the ledger for more.
  const received = useRepairs({ q: kw, status: 'RECEIVED', page: 1, pageSize: 100 })
  const inProgress = useRepairs({ q: kw, status: 'IN_PROGRESS', page: 1, pageSize: 100 })
  const inReview = useRepairs({ q: kw, status: 'IN_REVIEW', page: 1, pageSize: 100 })
  const ready = useRepairs({ q: kw, status: 'READY', page: 1, pageSize: 100 })
  const deliveredTotal = useRepairs({ q: kw, status: 'DELIVERED', page: 1, pageSize: 1 }).data?.total ?? 0
  const cancelledTotal = useRepairs({ q: kw, status: 'CANCELLED', page: 1, pageSize: 1 }).data?.total ?? 0
  const open = [received, inProgress, inReview, ready]
  const isLoading = open.some((r) => r.isLoading)
  const loaded = open.every((r) => r.data)
  const openTotal = open.reduce((sum, r) => sum + (r.data?.total ?? 0), 0)
  const [creating, setCreating] = useState(false)
  const [qa, setQa] = useState<RepairTicketDto | null>(null)
  const [deliver, setDeliver] = useState<RepairTicketDto | null>(null)
  const [assign, setAssign] = useState<RepairTicketDto | null>(null)
  const [detailsId, setDetailsId] = useState<number | null>(null)
  const move = useRepairStatus()

  const tickets = open.flatMap((r) => r.data?.items ?? [])
  const byStatus = (s: string) => tickets.filter((t) => t.status === s)

  // Summary numbers derived from the tickets already fetched (no extra requests).
  const openRows = tickets.filter((t) => (COLUMNS as readonly string[]).includes(t.status))
  const readyRows = byStatus('READY')
  const readyBalance = readyRows.reduce((sum, t) => sum + n(t.balance), 0)
  const priorityOpen = openRows.filter((t) => t.priority !== 'NORMAL').length
  const overdueOpen = openRows.filter((t) => t.expectedDate.slice(0, 10) < today()).length

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
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1>Repairs</h1>
          <p className="mt-1 text-sm text-muted-foreground">Track job-work tickets from intake through QA to handover.</p>
        </div>
        {canEdit && <Button onClick={() => setCreating(true)}>New ticket</Button>}
      </header>

      <RepairTabs />

      <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tile('Open tickets', loaded ? String(openTotal) : '—', loaded ? `${openRows.length} of ${openTotal} open tickets loaded` : undefined, Wrench)}
        {tile('Ready for pickup', loaded ? String(readyRows.length) : '—', loaded ? `${inr(String(readyBalance))} est. to collect` : undefined, PackageCheck)}
        {tile('Urgent / express', loaded ? String(priorityOpen) : '—', loaded ? 'Open tickets with high priority' : undefined, Zap)}
        {tile('Overdue', loaded ? String(overdueOpen) : '—', loaded ? 'Open tickets past expected date' : undefined, CalendarClock)}
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl">Board</h2>
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input className="pl-9" aria-label="Search the board" placeholder="Ticket no / customer / mobile…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="stagger grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {COLUMNS.map((col) => (
              <Card key={col} className="space-y-3 p-3">
                <div className="px-1 pt-1 text-sm font-semibold">{COL_LABEL[col]} <span className="font-medium tabular-nums text-muted-foreground">({byStatus(col).length})</span></div>
                {byStatus(col).map((t) => (
                  <div key={t.id} className="space-y-1.5 rounded-2xl border bg-background p-3 text-sm shadow-xs transition-shadow hover:shadow-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">#{t.ticketNo} {t.category}</span>
                      {t.priority !== 'NORMAL' && <Badge variant="destructive">{t.priority}</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground">{t.party.name} · {t.metal} · {t.gross}g · due {date(t.expectedDate)}</div>
                    <div className="flex items-start gap-2">
                      <RepairThumb ticket={t} />
                      <div className="text-xs text-muted-foreground">{t.subCategory ? `${t.subCategory} · ` : ''}{t.description}</div>
                    </div>
                    {t.karigar && <div className="text-xs text-muted-foreground">Karigar: <span className="font-medium text-foreground">{t.karigar.name}</span></div>}
                    {t.remarks && <div className="rounded-lg bg-muted/60 px-2 py-1 text-xs text-muted-foreground">{t.remarks}</div>}
                    <div className="flex flex-wrap gap-1 pt-1">
                      {canEdit && NEXT[col] && <Button size="xs" variant="outline" onClick={() => move.mutate({ id: t.id, body: { status: NEXT[col] } })}>→ {COL_LABEL[NEXT[col]]}</Button>}
                      {canEdit && col === 'IN_REVIEW' && <Button size="xs" onClick={() => setQa(t)}>Pass QA</Button>}
                      {canEdit && col === 'READY' && <Button size="xs" onClick={() => setDeliver(t)}>Deliver</Button>}
                      {canEdit && ASSIGNABLE.includes(col) && <Button size="xs" variant="outline" onClick={() => setAssign(t)}>{t.karigar ? 'Change karigar' : 'Assign karigar'}</Button>}
                      <Button size="xs" variant="ghost" onClick={() => setDetailsId(t.id)}>Details</Button>
                      {canEdit && <Button size="xs" variant="ghost" onClick={() => move.mutate({ id: t.id, body: { status: 'CANCELLED' } })}>Cancel</Button>}
                    </div>
                  </div>
                ))}
                {byStatus(col).length === 0 && (
                  <div className="flex flex-col items-center gap-2 px-1 py-6 text-center">
                    <span className="icon-chip"><Inbox className="size-5" aria-hidden /></span>
                    <p className="text-xs text-muted-foreground">—</p>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          <Link to="/app/repair/ledger?status=DELIVERED" className="hover:text-foreground hover:underline">Delivered: {deliveredTotal}</Link>
          {' · '}
          <Link to="/app/repair/ledger?status=CANCELLED" className="hover:text-foreground hover:underline">Cancelled: {cancelledTotal}</Link>
        </p>
      </section>

      {creating && <NewTicketDialog onClose={() => setCreating(false)} />}
      {qa && <QADialog ticket={qa} onClose={() => setQa(null)} />}
      {deliver && <DeliverDialog ticket={deliver} onClose={() => setDeliver(null)} />}
      {assign && <AssignKarigarDialog ticket={assign} onClose={() => setAssign(null)} />}
      {detailsId != null && <TicketDetailsDialog id={detailsId} onClose={() => setDetailsId(null)} />}
    </div>
  )
}
