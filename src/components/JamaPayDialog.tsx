// Sell Bill "Jama/Pay (उधारी जमा करें)": take an old udhar payment from the party without leaving billing.
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useBankAccounts } from '@/lib/appQueries'
import { useT } from '@/lib/i18n'
import { useCreateUdhar } from '@/lib/udhariQueries'
import { jamaBody } from '@/pages/app/billing/billFormParts'
import { businessDayISO, type PartyRefDto } from '@/shared'

interface Props {
  party: PartyRefDto
  open: boolean
  onClose: () => void
}

export function JamaPayDialog({ party, open, onClose }: Props) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-md">
        {/* body mounts on open, so the fields reset each time */}
        <JamaBody party={party} onClose={onClose} />
      </DialogContent>
    </Dialog>
  )
}

function JamaBody({ party, onClose }: { party: PartyRefDto; onClose: () => void }) {
  const t = useT()
  const { data: banks } = useBankAccounts()
  const create = useCreateUdhar()
  const [mode, setMode] = useState<'CASH' | 'ONLINE'>('CASH')
  const [amount, setAmount] = useState('')
  const [bankId, setBankId] = useState('')
  const [txnDate, setTxnDate] = useState(businessDayISO())
  const [remark, setRemark] = useState('')

  const body = jamaBody(party.id, { mode, amount, bankId, txnDate, remark })
  const save = async () => {
    if (!body) return
    await create.mutateAsync(body)
    onClose()
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t('jama.title')}</DialogTitle>
        <DialogDescription>{t('jama.desc', { name: party.name })}</DialogDescription>
      </DialogHeader>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="jama-amount">{t('bill.amount')}</Label>
          <Input id="jama-amount" type="number" min="0" step="0.01" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="jama-date">{t('jama.date')}</Label>
          <Input id="jama-date" type="date" value={txnDate} onChange={(e) => setTxnDate(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="jama-mode">{t('jama.mode')}</Label>
          <Select value={mode} onValueChange={(v) => setMode(v as 'CASH' | 'ONLINE')}>
            <SelectTrigger id="jama-mode"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="CASH">{t('jama.cash')}</SelectItem>
              <SelectItem value="ONLINE">{t('jama.online')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {mode === 'ONLINE' && (
          <div className="space-y-1.5">
            <Label htmlFor="jama-bank">{t('bill.bank')}</Label>
            <Select value={bankId} onValueChange={setBankId}>
              <SelectTrigger id="jama-bank"><SelectValue placeholder={t('bill.bank')} /></SelectTrigger>
              <SelectContent>{banks?.map((b) => <SelectItem key={b.id} value={String(b.id)}>{b.bankName} · {b.accountNo}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        )}
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="jama-remark">{t('bill.pay_remark')}</Label>
          <Input id="jama-remark" maxLength={300} value={remark} onChange={(e) => setRemark(e.target.value)} />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
        <Button disabled={!body || create.isPending} onClick={() => void save().catch(() => { /* useApiMutation toasts the error */ })}>{t('jama.save')}</Button>
      </DialogFooter>
    </>
  )
}
