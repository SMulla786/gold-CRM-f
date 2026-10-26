import type { ColumnDef } from '@tanstack/react-table'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { DataTable } from '@/components/DataTable'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AddPaymentDialog } from '@/pages/app/billing/AddPaymentDialog'
import { useBills, useDeleteBill } from '@/lib/billingQueries'
import { useAuth } from '@/lib/auth'
import { downloadCsv } from '@/lib/csv'
import { fetchAllPaged } from '@/lib/queries'
import { shareOnWhatsApp } from '@/lib/share'
import { businessDayISO, BILL_KINDS, type BillKind, type BillListItemDto } from '@/shared'

const todayISO = businessDayISO

const inr = (s: string) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(s))
const date = (s: string) => new Date(s).toLocaleDateString('en-IN')

function DeleteBillDialog({ bill, onClose }: { bill: BillListItemDto; onClose: () => void }) {
  const del = useDeleteBill()
  const [returnStock, setReturnStock] = useState('true')
  const [mpin, setMpin] = useState('')
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Delete {bill.billNo}?</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Stock handling</Label>
            <Select value={returnStock} onValueChange={setReturnStock}>
              <SelectTrigger aria-label="Stock handling"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="true">Item Return — put items back in stock</SelectItem>
                <SelectItem value="false">Delete Only — leave stock as is</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="del-mpin">MPIN</Label>
            <Input id="del-mpin" inputMode="numeric" maxLength={4} value={mpin} onChange={(e) => setMpin(e.target.value.replace(/\D/g, ''))} />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="destructive"
            disabled={mpin.length !== 4 || del.isPending}
            onClick={async () => { await del.mutateAsync({ id: bill.id, returnStock: returnStock === 'true', mpin }); onClose() }}
          >
            Delete bill
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function BillList() {
  const { can } = useAuth()
  const navigate = useNavigate()
  const [kind, setKind] = useState<BillKind>('SELL')
  const [status, setStatus] = useState('ACTIVE')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [exporting, setExporting] = useState(false)
  const permKey = kind === 'SELL' ? 'billing.sell_bill' : 'billing.purchase_bill'
  const canEdit = can(permKey, 'edit')
  const canDelete = can(permKey, 'delete')
  const { data, isLoading } = useBills({ kind, status, q: q || undefined, page })
  const [paying, setPaying] = useState<BillListItemDto | null>(null)
  const [deleting, setDeleting] = useState<BillListItemDto | null>(null)

  const exportCsv = async () => {
    setExporting(true)
    try {
      const all = await fetchAllPaged<BillListItemDto>('/app/bills', { kind, status, q: q || undefined })
      const header = ['Bill', 'Date', 'Party', 'Mobile', 'Type', 'Items', 'Final', 'Paid', 'Balance', 'Status']
      const body = all.map((b) => [b.billNo, date(b.billDate), b.party.name, b.party.mobile, b.billType, b.itemCount, b.final, b.paid, b.balance, b.status])
      downloadCsv(`bills-${kind.toLowerCase()}-${status.toLowerCase()}.csv`, [header, ...body])
    } finally {
      setExporting(false)
    }
  }

  const columns: ColumnDef<BillListItemDto, unknown>[] = [
    { header: 'Bill', cell: ({ row }) => <Link to={`/app/billing/view/${row.original.id}`} className="font-medium text-primary hover:underline">{row.original.billNo}</Link> },
    { header: 'Date', cell: ({ row }) => date(row.original.billDate) },
    { header: 'Party', cell: ({ row }) => row.original.party.name },
    { accessorKey: 'itemCount', header: 'Items' },
    { header: 'Type', cell: ({ row }) => <Badge variant="secondary">{row.original.billType}</Badge> },
    { header: 'Final', cell: ({ row }) => inr(row.original.final) },
    { header: 'Paid', cell: ({ row }) => inr(row.original.paid) },
    { header: 'Balance', cell: ({ row }) => <span className={Number(row.original.balance) < 0 ? 'text-green-600 dark:text-green-500' : Number(row.original.balance) > 0 ? 'text-destructive' : ''}>{inr(row.original.balance)}</span> },
    {
      id: 'actions', header: '',
      cell: ({ row }) =>
        row.original.status === 'ACTIVE' ? (
          <div className="flex flex-wrap gap-2">
            {canEdit && row.original.billDate.slice(0, 10) === todayISO() && <Button variant="outline" size="sm" onClick={() => navigate(`/app/billing/edit/${row.original.id}`)}>Edit</Button>}
            {canEdit && Number(row.original.balance) !== 0 && <Button variant="outline" size="sm" onClick={() => setPaying(row.original)}>Add payment</Button>}
            <Button variant="ghost" size="sm" onClick={() => shareOnWhatsApp(row.original.party.mobile, `${row.original.kind === 'SELL' ? 'Bill' : 'Purchase'} ${row.original.billNo} · Total ${inr(row.original.final)} · Balance ${inr(row.original.balance)}`)}>Share</Button>
            {canDelete && <Button variant="ghost" size="sm" onClick={() => setDeleting(row.original)}>Delete</Button>}
          </div>
        ) : <Badge variant="secondary">Deleted</Badge>,
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={kind} onValueChange={(v) => { setKind(v as BillKind); setPage(1) }}>
          <SelectTrigger className="w-36" aria-label="Bill kind"><SelectValue /></SelectTrigger>
          <SelectContent>{BILL_KINDS.map((k) => <SelectItem key={k} value={k}>{k === 'SELL' ? 'Sell' : 'Purchase'}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1) }}>
          <SelectTrigger className="w-32" aria-label="Status"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="ACTIVE">Active</SelectItem><SelectItem value="DELETED">Deleted</SelectItem></SelectContent>
        </Select>
        <Input className="max-w-xs" placeholder="Search bill / party / mobile…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} />
        <Button className="ml-auto" variant="outline" disabled={exporting} onClick={exportCsv}>{exporting ? 'Exporting…' : 'Export CSV'}</Button>
      </div>

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        isLoading={isLoading}
        emptyText="No bills"
        pagination={data ? { page: data.page, pageSize: data.pageSize, total: data.total, onPage: setPage } : undefined}
      />

      {paying && <AddPaymentDialog bill={paying} onClose={() => setPaying(null)} />}
      {deleting && <DeleteBillDialog bill={deleting} onClose={() => setDeleting(null)} />}
    </div>
  )
}
