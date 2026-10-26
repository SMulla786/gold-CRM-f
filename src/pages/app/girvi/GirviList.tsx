import type { ColumnDef } from '@tanstack/react-table'
import { Search } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { DataTable } from '@/components/DataTable'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useGirviList } from '@/lib/girviQueries'
import type { GirviListItemDto } from '@/shared'

const inr = (s: string) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(s))
const date = (s: string) => new Date(s).toLocaleDateString('en-IN')

export function GirviList() {
  const [status, setStatus] = useState('ACTIVE')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const { data, isLoading } = useGirviList({ status: status || undefined, q: q || undefined, page })

  const columns: ColumnDef<GirviListItemDto, unknown>[] = [
    { header: 'Girvi', cell: ({ row }) => <Link to={`/app/girvi/${row.original.id}`} className="font-semibold text-brand-strong hover:underline">#{row.original.girviNo}</Link> },
    { header: 'Party', cell: ({ row }) => row.original.party.name },
    { header: 'Issued', cell: ({ row }) => date(row.original.issueDate) },
    { header: 'Return by', cell: ({ row }) => <span className={row.original.overdue ? 'text-destructive' : ''}>{date(row.original.returnDate)}</span> },
    { header: 'Items', cell: ({ row }) => `${row.original.pledgedCount}/${row.original.itemCount}` },
    { header: 'Valuation', cell: ({ row }) => inr(row.original.valuation) },
    { header: 'Principal', cell: ({ row }) => inr(row.original.principal) },
    { header: 'Interest due', cell: ({ row }) => inr(row.original.interestDue) },
    { header: 'Status', cell: ({ row }) => <Badge variant={row.original.status === 'ACTIVE' ? (row.original.overdue ? 'destructive' : 'secondary') : 'default'}>{row.original.overdue && row.original.status === 'ACTIVE' ? 'OVERDUE' : row.original.status}</Badge> },
  ]

  return (
    <div className="space-y-6">
      <Card className="flex flex-wrap items-center gap-3 p-4">
        <div className="relative w-full sm:max-w-sm sm:flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input className="pl-9" placeholder="Search girvi / party / mobile…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} />
        </div>
        <Select value={status || 'all'} onValueChange={(v) => { setStatus(v === 'all' ? '' : v); setPage(1) }}>
          <SelectTrigger className="w-36" aria-label="Status"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="ACTIVE">Active</SelectItem><SelectItem value="CLOSED">Closed</SelectItem></SelectContent>
        </Select>
      </Card>
      <DataTable columns={columns} data={data?.items ?? []} isLoading={isLoading} emptyText="No loans" pagination={data ? { page: data.page, pageSize: data.pageSize, total: data.total, onPage: setPage } : undefined} />
    </div>
  )
}
