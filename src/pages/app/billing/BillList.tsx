import type { ColumnDef } from '@tanstack/react-table'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { DataTable } from '@/components/DataTable'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useBankAccounts } from '@/lib/appQueries'
import { useAddBillPayments, useBills, useDeleteBill } from '@/lib/billingQueries'
import { useAuth } from '@/lib/auth'
import { BILL_KINDS, type BillKind, type BillListItemDto } from '@/shared'

const inr = (s: string) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(s))
const date = (s: string) => new Date(s).toLocaleDateString('en-IN')
const today = () => new Date().toISOString().slice(0, 10)

function AddPaymentDialog({ bill, onClose }: { bill: BillListItemDto; onClose: () => void }) {
  const add = useAddBillPayments()
  const { data: banks } = useBankAccounts()
  const [mode, setMode] = useState('CASH')
  const [amount, setAmount] = useState('')
  const [bankAccountId, setBank] = useState('')
  const [txnDate, setTxnDate] = useState(today())
  const [remark, setRemark] = useState('')
  const ok = Number(amount) > 0 && (mode === 'CASH' || bankAccountId)
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add payment · {bill.billNo}</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">Balance {inr(bill.balance)}</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Mode</Label>
            <Select value={mode} onValueChange={setMode}>
              <SelectTrigger aria-label="Payment mode"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="CASH">Cash</SelectItem><SelectItem value="ONLINE">Online</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ap-amt">Amount</Label>
            <Input id="ap-amt" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          {mode === 'ONLINE' && (
            <div className="space-y-1.5 col-span-2">
              <Label>Bank account</Label>
              <Select value={bankAccountId} onValueChange={setBank}>
                <SelectTrigger aria-label="Bank account"><SelectValue placeholder="Select bank" /></SelectTrigger>
                <SelectContent>{banks?.map((b) => <SelectItem key={b.id} value={String(b.id)}>{b.bankName} · {b.accountNo}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="ap-date">Date</Label>
            <Input id="ap-date" type="date" value={txnDate} onChange={(e) => setTxnDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ap-remark">Remark</Label>
            <Input id="ap-remark" value={remark} onChange={(e) => setRemark(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={!ok || add.isPending}
            onClick={async () => {
              const payment = mode === 'ONLINE'
                ? { mode: 'ONLINE', amount: Number(amount), bankAccountId: Number(bankAccountId), remark: remark || undefined }
                : { mode: 'CASH', amount: Number(amount), remark: remark || undefined }
              await add.mutateAsync({ id: bill.id, body: { payments: [payment], txnDate } })
              onClose()
            }}
          >
            Add payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

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
  const [kind, setKind] = useState<BillKind>('SELL')
  const [status, setStatus] = useState('ACTIVE')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const permKey = kind === 'SELL' ? 'billing.sell_bill' : 'billing.purchase_bill'
  const canEdit = can(permKey, 'edit')
  const canDelete = can(permKey, 'delete')
  const { data, isLoading } = useBills({ kind, status, q: q || undefined, page })
  const [paying, setPaying] = useState<BillListItemDto | null>(null)
  const [deleting, setDeleting] = useState<BillListItemDto | null>(null)

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
          <div className="flex gap-2">
            {canEdit && Number(row.original.balance) !== 0 && <Button variant="outline" size="sm" onClick={() => setPaying(row.original)}>Add payment</Button>}
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
