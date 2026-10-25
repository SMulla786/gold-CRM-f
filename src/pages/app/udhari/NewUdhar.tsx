import { useState } from 'react'

import { PartyPicker } from '@/components/PartyPicker'
import { SelectBranchForTxn } from '@/components/SelectBranchForTxn'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useBankAccounts } from '@/lib/appQueries'
import { useAuth } from '@/lib/auth'
import { usePartyBalance } from '@/lib/billingQueries'
import { useCreateUdhar, usePendingBills } from '@/lib/udhariQueries'
import { METALS, moneyToMetal, type PartyRefDto } from '@/shared'

const n = (s: string) => Number(s) || 0
const today = () => new Date().toISOString().slice(0, 10)
const bal = (amount: number, gold: number, silver: number) =>
  `₹${amount.toFixed(2)}${gold ? ` · ${gold.toFixed(3)}g Au` : ''}${silver ? ` · ${silver.toFixed(3)}g Ag` : ''}`

function NumField({ id, label, value, onChange, step = '0.01' }: { id: string; label: string; value: string; onChange: (v: string) => void; step?: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type="number" step={step} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}

export function NewUdhar() {
  const create = useCreateUdhar()
  const { activeBranch } = useAuth()
  const branchReady = activeBranch !== '' && activeBranch !== 'all' // udhar posts to one branch
  const { data: banks } = useBankAccounts()
  const [party, setParty] = useState<PartyRefDto | null>(null)
  const { data: balance } = usePartyBalance(party?.id)
  const { data: pending } = usePendingBills({ partyId: party?.id, pageSize: 50 }, !!party)

  const [txnDate, setTxnDate] = useState(today())
  const [f, setF] = useState({ cashOut: '0', onlineOut: '0', outBankId: '', cashIn: '0', onlineIn: '0', inBankId: '', goldOut: '0', goldIn: '0', silverOut: '0', silverIn: '0', remark: '' })
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }))
  const [bhavOn, setBhavOn] = useState(false)
  const [bhav, setBhav] = useState({ direction: 'METAL_TO_MONEY', metal: 'GOLD', amount: '', rate: '', unitGrams: '10' })
  const setB = (k: keyof typeof bhav, v: string) => setBhav((s) => ({ ...s, [k]: v }))
  const [settleBillId, setSettleBillId] = useState('')

  // live final balance (sign: + party owes shop)
  const o = balance ?? { amount: '0', gold: '0', silver: '0' }
  let amount = n(o.amount) + (n(f.cashOut) + n(f.onlineOut)) - (n(f.cashIn) + n(f.onlineIn))
  let gold = n(o.gold) + n(f.goldOut) - n(f.goldIn)
  let silver = n(o.silver) + n(f.silverOut) - n(f.silverIn)
  if (bhavOn && n(bhav.amount) > 0 && n(bhav.rate) > 0) {
    const w = Number(moneyToMetal(n(bhav.amount), n(bhav.rate), n(bhav.unitGrams)))
    const sign = bhav.direction === 'MONEY_TO_METAL' ? 1 : -1
    amount -= sign * n(bhav.amount)
    if (bhav.metal === 'GOLD') gold += sign * w
    else silver += sign * w
  }

  const movements = n(f.cashOut) + n(f.onlineOut) + n(f.cashIn) + n(f.onlineIn) + n(f.goldOut) + n(f.goldIn) + n(f.silverOut) + n(f.silverIn)
  const bhavValid = !bhavOn || (n(bhav.amount) > 0 && n(bhav.rate) > 0)
  const banksOk = (n(f.onlineOut) === 0 || f.outBankId) && (n(f.onlineIn) === 0 || f.inBankId)
  const settleOk = !settleBillId || n(f.cashIn) + n(f.onlineIn) > 0
  const valid = branchReady && !!party && (movements > 0 || bhavOn) && bhavValid && banksOk && settleOk

  const submit = async () => {
    if (!party) return
    await create.mutateAsync({
      partyId: party.id, txnDate,
      cashOut: n(f.cashOut), onlineOut: n(f.onlineOut), outBankId: n(f.onlineOut) > 0 ? Number(f.outBankId) : undefined,
      cashIn: n(f.cashIn), onlineIn: n(f.onlineIn), inBankId: n(f.onlineIn) > 0 ? Number(f.inBankId) : undefined,
      goldOut: n(f.goldOut), goldIn: n(f.goldIn), silverOut: n(f.silverOut), silverIn: n(f.silverIn),
      bhav: bhavOn ? { direction: bhav.direction, metal: bhav.metal, amount: n(bhav.amount), rate: n(bhav.rate), unitGrams: Number(bhav.unitGrams) } : undefined,
      settleBillId: settleBillId ? Number(settleBillId) : undefined,
      remark: f.remark || undefined,
    })
    setF({ cashOut: '0', onlineOut: '0', outBankId: '', cashIn: '0', onlineIn: '0', inBankId: '', goldOut: '0', goldIn: '0', silverOut: '0', silverIn: '0', remark: '' })
    setBhavOn(false); setSettleBillId('')
  }

  const bankSelect = (value: string, onChange: (v: string) => void, label: string) => (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={label}><SelectValue placeholder="Bank" /></SelectTrigger>
      <SelectContent>{banks?.map((b) => <SelectItem key={b.id} value={String(b.id)}>{b.bankName} · {b.accountNo}</SelectItem>)}</SelectContent>
    </Select>
  )

  return (
    <div className="max-w-3xl space-y-5">
      {!branchReady && <SelectBranchForTxn note="Udhar posts to one branch. Select a branch for this entry." />}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="u-party">Party</Label>
          <PartyPicker value={party} onChange={setParty} placeholder="Search name / mobile" id="u-party" ariaLabel="Party" />
          {party && <p className="text-xs text-muted-foreground">Old balance: {balance ? bal(n(o.amount), n(o.gold), n(o.silver)) : '—'}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="u-date">Date</Label>
          <Input id="u-date" type="date" value={txnDate} onChange={(e) => setTxnDate(e.target.value)} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <fieldset className="space-y-3 rounded-md border p-3">
          <legend className="px-1 text-sm font-medium">Given to party (owes more)</legend>
          <div className="grid grid-cols-2 gap-3">
            <NumField id="u-cashout" label="Cash ₹" value={f.cashOut} onChange={(v) => set('cashOut', v)} />
            <NumField id="u-onlineout" label="Online ₹" value={f.onlineOut} onChange={(v) => set('onlineOut', v)} />
          </div>
          {n(f.onlineOut) > 0 && <div className="space-y-1.5"><Label>Out bank</Label>{bankSelect(f.outBankId, (v) => set('outBankId', v), 'Out bank')}</div>}
          <div className="grid grid-cols-2 gap-3">
            <NumField id="u-goldout" label="Gold (g)" value={f.goldOut} onChange={(v) => set('goldOut', v)} step="0.001" />
            <NumField id="u-silverout" label="Silver (g)" value={f.silverOut} onChange={(v) => set('silverOut', v)} step="0.001" />
          </div>
        </fieldset>

        <fieldset className="space-y-3 rounded-md border p-3">
          <legend className="px-1 text-sm font-medium">Received from party (owes less)</legend>
          <div className="grid grid-cols-2 gap-3">
            <NumField id="u-cashin" label="Cash ₹" value={f.cashIn} onChange={(v) => set('cashIn', v)} />
            <NumField id="u-onlinein" label="Online ₹" value={f.onlineIn} onChange={(v) => set('onlineIn', v)} />
          </div>
          {n(f.onlineIn) > 0 && <div className="space-y-1.5"><Label>In bank</Label>{bankSelect(f.inBankId, (v) => set('inBankId', v), 'In bank')}</div>}
          <div className="grid grid-cols-2 gap-3">
            <NumField id="u-goldin" label="Gold (g)" value={f.goldIn} onChange={(v) => set('goldIn', v)} step="0.001" />
            <NumField id="u-silverin" label="Silver (g)" value={f.silverIn} onChange={(v) => set('silverIn', v)} step="0.001" />
          </div>
        </fieldset>
      </div>

      <fieldset className="space-y-3 rounded-md border p-3">
        <legend className="px-1 text-sm font-medium">
          <label className="flex items-center gap-2"><input type="checkbox" checked={bhavOn} onChange={(e) => setBhavOn(e.target.checked)} /> Bhav cut</label>
        </legend>
        {bhavOn && (
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label>Direction</Label>
              <Select value={bhav.direction} onValueChange={(v) => setB('direction', v)}>
                <SelectTrigger className="w-44" aria-label="Bhav direction"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="METAL_TO_MONEY">Metal → Money</SelectItem><SelectItem value="MONEY_TO_METAL">Money → Metal</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Metal</Label>
              <Select value={bhav.metal} onValueChange={(v) => setB('metal', v)}>
                <SelectTrigger className="w-24" aria-label="Bhav metal"><SelectValue /></SelectTrigger>
                <SelectContent>{METALS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <NumField id="u-bhavamt" label="Amount ₹" value={bhav.amount} onChange={(v) => setB('amount', v)} />
            <NumField id="u-bhavrate" label="Rate" value={bhav.rate} onChange={(v) => setB('rate', v)} />
            <div className="space-y-1.5">
              <Label>Per</Label>
              <Select value={bhav.unitGrams} onValueChange={(v) => setB('unitGrams', v)}>
                <SelectTrigger className="w-24" aria-label="Rate unit grams"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="1">1 g</SelectItem><SelectItem value="10">10 g</SelectItem><SelectItem value="1000">1 kg</SelectItem></SelectContent>
              </Select>
            </div>
            {n(bhav.amount) > 0 && n(bhav.rate) > 0 && (
              <span className="pb-2 text-sm text-muted-foreground">≈ {moneyToMetal(n(bhav.amount), n(bhav.rate), n(bhav.unitGrams))} g {bhav.metal}</span>
            )}
          </div>
        )}
      </fieldset>

      {pending && pending.items.length > 0 && (
        <div className="space-y-1.5">
          <Label>Settle a pending bill (applies the cash/online received)</Label>
          <Select value={settleBillId || 'none'} onValueChange={(v) => setSettleBillId(v === 'none' ? '' : v)}>
            <SelectTrigger className="w-80" aria-label="Settle bill"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {pending.items.filter((b) => b.kind === 'SELL' && Number(b.balance) > 0).map((b) => (
                <SelectItem key={b.id} value={String(b.id)}>{b.billNo} · balance ₹{b.balance}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="u-remark">Remark</Label>
        <Input id="u-remark" value={f.remark} onChange={(e) => set('remark', e.target.value)} />
      </div>

      <div className="flex items-center gap-4 rounded-md border bg-muted/40 p-3">
        <div className="text-sm">
          <div className="text-muted-foreground">New balance</div>
          <div className="font-medium">{bal(amount, gold, silver)}</div>
          <div className="text-xs text-muted-foreground">+ = party owes shop, − = shop owes party</div>
        </div>
        <Button className="ml-auto" disabled={!valid || create.isPending} onClick={submit}>
          {create.isPending ? 'Saving…' : 'Save udhar'}
        </Button>
      </div>
    </div>
  )
}
