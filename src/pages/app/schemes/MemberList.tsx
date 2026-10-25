import type { ColumnDef } from '@tanstack/react-table'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { DataTable } from '@/components/DataTable'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input className="max-w-xs" placeholder="Search assign / name / mobile…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} />
        <Select value={status || 'all'} onValueChange={(v) => { setStatus(v === 'all' ? '' : v); setPage(1) }}>
          <SelectTrigger className="w-40" aria-label="Status"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All statuses</SelectItem>{ENROLLMENT_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
        </Select>
        <Button variant={due ? 'default' : 'outline'} size="sm" onClick={() => { setDue((d) => !d); setPage(1) }}>Due today</Button>
      </div>
      <DataTable columns={columns} data={data?.items ?? []} isLoading={isLoading} emptyText="No members" pagination={data ? { page: data.page, pageSize: data.pageSize, total: data.total, onPage: setPage } : undefined} />
      {paying && <AddMoneyDialog enrollment={paying} onClose={() => setPaying(null)} />}
    </div>
  )
}
