import type { ColumnDef } from '@tanstack/react-table'
import { CalendarClock, PiggyBank, UserCheck, Users, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { DataTable } from '@/components/DataTable'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAuth } from '@/lib/auth'
import { useEnrollments } from '@/lib/schemesQueries'
import { ENROLLMENT_STATUSES, type EnrollmentDto } from '@/shared'
import { AddMoneyDialog } from './AddMoneyDialog'

const inr = (s: string) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(s))
const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline'> = { ACTIVE: 'default', WON: 'secondary', WITHDRAWN: 'outline', CLOSED: 'outline' }

export function MemberList() {
  const navigate = useNavigate()
  const { can } = useAuth()
  const canCollect = can('schemes.add_money', 'edit')
  const [status, setStatus] = useState('')
  const [due, setDue] = useState(false)
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const { data, isLoading } = useEnrollments({ status: status || undefined, due: due ? 'true' : undefined, q: q || undefined, page })
  const [paying, setPaying] = useState<EnrollmentDto | null>(null)

  const columns: ColumnDef<EnrollmentDto, unknown>[] = [
    { header: 'Assign', cell: ({ row }) => <span className="font-medium">{row.original.assignId}</span> },
    { header: 'Member', cell: ({ row }) => row.original.displayName },
    { header: 'Scheme', cell: ({ row }) => row.original.scheme.name },
    { header: 'Paid', cell: ({ row }) => `${row.original.emisPaid}/${row.original.scheme.tenureMonths}` },
    { header: 'Due', cell: ({ row }) => (row.original.emisDue > 0 ? <Badge variant="secondary">{row.original.emisDue}</Badge> : '—') },
    { header: 'Maturity', cell: ({ row }) => inr(row.original.maturity.maturityValue) },
    { header: 'Status', cell: ({ row }) => <Badge variant={STATUS_VARIANT[row.original.status]}>{row.original.status}</Badge> },
    { id: 'actions', header: '', cell: ({ row }) => (
      <div className="flex gap-1">
        {canCollect && (row.original.status === 'ACTIVE' || row.original.status === 'WON') && <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); setPaying(row.original) }}>Add money</Button>}
        <Button variant="ghost" size="sm" onClick={() => navigate(`/app/schemes/members/${row.original.id}`)}>Open</Button>
      </div>
    ) },
  ]

  // Summary numbers derived from the page already fetched (no extra requests).
  const items = data?.items ?? []
  const dueRows = items.filter((e) => e.emisDue > 0)
  const dueEmis = dueRows.reduce((sum, e) => sum + e.emisDue, 0)
  const activeRows = items.filter((e) => e.status === 'ACTIVE').length
  const maturityTotal = items.reduce((sum, e) => sum + Number(e.maturity.maturityValue), 0)

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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tile('Members', data ? String(data.total) : '—', 'Matching current filters', Users)}
        {tile('Due on this page', data ? String(dueRows.length) : '—', data ? `${dueEmis} EMIs pending` : undefined, CalendarClock)}
        {tile('Active on this page', data ? String(activeRows) : '—', data ? `of ${items.length} shown` : undefined, UserCheck)}
        {tile('Maturity value', data ? inr(String(maturityTotal)) : '—', 'Members on this page', PiggyBank)}
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 pt-6">
          <Input className="max-w-xs" placeholder="Search assign / name / mobile…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} />
          <Select value={status || 'all'} onValueChange={(v) => { setStatus(v === 'all' ? '' : v); setPage(1) }}>
            <SelectTrigger className="w-40" aria-label="Status"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All statuses</SelectItem>{ENROLLMENT_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
          <Button variant={due ? 'default' : 'outline'} size="sm" onClick={() => { setDue((d) => !d); setPage(1) }}>Due today</Button>
        </CardContent>
      </Card>

      <Card className="p-4">
        <DataTable columns={columns} data={data?.items ?? []} isLoading={isLoading} emptyText="No members" pagination={data ? { page: data.page, pageSize: data.pageSize, total: data.total, onPage: setPage } : undefined} />
      </Card>
      {paying && <AddMoneyDialog enrollment={paying} onClose={() => setPaying(null)} />}
    </div>
  )
}
