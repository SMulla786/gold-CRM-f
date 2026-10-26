import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useBankAccounts } from '@/lib/appQueries'
import { useAddBillPayments } from '@/lib/billingQueries'
import { useT } from '@/lib/i18n'
import { SchemeEnrollmentSelect } from '@/pages/app/billing/SchemeEnrollmentSelect'
import { businessDayISO, type BillListItemDto } from '@/shared'

const inr = (s: string) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(s))
const today = businessDayISO

/** Add a payment to a bill — cash, online or both split in one go (+ TASK-98 udhar advance / scheme on sell bills). Reused by the bill list and the udhari pending-bills tab. */
export function AddPaymentDialog({ bill, onClose }: { bill: BillListItemDto; onClose: () => void }) {
  const t = useT()
  const add = useAddBillPayments()
  const { data: banks } = useBankAccounts()
  const [cash, setCash] = useState('')
  const [online, setOnline] = useState('')
  const [bankAccountId, setBank] = useState('')
  const [txnDate, setTxnDate] = useState(today())
  const [remark, setRemark] = useState('')
  const [advance, setAdvance] = useState('')
  const [enrollmentId, setEnrollmentId] = useState('')
  const [scheme, setScheme] = useState('')
  const cashAmt = Number(cash) || 0
  const onlineAmt = Number(online) || 0
  const advanceAmt = Number(advance) || 0
  const schemeAmt = Number(scheme) || 0
  const sell = bill.kind === 'SELL'
  const ok = cashAmt >= 0 && onlineAmt >= 0 && advanceAmt >= 0 && schemeAmt >= 0 && cashAmt + onlineAmt + advanceAmt + schemeAmt > 0
    && (onlineAmt === 0 || !!bankAccountId) && (schemeAmt === 0 || !!enrollmentId)
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{t('bill.add_payment_title', { no: bill.billNo })}</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">{t('bill.balance_amt', { amount: inr(bill.balance) })}</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="ap-cash">{t('bill.cash')}</Label>
            <Input id="ap-cash" type="number" min="0" value={cash} onChange={(e) => setCash(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ap-online">{t('bill.online')}</Label>
            <Input id="ap-online" type="number" min="0" value={online} onChange={(e) => setOnline(e.target.value)} />
          </div>
          {sell && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="ap-advance">{t('bill.udhar_advance')}</Label>
                <Input id="ap-advance" type="number" min="0" value={advance} onChange={(e) => setAdvance(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ap-scheme">{t('bill.scheme')}</Label>
                <Input id="ap-scheme" type="number" min="0" value={scheme} onChange={(e) => setScheme(e.target.value)} />
              </div>
              {schemeAmt > 0 && (
                <div className="col-span-2">
                  <SchemeEnrollmentSelect partyId={bill.party.id} value={enrollmentId} onChange={(id) => setEnrollmentId(id)} />
                </div>
              )}
            </>
          )}
          {onlineAmt > 0 && (
            <div className="col-span-2 space-y-1.5">
              <Label>{t('bill.bank_account')}</Label>
              <Select value={bankAccountId} onValueChange={setBank}>
                <SelectTrigger aria-label="Bank account"><SelectValue placeholder={t('bill.select_bank')} /></SelectTrigger>
                <SelectContent>{banks?.map((b) => <SelectItem key={b.id} value={String(b.id)}>{b.bankName} · {b.accountNo}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="ap-date">{t('udhari.date')}</Label>
            <Input id="ap-date" type="date" value={txnDate} onChange={(e) => setTxnDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ap-remark">{t('udhari.remark')}</Label>
            <Input id="ap-remark" value={remark} onChange={(e) => setRemark(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={!ok || add.isPending}
            onClick={async () => {
              const payments = [
                ...(cashAmt > 0 ? [{ mode: 'CASH', amount: cashAmt, remark: remark || undefined }] : []),
                ...(onlineAmt > 0 ? [{ mode: 'ONLINE', amount: onlineAmt, bankAccountId: Number(bankAccountId), remark: remark || undefined }] : []),
                ...(advanceAmt > 0 ? [{ mode: 'UDHAR_ADVANCE', amount: advanceAmt, remark: remark || undefined }] : []),
                ...(schemeAmt > 0 ? [{ mode: 'SCHEME', enrollmentId: Number(enrollmentId), amount: schemeAmt, remark: remark || undefined }] : []),
              ]
              await add.mutateAsync({ id: bill.id, body: { payments, txnDate } })
              onClose()
            }}
          >
            {t('bill.add_payment')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
