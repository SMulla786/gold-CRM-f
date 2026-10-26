import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useBankAccounts } from '@/lib/appQueries'
import { useAddBillPayments } from '@/lib/billingQueries'
import { businessDayISO, type BillListItemDto } from '@/shared'

const inr = (s: string) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(s))
const today = businessDayISO

/** Add a CASH/ONLINE payment to a bill. Reused by the bill list and the udhari pending-bills tab. */
export function AddPaymentDialog({ bill, onClose }: { bill: BillListItemDto; onClose: () => void }) {
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
            <div className="col-span-2 space-y-1.5">
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
