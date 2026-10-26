import { CheckCircle2, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { PartyPicker } from '@/components/PartyPicker'
import { SelectBranchForTxn } from '@/components/SelectBranchForTxn'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useBankAccounts, useParty } from '@/lib/appQueries'
import { useAuth } from '@/lib/auth'
import { useT } from '@/lib/i18n'
import { usePartyBalance } from '@/lib/billingQueries'
import { useCreateUdhar, usePendingBills } from '@/lib/udhariQueries'
import { businessDayISO, METALS, moneyToMetal, type PartyRefDto } from '@/shared'

const n = (s: string) => Number(s) || 0
// float + w-full makes the <legend> a normal full-width header band (fieldset is flow-root to contain it)
const LEGEND = 'float-left w-full border-b bg-muted/40 px-6 py-4 text-lg font-bold'
const today = businessDayISO
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
  const t = useT()
  const create = useCreateUdhar()
  const { activeBranch } = useAuth()
  const branchReady = activeBranch !== '' && activeBranch !== 'all' // udhar posts to one branch
  const { data: banks } = useBankAccounts()
  const [party, setParty] = useState<PartyRefDto | null>(null)
  // ?partyId= pre-fills the party (Udhar Ledger row "New entry"); only until the user picks one
  const [params] = useSearchParams()
  const presetId = Number(params.get('partyId')) || undefined
  const { data: preset } = useParty(presetId)
  const [presetUsed, setPresetUsed] = useState(false)
  if (preset && !presetUsed) {
    setPresetUsed(true)
    setParty({ id: preset.id, type: preset.type, name: preset.name, mobile: preset.mobile, shopName: preset.shopName })
  }
  const [saved, setSaved] = useState<{ id: number; txnNo: number } | null>(null)
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
    const res = await create.mutateAsync({
      partyId: party.id, txnDate,
      cashOut: n(f.cashOut), onlineOut: n(f.onlineOut), outBankId: n(f.onlineOut) > 0 ? Number(f.outBankId) : undefined,
      cashIn: n(f.cashIn), onlineIn: n(f.onlineIn), inBankId: n(f.onlineIn) > 0 ? Number(f.inBankId) : undefined,
      goldOut: n(f.goldOut), goldIn: n(f.goldIn), silverOut: n(f.silverOut), silverIn: n(f.silverIn),
      bhav: bhavOn ? { direction: bhav.direction, metal: bhav.metal, amount: n(bhav.amount), rate: n(bhav.rate), unitGrams: Number(bhav.unitGrams) } : undefined,
      settleBillId: settleBillId ? Number(settleBillId) : undefined,
      remark: f.remark || undefined,
    })
    setSaved({ id: res.id, txnNo: res.txnNo })
    clearAmounts()
  }
  const clearAmounts = () => {
    setF({ cashOut: '0', onlineOut: '0', outBankId: '', cashIn: '0', onlineIn: '0', inBankId: '', goldOut: '0', goldIn: '0', silverOut: '0', silverIn: '0', remark: '' })
    setBhavOn(false); setSettleBillId('')
  }
  const startNew = () => { clearAmounts(); setParty(null); setTxnDate(today()); setSaved(null) }

  const bankSelect = (value: string, onChange: (v: string) => void, label: string) => (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={label}><SelectValue placeholder={t('udhari.bank')} /></SelectTrigger>
      <SelectContent>{banks?.map((b) => <SelectItem key={b.id} value={String(b.id)}>{b.bankName} · {b.accountNo}</SelectItem>)}</SelectContent>
    </Select>
  )

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{t('udhari.new_intro')}</p>
        <Button variant="outline" size="sm" onClick={startNew}><RotateCcw aria-hidden />{t('udhari.new_entry')}</Button>
      </div>
      {saved && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-green-600/30 bg-green-500/10 px-4 py-3 text-sm">
          <CheckCircle2 className="size-4 text-green-600 dark:text-green-500" aria-hidden />
          <span>{t('udhari.saved_banner', { no: saved.txnNo })}</span>
          <Link to={`/app/udhari/txn/${saved.id}`} className="ml-auto font-semibold text-brand-strong hover:underline">{t('udhari.view_receipt')}</Link>
        </div>
      )}
      {!branchReady && <SelectBranchForTxn note={t('udhari.branch_note')} />}

      <Card className="grid gap-4 p-6 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="u-party">{t('udhari.party')}</Label>
          <PartyPicker value={party} onChange={setParty} placeholder={t('udhari.search_party')} id="u-party" ariaLabel="Party" />
          {party && <p className="w-fit rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">{t('udhari.old_balance')} {balance ? bal(n(o.amount), n(o.gold), n(o.silver)) : '—'}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="u-date">{t('udhari.date')}</Label>
          <Input id="u-date" type="date" value={txnDate} onChange={(e) => setTxnDate(e.target.value)} />
        </div>
      </Card>

      <div className="grid gap-6 sm:grid-cols-2">
        <Card className="overflow-hidden">
        <fieldset className="flow-root min-w-0">
          <legend className={LEGEND}>{t('udhari.given')}</legend>
          <div className="clear-both space-y-4 p-6">
          <div className="grid grid-cols-2 gap-4">
            <NumField id="u-cashout" label={t('udhari.cash')} value={f.cashOut} onChange={(v) => set('cashOut', v)} />
            <NumField id="u-onlineout" label={t('udhari.online')} value={f.onlineOut} onChange={(v) => set('onlineOut', v)} />
          </div>
          {n(f.onlineOut) > 0 && <div className="space-y-1.5"><Label>{t('udhari.out_bank')}</Label>{bankSelect(f.outBankId, (v) => set('outBankId', v), 'Out bank')}</div>}
          <div className="grid grid-cols-2 gap-4">
            <NumField id="u-goldout" label={t('udhari.gold_g')} value={f.goldOut} onChange={(v) => set('goldOut', v)} step="0.001" />
            <NumField id="u-silverout" label={t('udhari.silver_g')} value={f.silverOut} onChange={(v) => set('silverOut', v)} step="0.001" />
          </div>
          </div>
        </fieldset>
        </Card>

        <Card className="overflow-hidden">
        <fieldset className="flow-root min-w-0">
          <legend className={LEGEND}>{t('udhari.received')}</legend>
          <div className="clear-both space-y-4 p-6">
          <div className="grid grid-cols-2 gap-4">
            <NumField id="u-cashin" label={t('udhari.cash')} value={f.cashIn} onChange={(v) => set('cashIn', v)} />
            <NumField id="u-onlinein" label={t('udhari.online')} value={f.onlineIn} onChange={(v) => set('onlineIn', v)} />
          </div>
          {n(f.onlineIn) > 0 && <div className="space-y-1.5"><Label>{t('udhari.in_bank')}</Label>{bankSelect(f.inBankId, (v) => set('inBankId', v), 'In bank')}</div>}
          <div className="grid grid-cols-2 gap-4">
            <NumField id="u-goldin" label={t('udhari.gold_g')} value={f.goldIn} onChange={(v) => set('goldIn', v)} step="0.001" />
            <NumField id="u-silverin" label={t('udhari.silver_g')} value={f.silverIn} onChange={(v) => set('silverIn', v)} step="0.001" />
          </div>
          </div>
        </fieldset>
        </Card>
      </div>

      <Card className="overflow-hidden">
      <fieldset className="flow-root min-w-0">
        <legend className={LEGEND}>
          <label className="flex items-center gap-2"><input type="checkbox" className="size-4 accent-brand" checked={bhavOn} onChange={(e) => setBhavOn(e.target.checked)} /> {t('udhari.bhav_cut')}</label>
        </legend>
        {bhavOn && (
          <div className="clear-both grid items-end gap-4 p-6 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>{t('udhari.direction')}</Label>
              <Select value={bhav.direction} onValueChange={(v) => setB('direction', v)}>
                <SelectTrigger className="w-full" aria-label="Bhav direction"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="METAL_TO_MONEY">{t('udhari.metal_to_money')}</SelectItem><SelectItem value="MONEY_TO_METAL">{t('udhari.money_to_metal')}</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t('udhari.metal')}</Label>
              <Select value={bhav.metal} onValueChange={(v) => setB('metal', v)}>
                <SelectTrigger className="w-full" aria-label="Bhav metal"><SelectValue /></SelectTrigger>
                <SelectContent>{METALS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t('udhari.per')}</Label>
              <Select value={bhav.unitGrams} onValueChange={(v) => setB('unitGrams', v)}>
                <SelectTrigger className="w-full" aria-label="Rate unit grams"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="1">1 g</SelectItem><SelectItem value="10">10 g</SelectItem><SelectItem value="1000">1 kg</SelectItem></SelectContent>
              </Select>
            </div>
            <NumField id="u-bhavamt" label={t('udhari.amount')} value={bhav.amount} onChange={(v) => setB('amount', v)} />
            <NumField id="u-bhavrate" label={t('udhari.rate')} value={bhav.rate} onChange={(v) => setB('rate', v)} />
            {n(bhav.amount) > 0 && n(bhav.rate) > 0 && (
              <span className="pb-2 text-sm font-semibold text-brand-strong">≈ {moneyToMetal(n(bhav.amount), n(bhav.rate), n(bhav.unitGrams))} g {bhav.metal}</span>
            )}
          </div>
        )}
      </fieldset>
      </Card>

      <Card className="space-y-4 p-6">
      {pending && pending.items.length > 0 && (
        <div className="space-y-1.5">
          <Label>{t('udhari.settle')}</Label>
          <Select value={settleBillId || 'none'} onValueChange={(v) => setSettleBillId(v === 'none' ? '' : v)}>
            <SelectTrigger className="w-full sm:max-w-md" aria-label="Settle bill"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t('udhari.none')}</SelectItem>
              {pending.items.filter((b) => b.kind === 'SELL' && Number(b.balance) > 0).map((b) => (
                <SelectItem key={b.id} value={String(b.id)}>{t('udhari.settle_option', { billNo: b.billNo, balance: b.balance })}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="u-remark">{t('udhari.remark')}</Label>
        <Input id="u-remark" value={f.remark} onChange={(e) => set('remark', e.target.value)} />
      </div>
      </Card>

      <div className="hero-card flex flex-wrap items-center gap-4 p-6 tabular-nums">
        <div className="pointer-events-none absolute -top-12 -right-12 size-40 rounded-full bg-brand/20 blur-3xl" aria-hidden />
        <div className="min-w-0 space-y-1">
          <div className="text-xs font-semibold uppercase tracking-widest text-white/60">{t('udhari.new_balance')}</div>
          <div className="text-2xl font-extrabold break-words sm:text-3xl">{bal(amount, gold, silver)}</div>
          <div className="text-xs text-white/60">{t('udhari.sign_hint')}</div>
        </div>
        <Button size="lg" className="ml-auto" disabled={!valid || create.isPending} onClick={submit}>
          {create.isPending ? t('party.saving') : t('udhari.save')}
        </Button>
      </div>
    </div>
  )
}
