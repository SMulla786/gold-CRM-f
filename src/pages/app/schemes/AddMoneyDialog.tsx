import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useBankAccounts } from '@/lib/appQueries'
import { useAddSchemePayment } from '@/lib/schemesQueries'
import { businessDayISO, SCHEME_PAY_MEDIUMS, type EnrollmentDetailDto, type EnrollmentDto } from '@/shared'
import { SchemeReceiptDialog } from './SchemeReceipt'

const n = (s: string) => Number(s) || 0

/** Collect a scheme installment. Reused by Members list and the enrolment detail. */
export function AddMoneyDialog({ enrollment, onClose }: { enrollment: EnrollmentDto; onClose: () => void }) {
  const { data: banks } = useBankAccounts()
  const add = useAddSchemePayment()
  const gold = enrollment.scheme.type === 'GOLD'
  const [f, setF] = useState({ emiNo: enrollment.nextEmiNo ? String(enrollment.nextEmiNo) : '', txnDate: businessDayISO(), amount: enrollment.emiAmount, medium: 'CASH', bankAccountId: '', rate: '', remark: '' })
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }))
  const valid = n(f.amount) > 0 && (f.medium !== 'ONLINE' || f.bankAccountId)

  const [saved, setSaved] = useState<EnrollmentDetailDto | null>(null)

  const submit = async () => {
    const res = await add.mutateAsync({
      enrollmentId: enrollment.id, emiNo: f.emiNo ? n(f.emiNo) : undefined, txnDate: f.txnDate || undefined, amount: n(f.amount), medium: f.medium,
      bankAccountId: f.medium === 'ONLINE' ? Number(f.bankAccountId) : undefined, rate: gold && f.rate ? n(f.rate) : undefined, remark: f.remark || undefined,
    })
    setSaved(res) // payments come back id-ascending, so the new one is last
  }

  const newPayment = saved?.payments.at(-1)
  if (saved && newPayment) return <SchemeReceiptDialog enrollment={saved} paymentId={newPayment.id} onClose={onClose} />

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add money — {enrollment.assignId} {enrollment.displayName}</DialogTitle></DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5"><Label htmlFor="am-emi">EMI no {enrollment.nextEmiNo ? `(next ${enrollment.nextEmiNo})` : ''}</Label><Input id="am-emi" type="number" placeholder="auto" value={f.emiNo} onChange={(e) => set('emiNo', e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="am-date">Payment date</Label><Input id="am-date" type="date" max={businessDayISO()} value={f.txnDate} onChange={(e) => set('txnDate', e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="am-amt">Amount ₹</Label><Input id="am-amt" type="number" value={f.amount} onChange={(e) => set('amount', e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Medium</Label>
            <Select value={f.medium} onValueChange={(v) => set('medium', v)}><SelectTrigger aria-label="Medium"><SelectValue /></SelectTrigger>
              <SelectContent>{SCHEME_PAY_MEDIUMS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select>
          </div>
          {gold && <div className="space-y-1.5"><Label htmlFor="am-rate">Gold rate /10g (blank = today)</Label><Input id="am-rate" type="number" value={f.rate} onChange={(e) => set('rate', e.target.value)} /></div>}
          {f.medium === 'ONLINE' && (
            <div className="space-y-1.5 sm:col-span-2"><Label>Bank</Label>
              <Select value={f.bankAccountId} onValueChange={(v) => set('bankAccountId', v)}><SelectTrigger aria-label="Bank account"><SelectValue placeholder="Bank" /></SelectTrigger>
                <SelectContent>{banks?.map((b) => <SelectItem key={b.id} value={String(b.id)}>{b.bankName} · {b.accountNo}</SelectItem>)}</SelectContent></Select>
            </div>
          )}
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="am-remark">Remark</Label><Input id="am-remark" value={f.remark} onChange={(e) => set('remark', e.target.value)} /></div>
        </div>
        <DialogFooter><Button disabled={!valid || add.isPending} onClick={() => void submit().catch(() => {})}>{add.isPending ? 'Saving…' : 'Add payment'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
