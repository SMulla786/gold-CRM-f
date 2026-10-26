import type { ColumnDef } from '@tanstack/react-table'
import { Download, Printer, Search } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { DataTable } from '@/components/DataTable'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAuth } from '@/lib/auth'
import { downloadCsv } from '@/lib/csv'
import { useT } from '@/lib/i18n'
import { fetchAllPaged } from '@/lib/queries'
import { useRepairs } from '@/lib/repairQueries'
import { businessDayISO, REPAIR_STATUSES, type RepairTicketDto } from '@/shared'

import { AssignKarigarDialog, DeliverDialog, RepairThumb, TicketDetailsDialog } from './RepairDialogs'
import { RepairTabs } from './RepairTabs'
import { ASSIGNABLE, date, estCharge, inr, STATUS_KEY, STATUS_LABEL } from './repairUtils'

const statusVariant = (s: RepairTicketDto['status']) => (s === 'CANCELLED' ? 'secondary' : s === 'DELIVERED' ? 'outline' : s === 'READY' ? 'default' : 'secondary')

export function RepairLedger() {
  const t = useT()
  const { can } = useAuth()
  const canEdit = can('repair.entry', 'edit')
  // ?status= / ?q= deep links (e.g. the board's Delivered / Cancelled counts) seed the filters.
  const [sp] = useSearchParams()
  const [q, setQ] = useState(sp.get('q') ?? '')
  const [status, setStatus] = useState(() => { const s = sp.get('status') ?? ''; return (REPAIR_STATUSES as readonly string[]).includes(s) ? s : '' })
  const [metal, setMetal] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [exporting, setExporting] = useState(false)
  const [detailsId, setDetailsId] = useState<number | null>(null)
  const [deliver, setDeliver] = useState<RepairTicketDto | null>(null)
  const [assign, setAssign] = useState<RepairTicketDto | null>(null)
  const filters = { q: q.trim() || undefined, status: status || undefined, metal: metal || undefined, from: from || undefined, to: to || undefined }
  const { data, isLoading } = useRepairs({ ...filters, page, pageSize })

  const exportCsv = async () => {
    setExporting(true)
    try {
      const all = await fetchAllPaged<RepairTicketDto>('/app/repairs', filters)
      const header = ['Ticket', 'Date', 'Customer', 'Mobile', 'Category', 'Metal', 'Karat', 'Pcs', 'Gross (g)', 'Net (g)', 'Final (g)', 'Job description', 'Karigar', 'Expected', 'Priority', 'Labour', 'Other', 'Est. charge', 'Advance', 'Balance', 'Status', 'Delivered on', 'Remarks']
      const body = all.map((x) => [x.ticketNo, date(x.createdAt), x.party.name, x.party.mobile, x.category, x.metal, x.karatCode, x.pcs, x.gross, x.net, x.finalWeight, x.description, x.karigar?.name, date(x.expectedDate), x.priority, x.labourCharge, x.otherCharge, estCharge(x), x.advance, x.balance, STATUS_LABEL[x.status], x.deliveredAt ? date(x.deliveredAt) : '', x.remarks])
      downloadCsv(`repair-ledger-${status ? status.toLowerCase() : 'all'}-${businessDayISO()}.csv`, [header, ...body])
    } finally {
      setExporting(false)
    }
  }

  const weightOf = (x: RepairTicketDto) => `${x.gross} g${x.net ? t('repair.net_paren', { n: x.net }) : ''}`

  const columns: ColumnDef<RepairTicketDto, unknown>[] = [
    { header: t('repair.col_ticket'), cell: ({ row }) => <button type="button" className="font-semibold text-brand-strong hover:underline" onClick={() => setDetailsId(row.original.id)}>#{row.original.ticketNo}</button> },
    { header: t('udhari.date'), cell: ({ row }) => <span className="whitespace-nowrap">{date(row.original.createdAt)}</span> },
    { header: t('bill.customer'), cell: ({ row }) => <div><div className="font-medium">{row.original.party.name}</div><div className="text-xs text-muted-foreground">{row.original.party.mobile}</div></div> },
    { header: t('bill.col_item'), cell: ({ row }) => <div className="flex items-center gap-2"><RepairThumb ticket={row.original} /><div><div>{row.original.category}{row.original.subCategory ? ` · ${row.original.subCategory}` : ''}</div><div className="text-xs text-muted-foreground">{row.original.metal}{row.original.karatCode ? ` ${row.original.karatCode}` : ''}{row.original.purity ? ` ${row.original.purity}%` : ''} · {weightOf(row.original)}</div></div></div> },
    { header: t('repair.job'), cell: ({ row }) => <div className="max-w-56 whitespace-normal break-words">{row.original.description}</div> },
    { header: t('party.type.KARIGAR'), cell: ({ row }) => row.original.karigar?.name ?? '—' },
    { header: t('repair.est_charge'), cell: ({ row }) => <span className="tabular-nums">{inr(estCharge(row.original))}</span> },
    { header: t('repair.advance'), cell: ({ row }) => <span className="tabular-nums">{inr(row.original.advance)}</span> },
    { header: t('stock.col_status'), cell: ({ row }) => <Badge variant={statusVariant(row.original.status)}>{t(STATUS_KEY[row.original.status])}</Badge> },
    {
      id: 'actions', header: '',
      cell: ({ row }) => {
        const tk = row.original
        return (
          <div className="flex flex-wrap gap-2">
            {canEdit && tk.status === 'READY' && <Button size="sm" onClick={() => setDeliver(tk)}>{t('repair.deliver')}</Button>}
            {canEdit && ASSIGNABLE.includes(tk.status) && <Button size="sm" variant="outline" onClick={() => setAssign(tk)}>{tk.karigar ? t('repair.change_karigar') : t('repair.assign_karigar')}</Button>}
            <Button size="sm" variant="ghost" onClick={() => setDetailsId(tk.id)}>{t('daybook.details')}</Button>
            <Button asChild size="sm" variant="ghost"><Link to={`/app/repair/slip/${tk.id}`}><Printer aria-hidden />{t('draft.slip')}</Link></Button>
          </div>
        )
      },
    },
  ]

  return (
    <div className="space-y-8">
      <header>
        <h1>{t('repair.ledger_title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('repair.ledger_subtitle')}</p>
      </header>

      <RepairTabs />

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 pt-6">
          <div className="relative w-full sm:max-w-sm sm:flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input className="pl-9" aria-label="Search repairs" placeholder={t('repair.search_ledger')} value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} />
          </div>
          <Select value={status || 'all'} onValueChange={(v) => { setStatus(v === 'all' ? '' : v); setPage(1) }}>
            <SelectTrigger className="w-full sm:w-44" aria-label="Repair status"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('draft.all_statuses')}</SelectItem>
              {REPAIR_STATUSES.map((s) => <SelectItem key={s} value={s}>{t(STATUS_KEY[s])}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={metal || 'all'} onValueChange={(v) => { setMetal(v === 'all' ? '' : v); setPage(1) }}>
            <SelectTrigger className="w-full sm:w-36" aria-label="Repair metal"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('repair.all_metals')}</SelectItem>
              <SelectItem value="GOLD">{t('class.GOLD')}</SelectItem>
              <SelectItem value="SILVER">{t('class.SILVER')}</SelectItem>
              <SelectItem value="OTHER">{t('bill.col_other')}</SelectItem>
            </SelectContent>
          </Select>
          <Input type="date" className="w-full sm:w-40" aria-label="Received from" value={from} max={to || undefined} onChange={(e) => { setFrom(e.target.value); setPage(1) }} />
          <Input type="date" className="w-full sm:w-40" aria-label="Received to" value={to} min={from || undefined} onChange={(e) => { setTo(e.target.value); setPage(1) }} />
          <Button className="sm:ml-auto" variant="outline" disabled={exporting} onClick={exportCsv}><Download aria-hidden />{exporting ? t('bill.exporting') : t('common.export_csv')}</Button>
        </CardContent>
      </Card>

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        isLoading={isLoading}
        emptyText={q || status || metal || from || to ? t('repair.no_match') : t('repair.no_tickets')}
        pagination={data ? { page: data.page, pageSize: data.pageSize, total: data.total, onPage: setPage, onPageSize: setPageSize } : undefined}
      />

      {detailsId != null && <TicketDetailsDialog id={detailsId} onClose={() => setDetailsId(null)} />}
      {deliver && <DeliverDialog ticket={deliver} onClose={() => setDeliver(null)} />}
      {assign && <AssignKarigarDialog ticket={assign} onClose={() => setAssign(null)} />}
    </div>
  )
}
