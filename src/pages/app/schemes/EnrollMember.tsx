import { useNavigate } from 'react-router-dom'
import { useState } from 'react'

import { PartyPicker } from '@/components/PartyPicker'
import { SelectBranchForTxn } from '@/components/SelectBranchForTxn'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useBankAccounts } from '@/lib/appQueries'
import { useAuth } from '@/lib/auth'
import { useEnroll, useSchemeGroups, useSchemes } from '@/lib/schemesQueries'
import { businessDayISO, SCHEME_PAY_MEDIUMS, type PartyRefDto, type SchemeDto } from '@/shared'

const today = businessDayISO
const n = (s: string) => Number(s) || 0

export function EnrollMember() {
  const navigate = useNavigate()
  const { activeBranch } = useAuth()
  const branchReady = activeBranch !== '' && activeBranch !== 'all'
  const { data: banks } = useBankAccounts()
  const { data: schemes } = useSchemes({ active: 'true', pageSize: 100 })
  const enroll = useEnroll()

  const [schemeId, setSchemeId] = useState('')
  const [party, setParty] = useState<PartyRefDto | null>(null)
  const { data: groups } = useSchemeGroups(schemeId ? Number(schemeId) : undefined)
  const scheme: SchemeDto | undefined = schemes?.items.find((s) => String(s.id) === schemeId)
  const gold = scheme?.type === 'GOLD'

  const [f, setF] = useState({ groupId: '', assignId: '', displayName: '', emiAmount: '', startDate: today(), tokenAmount: '0' })
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }))
  const [payFirst, setPayFirst] = useState(false)
  const [pay, setPay] = useState({ amount: '', medium: 'CASH', bankAccountId: '', rate: '' })
  const setPayF = (k: keyof typeof pay, v: string) => setPay((s) => ({ ...s, [k]: v }))

  const pickParty = (p: PartyRefDto | null) => { setParty(p); if (p && !f.displayName) set('displayName', p.name) }
  const emi = f.emiAmount || scheme?.emiAmount || ''

  const payValid = !payFirst || (n(pay.amount || emi) > 0 && (pay.medium !== 'ONLINE' || pay.bankAccountId))
  const valid = branchReady && !!schemeId && !!party && f.assignId.trim() && f.displayName.trim() && payValid

  const submit = async () => {
    const firstPayment = payFirst
      ? { amount: n(pay.amount || emi), medium: pay.medium, bankAccountId: pay.medium === 'ONLINE' ? Number(pay.bankAccountId) : undefined, rate: gold && pay.rate ? n(pay.rate) : undefined }
      : undefined
    const saved = await enroll.mutateAsync({
      schemeId: Number(schemeId), groupId: f.groupId ? Number(f.groupId) : undefined, partyId: party!.id,
      assignId: f.assignId.trim(), displayName: f.displayName.trim(),
      emiAmount: f.emiAmount ? n(f.emiAmount) : undefined, startDate: f.startDate,
      tokenAmount: n(f.tokenAmount), firstPayment,
    })
    navigate(`/app/schemes/members/${saved.id}`)
  }

  return (
    <div className="max-w-2xl space-y-5">
      {!branchReady && <SelectBranchForTxn note="Enrolment is booked at one branch. Select a branch." />}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5"><Label>Scheme</Label>
          <Select value={schemeId} onValueChange={(v) => { setSchemeId(v); set('groupId', '') }}><SelectTrigger aria-label="Scheme"><SelectValue placeholder="Select scheme" /></SelectTrigger>
            <SelectContent>{schemes?.items.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name} · {s.type}</SelectItem>)}</SelectContent></Select>
        </div>
        <div className="space-y-1.5"><Label>Group (optional)</Label>
          <Select value={f.groupId || 'none'} onValueChange={(v) => set('groupId', v === 'none' ? '' : v)} disabled={!groups?.length}><SelectTrigger aria-label="Group"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="none">No group</SelectItem>{groups?.map((g) => <SelectItem key={g.id} value={String(g.id)}>{g.name}{g.memberLimit ? ` (${g.memberCount}/${g.memberLimit})` : ''}</SelectItem>)}</SelectContent></Select>
        </div>
        <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="en-party">Party</Label><PartyPicker value={party} onChange={pickParty} placeholder="Search name / mobile" id="en-party" ariaLabel="Party" /></div>
        <div className="space-y-1.5"><Label htmlFor="en-assign">Assign ID</Label><Input id="en-assign" value={f.assignId} onChange={(e) => set('assignId', e.target.value)} /></div>
        <div className="space-y-1.5"><Label htmlFor="en-name">Display name</Label><Input id="en-name" value={f.displayName} onChange={(e) => set('displayName', e.target.value)} /></div>
        <div className="space-y-1.5"><Label htmlFor="en-emi">EMI ₹ {scheme ? `(default ${scheme.emiAmount})` : ''}</Label><Input id="en-emi" type="number" placeholder={scheme?.emiAmount} value={f.emiAmount} onChange={(e) => set('emiAmount', e.target.value)} /></div>
        <div className="space-y-1.5"><Label htmlFor="en-start">Start date</Label><Input id="en-start" type="date" value={f.startDate} onChange={(e) => set('startDate', e.target.value)} /></div>
        <div className="space-y-1.5"><Label htmlFor="en-token">Joining token ₹</Label><Input id="en-token" type="number" value={f.tokenAmount} onChange={(e) => set('tokenAmount', e.target.value)} /></div>
      </div>

      <div className="space-y-3 rounded-md border p-4">
        <label className="flex items-center gap-2 text-sm font-medium"><Checkbox checked={payFirst} onCheckedChange={(v) => setPayFirst(v === true)} aria-label="Collect first EMI" /> Collect first EMI now</label>
        {payFirst && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="en-pay-amt">Amount ₹</Label><Input id="en-pay-amt" type="number" placeholder={emi} value={pay.amount} onChange={(e) => setPayF('amount', e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Medium</Label>
              <Select value={pay.medium} onValueChange={(v) => setPayF('medium', v)}><SelectTrigger aria-label="Medium"><SelectValue /></SelectTrigger>
                <SelectContent>{SCHEME_PAY_MEDIUMS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select>
            </div>
            {pay.medium === 'ONLINE' && (
              <div className="space-y-1.5 sm:col-span-2"><Label>Bank</Label>
                <Select value={pay.bankAccountId} onValueChange={(v) => setPayF('bankAccountId', v)}><SelectTrigger aria-label="Bank account"><SelectValue placeholder="Bank" /></SelectTrigger>
                  <SelectContent>{banks?.map((b) => <SelectItem key={b.id} value={String(b.id)}>{b.bankName} · {b.accountNo}</SelectItem>)}</SelectContent></Select>
              </div>
            )}
            {gold && <div className="space-y-1.5"><Label htmlFor="en-pay-rate">Gold rate /10g (blank = today)</Label><Input id="en-pay-rate" type="number" value={pay.rate} onChange={(e) => setPayF('rate', e.target.value)} /></div>}
          </div>
        )}
      </div>

      <Button disabled={!valid || enroll.isPending} onClick={() => void submit().catch(() => {})}>{enroll.isPending ? 'Enrolling…' : 'Enrol member'}</Button>
    </div>
  )
}
