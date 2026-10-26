import type { ColumnDef } from '@tanstack/react-table'
import { useState } from 'react'

import { DataTable } from '@/components/DataTable'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useBhavBookings } from '@/lib/tradeQueries'
import { METALS, TRADE_SIDES, type BhavBookingDto } from '@/shared'

const inr = (s: string) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(s))
const date = (s: string) => new Date(s).toLocaleDateString('en-IN')
const time = (s: string) => new Date(s).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })

/** Closed bhav bookings (fully delivered or cancelled). The list endpoint takes one status, so the view toggles between the two. */
export function BhavOldBookings() {
  const [status, setStatus] = useState<'DELIVERED' | 'CANCELLED'>('DELIVERED')
  const [side, setSide] = useState('')
  const [metal, setMetal] = useState('')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const { data, isLoading } = useBhavBookings({ status, side: side || undefined, metal: metal || undefined, q: q || undefined, page })

  const columns: ColumnDef<BhavBookingDto, unknown>[] = [
    { header: 'No', cell: ({ row }) => <span className="font-medium">#{row.original.bookingNo}</span> },
    { header: 'Date', cell: ({ row }) => <div className="whitespace-nowrap">{date(row.original.txnDate)}<div className="text-xs text-muted-foreground">{time(row.original.createdAt)}</div></div> },
    { header: 'Party', cell: ({ row }) => <div>{row.original.party.name}<div className="text-xs text-muted-foreground tabular-nums">{row.original.party.mobile}</div></div> },
    { header: 'Side', cell: ({ row }) => <Badge variant="secondary">{row.original.side}</Badge> },
    { header: 'Metal', cell: ({ row }) => row.original.metal },
    { header: 'Weight', cell: ({ row }) => <span className="tabular-nums">{row.original.weight} g</span> },
    { header: 'Rate', cell: ({ row }) => <span className="tabular-nums">{row.original.rate}</span> },
    { header: 'Amount', cell: ({ row }) => <span className="tabular-nums">{inr(row.original.amount)}</span> },
    { header: 'Advance', cell: ({ row }) => <span className="tabular-nums">{inr(row.original.advance)}</span> },
    { header: 'Narration', cell: ({ row }) => <span className="text-muted-foreground">{row.original.narration ?? '—'}</span> },
    { header: 'Status', cell: ({ row }) => <Badge variant="outline">{row.original.status}</Badge> },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl">Old bookings</h2>
        <p className="text-sm text-muted-foreground">Rate locks that are fully delivered or cancelled.</p>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 pt-6">
          <Input className="max-w-xs" placeholder="Search no / party / mobile…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} />
          <Select value={status} onValueChange={(v) => { setStatus(v === 'CANCELLED' ? 'CANCELLED' : 'DELIVERED'); setPage(1) }}>
            <SelectTrigger className="w-36" aria-label="Status"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="DELIVERED">Delivered</SelectItem><SelectItem value="CANCELLED">Cancelled</SelectItem></SelectContent>
          </Select>
          <Select value={side || 'all'} onValueChange={(v) => { setSide(v === 'all' ? '' : v); setPage(1) }}>
            <SelectTrigger className="w-32" aria-label="Side"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All sides</SelectItem>{TRADE_SIDES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={metal || 'all'} onValueChange={(v) => { setMetal(v === 'all' ? '' : v); setPage(1) }}>
            <SelectTrigger className="w-32" aria-label="Metal"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All metals</SelectItem>{METALS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card className="p-4">
        <DataTable columns={columns} data={data?.items ?? []} isLoading={isLoading} emptyText="No old bookings" pagination={data ? { page: data.page, pageSize: data.pageSize, total: data.total, onPage: setPage } : undefined} />
      </Card>
    </div>
  )
}
