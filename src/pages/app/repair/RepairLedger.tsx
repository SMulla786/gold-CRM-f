import type { ColumnDef } from '@tanstack/react-table'
import { Download, Printer, Search } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { DataTable } from '@/components/DataTable'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAuth } from '@/lib/auth'
import { downloadCsv } from '@/lib/csv'
import { fetchAllPaged } from '@/lib/queries'
import { useRepairs } from '@/lib/repairQueries'
import { businessDayISO, REPAIR_STATUSES, type RepairTicketDto } from '@/shared'

import { AssignKarigarDialog, DeliverDialog, TicketDetailsDialog } from './RepairDialogs'
import { RepairTabs } from './RepairTabs'
import { ASSIGNABLE, date, estCharge, inr, STATUS_LABEL } from './repairUtils'

const statusVariant = (s: RepairTicketDto['status']) => (s === 'CANCELLED' ? 'secondary' : s === 'DELIVERED' ? 'outline' : s === 'READY' ? 'default' : 'secondary')
const weightOf = (t: RepairTicketDto) => `${t.gross} g${t.net ? ` (net ${t.net} g)` : ''}`

export function RepairLedger() {
  const { can } = useAuth()
  const canEdit = can('repair.entry', 'edit')
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [exporting, setExporting] = useState(false)
  const [detailsId, setDetailsId] = useState<number | null>(null)
  const [deliver, setDeliver] = useState<RepairTicketDto | null>(null)
  const [assign, setAssign] = useState<RepairTicketDto | null>(null)
  const { data, isLoading } = useRepairs({ q: q.trim() || undefined, status: status || undefined, page })

  const exportCsv = async () => {
    setExporting(true)
    try {
      const all = await fetchAllPaged<RepairTicketDto>('/app/repairs', { q: q.trim() || undefined, status: status || undefined })
      const header = ['Ticket', 'Date', 'Customer', 'Mobile', 'Category', 'Metal', 'Karat', 'Pcs', 'Gross (g)', 'Net (g)', 'Final (g)', 'Job description', 'Karigar', 'Expected', 'Priority', 'Labour', 'Other', 'Est. charge', 'Advance', 'Balance', 'Status', 'Delivered on', 'Remarks']
      const body = all.map((t) => [t.ticketNo, date(t.createdAt), t.party.name, t.party.mobile, t.category, t.metal, t.karatCode, t.pcs, t.gross, t.net, t.finalWeight, t.description, t.karigar?.name, date(t.expectedDate), t.priority, t.labourCharge, t.otherCharge, estCharge(t), t.advance, t.balance, STATUS_LABEL[t.status], t.deliveredAt ? date(t.deliveredAt) : '', t.remarks])
      downloadCsv(`repair-ledger-${status ? status.toLowerCase() : 'all'}-${businessDayISO()}.csv`, [header, ...body])
    } finally {
      setExporting(false)
    }
  }

  const columns: ColumnDef<RepairTicketDto, unknown>[] = [
    { header: 'Ticket', cell: ({ row }) => <button type="button" className="font-semibold text-brand-strong hover:underline" onClick={() => setDetailsId(row.original.id)}>#{row.original.ticketNo}</button> },
    { header: 'Date', cell: ({ row }) => <span className="whitespace-nowrap">{date(row.original.createdAt)}</span> },
    { header: 'Customer', cell: ({ row }) => <div><div className="font-medium">{row.original.party.name}</div><div className="text-xs text-muted-foreground">{row.original.party.mobile}</div></div> },
    { header: 'Item', cell: ({ row }) => <div><div>{row.original.category}</div><div className="text-xs text-muted-foreground">{row.original.metal}{row.original.karatCode ? ` ${row.original.karatCode}` : ''} · {weightOf(row.original)}</div></div> },
    { header: 'Job', cell: ({ row }) => <div className="max-w-56 whitespace-normal break-words">{row.original.description}</div> },
    { header: 'Karigar', cell: ({ row }) => row.original.karigar?.name ?? '—' },
    { header: 'Est. charge', cell: ({ row }) => <span className="tabular-nums">{inr(estCharge(row.original))}</span> },
    { header: 'Advance', cell: ({ row }) => <span className="tabular-nums">{inr(row.original.advance)}</span> },
    { header: 'Status', cell: ({ row }) => <Badge variant={statusVariant(row.original.status)}>{STATUS_LABEL[row.original.status]}</Badge> },
    {
      id: 'actions', header: '',
      cell: ({ row }) => {
        const t = row.original
        return (
          <div className="flex flex-wrap gap-2">
            {canEdit && t.status === 'READY' && <Button size="sm" onClick={() => setDeliver(t)}>Deliver</Button>}
            {canEdit && ASSIGNABLE.includes(t.status) && <Button size="sm" variant="outline" onClick={() => setAssign(t)}>{t.karigar ? 'Change karigar' : 'Assign karigar'}</Button>}
            <Button size="sm" variant="ghost" onClick={() => setDetailsId(t.id)}>Details</Button>
            <Button asChild size="sm" variant="ghost"><Link to={`/app/repair/slip/${t.id}`}><Printer aria-hidden />Slip</Link></Button>
          </div>
        )
      },
    },
  ]

  return (
    <div className="space-y-8">
      <header>
        <h1>Repair ledger</h1>
        <p className="mt-1 text-sm text-muted-foreground">Every repair ticket, including delivered and cancelled ones. Search, filter and export.</p>
      </header>

      <RepairTabs />

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 pt-6">
          <div className="relative w-full sm:max-w-sm sm:flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input className="pl-9" aria-label="Search repairs" placeholder="Ticket no / customer / mobile / job…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} />
          </div>
          <Select value={status || 'all'} onValueChange={(v) => { setStatus(v === 'all' ? '' : v); setPage(1) }}>
            <SelectTrigger className="w-full sm:w-44" aria-label="Repair status"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {REPAIR_STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button className="sm:ml-auto" variant="outline" disabled={exporting} onClick={exportCsv}><Download aria-hidden />{exporting ? 'Exporting…' : 'Export CSV'}</Button>
        </CardContent>
      </Card>

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        isLoading={isLoading}
        emptyText={q || status ? 'No tickets match these filters.' : 'No repair tickets yet.'}
        pagination={data ? { page: data.page, pageSize: data.pageSize, total: data.total, onPage: setPage } : undefined}
      />

      {detailsId != null && <TicketDetailsDialog id={detailsId} onClose={() => setDetailsId(null)} />}
      {deliver && <DeliverDialog ticket={deliver} onClose={() => setDeliver(null)} />}
      {assign && <AssignKarigarDialog ticket={assign} onClose={() => setAssign(null)} />}
    </div>
  )
}
