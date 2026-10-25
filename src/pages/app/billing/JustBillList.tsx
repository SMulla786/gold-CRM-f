import type { ColumnDef } from '@tanstack/react-table'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { DataTable } from '@/components/DataTable'
import { MpinDialog } from '@/components/MpinDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useDeleteJustBill, useJustBills } from '@/lib/justbillQueries'
import { useAuth } from '@/lib/auth'
import { shareOnWhatsApp } from '@/lib/share'
import type { JustBillListItemDto } from '@/shared'

const inr = (s: string) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(s))
const date = (s: string) => new Date(s).toLocaleDateString('en-IN')

export function JustBillList() {
  const { can } = useAuth()
  const canDelete = can('billing.just_bill', 'delete')
  const [q, setQ] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  const { data, isLoading } = useJustBills({ q: q || undefined, from: from || undefined, to: to || undefined, page })
  const del = useDeleteJustBill()
  const [deleting, setDeleting] = useState<JustBillListItemDto | null>(null)

  const columns: ColumnDef<JustBillListItemDto, unknown>[] = [
    { header: 'Bill', cell: ({ row }) => <Link to={`/app/billing/just/view/${row.original.id}`} className="font-medium text-primary hover:underline">{row.original.billNo}</Link> },
    { header: 'Date', cell: ({ row }) => date(row.original.billDate) },
    { header: 'Customer', cell: ({ row }) => row.original.party?.name ?? row.original.customerName },
    { accessorKey: 'itemCount', header: 'Items' },
    { header: 'Weight', cell: ({ row }) => `${row.original.weight} g` },
    { header: 'Final', cell: ({ row }) => inr(row.original.final) },
    { header: 'Balance', cell: ({ row }) => inr(row.original.balance) },
    {
      id: 'actions', header: '',
      cell: ({ row }) =>
        row.original.status === 'ACTIVE' ? (
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => shareOnWhatsApp(row.original.mobile ?? '', `Bill ${row.original.billNo} · Total ${inr(row.original.final)} · Balance ${inr(row.original.balance)}`)}>Share</Button>
            {canDelete && <Button variant="ghost" size="sm" onClick={() => setDeleting(row.original)}>Delete</Button>}
          </div>
        ) : <Badge variant="secondary">Deleted</Badge>,
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <Input className="max-w-xs" placeholder="Search bill / customer / mobile…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} />
        <div className="space-y-1.5"><Label htmlFor="jbl-from">From</Label><Input id="jbl-from" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1) }} /></div>
        <div className="space-y-1.5"><Label htmlFor="jbl-to">To</Label><Input id="jbl-to" type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1) }} /></div>
      </div>

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        isLoading={isLoading}
        emptyText="No bills"
        pagination={data ? { page: data.page, pageSize: data.pageSize, total: data.total, onPage: setPage } : undefined}
      />

      <MpinDialog open={!!deleting} title={`Delete ${deleting?.billNo ?? ''}`} onConfirm={(mpin) => del.mutateAsync({ id: deleting!.id, mpin })} onClose={() => setDeleting(null)} />
    </div>
  )
}
