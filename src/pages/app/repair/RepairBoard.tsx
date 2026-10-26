import { CalendarClock, Inbox, PackageCheck, Search, Wrench, Zap, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/lib/auth'
import { useT } from '@/lib/i18n'
import { useRepairs, useRepairStatus } from '@/lib/repairQueries'
import { businessDayISO, type RepairTicketDto } from '@/shared'

import { AssignKarigarDialog, DeliverDialog, NewTicketDialog, QADialog, RepairThumb, TicketDetailsDialog } from './RepairDialogs'
import { RepairTabs } from './RepairTabs'
import { ASSIGNABLE, date, inr, n, STATUS_KEY } from './repairUtils'

const today = businessDayISO
const COLUMNS = ['RECEIVED', 'IN_PROGRESS', 'IN_REVIEW', 'READY'] as const
const NEXT: Record<string, 'IN_PROGRESS' | 'IN_REVIEW'> = { RECEIVED: 'IN_PROGRESS', IN_PROGRESS: 'IN_REVIEW' }

export function RepairBoard() {
  const t = useT()
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
  const byStatus = (s: string) => tickets.filter((tk) => tk.status === s)

  // Summary numbers derived from the tickets already fetched (no extra requests).
  const openRows = tickets.filter((tk) => (COLUMNS as readonly string[]).includes(tk.status))
  const readyRows = byStatus('READY')
  const readyBalance = readyRows.reduce((sum, tk) => sum + n(tk.balance), 0)
  const priorityOpen = openRows.filter((tk) => tk.priority !== 'NORMAL').length
  const overdueOpen = openRows.filter((tk) => tk.expectedDate.slice(0, 10) < today()).length

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
          <h1>{t('repair.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('repair.subtitle')}</p>
        </div>
        {canEdit && <Button onClick={() => setCreating(true)}>{t('repair.new_ticket')}</Button>}
      </header>

      <RepairTabs />

      <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tile(t('repair.open_tickets'), loaded ? String(openTotal) : '—', loaded ? t('repair.open_loaded', { n: openRows.length, total: openTotal }) : undefined, Wrench)}
        {tile(t('repair.ready_pickup'), loaded ? String(readyRows.length) : '—', loaded ? t('repair.est_collect', { amt: inr(String(readyBalance)) }) : undefined, PackageCheck)}
        {tile(t('repair.urgent'), loaded ? String(priorityOpen) : '—', loaded ? t('repair.urgent_sub') : undefined, Zap)}
        {tile(t('repair.overdue'), loaded ? String(overdueOpen) : '—', loaded ? t('repair.overdue_sub') : undefined, CalendarClock)}
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl">{t('repair.tab_board')}</h2>
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input className="pl-9" aria-label="Search the board" placeholder={t('repair.search_board')} value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
        ) : (
          <div className="stagger grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {COLUMNS.map((col) => (
              <Card key={col} className="space-y-3 p-3">
                <div className="px-1 pt-1 text-sm font-semibold">{t(STATUS_KEY[col])} <span className="font-medium tabular-nums text-muted-foreground">({byStatus(col).length})</span></div>
                {byStatus(col).map((tk) => (
                  <div key={tk.id} className="space-y-1.5 rounded-2xl border bg-background p-3 text-sm shadow-xs transition-shadow hover:shadow-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">#{tk.ticketNo} {tk.category}</span>
                      {tk.priority !== 'NORMAL' && <Badge variant="destructive">{tk.priority}</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground">{tk.party.name} · {tk.metal} · {tk.gross}g · {t('girvi.due', { date: date(tk.expectedDate) })}</div>
                    <div className="flex items-start gap-2">
                      <RepairThumb ticket={tk} />
                      <div className="text-xs text-muted-foreground">{tk.subCategory ? `${tk.subCategory} · ` : ''}{tk.description}</div>
                    </div>
                    {tk.karigar && <div className="text-xs text-muted-foreground">{t('repair.karigar_colon')} <span className="font-medium text-foreground">{tk.karigar.name}</span></div>}
                    {tk.remarks && <div className="rounded-lg bg-muted/60 px-2 py-1 text-xs text-muted-foreground">{tk.remarks}</div>}
                    <div className="flex flex-wrap gap-1 pt-1">
                      {canEdit && NEXT[col] && <Button size="xs" variant="outline" onClick={() => move.mutate({ id: tk.id, body: { status: NEXT[col] } })}>→ {t(STATUS_KEY[NEXT[col]])}</Button>}
                      {canEdit && col === 'IN_REVIEW' && <Button size="xs" onClick={() => setQa(tk)}>{t('repair.pass_qa')}</Button>}
                      {canEdit && col === 'READY' && <Button size="xs" onClick={() => setDeliver(tk)}>{t('repair.deliver')}</Button>}
                      {canEdit && ASSIGNABLE.includes(col) && <Button size="xs" variant="outline" onClick={() => setAssign(tk)}>{tk.karigar ? t('repair.change_karigar') : t('repair.assign_karigar')}</Button>}
                      <Button size="xs" variant="ghost" onClick={() => setDetailsId(tk.id)}>{t('daybook.details')}</Button>
                      {canEdit && <Button size="xs" variant="ghost" onClick={() => move.mutate({ id: tk.id, body: { status: 'CANCELLED' } })}>{t('common.cancel')}</Button>}
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
          <Link to="/app/repair/ledger?status=DELIVERED" className="hover:text-foreground hover:underline">{t('repair.delivered_n', { n: deliveredTotal })}</Link>
          {' · '}
          <Link to="/app/repair/ledger?status=CANCELLED" className="hover:text-foreground hover:underline">{t('repair.cancelled_n', { n: cancelledTotal })}</Link>
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
