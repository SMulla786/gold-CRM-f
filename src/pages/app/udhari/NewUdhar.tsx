import { CheckCircle2, Pencil, RotateCcw, Search } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { MpinDialog } from '@/components/MpinDialog'
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
import { useCreateUdhar, usePendingBills, useUdharEntries, useUdharTxn, useUpdateUdhar } from '@/lib/udhariQueries'
import { businessDayISO, METALS, metalToMoney, moneyToMetal, type PartyRefDto } from '@/shared'

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
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
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
  const { data: history } = useUdharEntries({ partyId: party?.id, pageSize: 5 }, !!party) // last 5 movements for this party

  const [txnDate, setTxnDate] = useState(today())
  const [f, setF] = useState({ cashOut: '0', onlineOut: '0', outBankId: '', cashIn: '0', onlineIn: '0', inBankId: '', goldOut: '0', goldIn: '0', silverOut: '0', silverIn: '0', remark: '' })
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }))
  const [bhavOn, setBhavOn] = useState(false)
  const [bhav, setBhav] = useState({ direction: 'METAL_TO_MONEY', metal: 'GOLD', amount: '', weight: '', rate: '', unitGrams: '10' })
  const setB = (k: keyof typeof bhav, v: string) => setBhav((s) => ({ ...s, [k]: v }))
  const [bhavBy, setBhavBy] = useState<'AMOUNT' | 'WEIGHT'>('AMOUNT')
  const [settleBillId, setSettleBillId] = useState('')
  const [billQ, setBillQ] = useState('')

  // ?edit=<udhar id> (receipt "Edit"): load the txn into the form once; Save then re-posts it under MPIN
  const editId = Number(params.get('edit')) || undefined
  const { data: editing } = useUdharTxn(editId)
  const update = useUpdateUdhar()
  const [loadedEdit, setLoadedEdit] = useState<number>()
  const [confirmEdit, setConfirmEdit] = useState(false)
  if (editing && !editing.isDeleted && loadedEdit !== editing.id) {
    setLoadedEdit(editing.id)
    setParty(editing.party)
    setTxnDate(editing.txnDate)
    setF({
      cashOut: editing.cashOut, onlineOut: editing.onlineOut, outBankId: editing.outBank ? String(editing.outBank.id) : '',
      cashIn: editing.cashIn, onlineIn: editing.onlineIn, inBankId: editing.inBank ? String(editing.inBank.id) : '',
      goldOut: editing.goldOut, goldIn: editing.goldIn, silverOut: editing.silverOut, silverIn: editing.silverIn, remark: editing.remark ?? '',
    })
    setBhavOn(!!editing.bhav)
    if (editing.bhav) setBhav({ direction: editing.bhav.direction, metal: editing.bhav.metal, amount: editing.bhav.amount, weight: editing.bhav.weight, rate: editing.bhav.rate, unitGrams: String(editing.bhav.unitGrams) })
    setBhavBy('AMOUNT')
    setSettleBillId(editing.settleBill ? String(editing.settleBill.id) : '')
  }
  const isEdit = !!editing && !editing.isDeleted && loadedEdit === editing.id

  // bhav by weight: the ₹ amount is derived (server still converts amount → weight, so the saved weight is the ≈ shown)
  const bhavAmount = bhavBy === 'WEIGHT' ? Number(metalToMoney(n(bhav.weight), n(bhav.rate), n(bhav.unitGrams))) : n(bhav.amount)

  // live final balance (sign: + party owes shop). Editing: start from the balance without this txn's own postings.
  const o = (isEdit && party?.id === editing.party.id ? editing.old : balance) ?? { amount: '0', gold: '0', silver: '0' }
  let amount = n(o.amount) + (n(f.cashOut) + n(f.onlineOut)) - (n(f.cashIn) + n(f.onlineIn))
  let gold = n(o.gold) + n(f.goldOut) - n(f.goldIn)
  let silver = n(o.silver) + n(f.silverOut) - n(f.silverIn)
  const beforeCut = bal(amount, gold, silver) // what the bhav cut converts from
  if (bhavOn && bhavAmount > 0 && n(bhav.rate) > 0) {
    const w = Number(moneyToMetal(bhavAmount, n(bhav.rate), n(bhav.unitGrams)))
    const sign = bhav.direction === 'MONEY_TO_METAL' ? 1 : -1
    amount -= sign * bhavAmount
    if (bhav.metal === 'GOLD') gold += sign * w
    else silver += sign * w
  }

  const movements = n(f.cashOut) + n(f.onlineOut) + n(f.cashIn) + n(f.onlineIn) + n(f.goldOut) + n(f.goldIn) + n(f.silverOut) + n(f.silverIn)
  const bhavValid = !bhavOn || (bhavAmount > 0 && n(bhav.rate) > 0)
  const banksOk = (n(f.onlineOut) === 0 || f.outBankId) && (n(f.onlineIn) === 0 || f.inBankId)
  // SELL bills take the received money, PURCHASE bills the money paid out (never more than the purchase due)
  const settleBill = (pending?.items ?? []).find((b) => String(b.id) === settleBillId)
  const paidOut = n(f.cashOut) + n(f.onlineOut)
  const settleOk = !settleBillId || (settleBill?.kind === 'PURCHASE' ? paidOut > 0 && paidOut <= Number(settleBill.balance) : settleBill ? n(f.cashIn) + n(f.onlineIn) > 0 : n(f.cashIn) + n(f.onlineIn) + paidOut > 0)
  // an edit keeps the txn's own branch, so it needs no active branch
  const valid = (branchReady || isEdit) && !!party && (movements > 0 || bhavOn) && bhavValid && banksOk && settleOk

  const body = () => ({
    partyId: party!.id, txnDate,
    cashOut: n(f.cashOut), onlineOut: n(f.onlineOut), outBankId: n(f.onlineOut) > 0 ? Number(f.outBankId) : undefined,
    cashIn: n(f.cashIn), onlineIn: n(f.onlineIn), inBankId: n(f.onlineIn) > 0 ? Number(f.inBankId) : undefined,
    goldOut: n(f.goldOut), goldIn: n(f.goldIn), silverOut: n(f.silverOut), silverIn: n(f.silverIn),
    bhav: bhavOn ? { direction: bhav.direction, metal: bhav.metal, amount: bhavAmount, rate: n(bhav.rate), unitGrams: Number(bhav.unitGrams) } : undefined,
    settleBillId: settleBillId ? Number(settleBillId) : undefined,
    remark: f.remark || undefined,
  })
  const submit = async () => {
    if (!party) return
    if (isEdit) { setConfirmEdit(true); return }
    const res = await create.mutateAsync(body())
    setSaved({ id: res.id, txnNo: res.txnNo })
    clearAmounts()
  }
  const clearAmounts = () => {
    setF({ cashOut: '0', onlineOut: '0', outBankId: '', cashIn: '0', onlineIn: '0', inBankId: '', goldOut: '0', goldIn: '0', silverOut: '0', silverIn: '0', remark: '' })
    setBhavOn(false); setSettleBillId(''); setBillQ('')
  }
  const startNew = () => {
    if (editId) setParams({}) // leave edit mode
    clearAmounts(); setParty(null); setTxnDate(today()); setSaved(null)
  }

  const bankSelect = (value: string, onChange: (v: string) => void, label: string) => (
    banks && banks.length === 0 ? (
      <p className="text-sm text-muted-foreground">{t('udhari.no_banks')} <Link to="/app/settings/bank-accounts" className="font-medium text-brand-strong hover:underline">{t('udhari.add_bank')}</Link></p>
    ) : (
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger aria-label={label}><SelectValue placeholder={t('udhari.bank')} /></SelectTrigger>
        <SelectContent>{banks?.map((b) => <SelectItem key={b.id} value={String(b.id)}>{b.bankName} · {b.accountNo}</SelectItem>)}</SelectContent>
      </Select>
    )
  )
  // settle-bill picker: open SELL + PURCHASE bills, narrowed by bill no / items; the chosen (or edited txn's) bill always stays listed
  const kw = billQ.trim().toLowerCase()
  const settleBills = (pending?.items ?? []).filter((b) => (b.kind === 'SELL' || b.kind === 'PURCHASE') && Number(b.balance) > 0 && (!kw || String(b.id) === settleBillId || b.billNo.toLowerCase().includes(kw) || (b.itemsSummary ?? '').toLowerCase().includes(kw)))
  const editBill = isEdit && editing.settleBill && !settleBills.some((b) => b.id === editing.settleBill!.id) ? editing.settleBill : null

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{t('udhari.new_intro')}</p>
        <Button variant="outline" size="sm" onClick={startNew}><RotateCcw aria-hidden />{t('udhari.new_entry')}</Button>
      </div>
      {isEdit && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
          <Pencil className="size-4 text-amber-600 dark:text-amber-500" aria-hidden />
          <span>{t('udhari.edit_banner', { no: editing.txnNo, branch: editing.branch.name })}</span>
          <Link to={`/app/udhari/txn/${editing.id}`} className="ml-auto font-semibold text-brand-strong hover:underline">{t('common.cancel')}</Link>
        </div>
      )}
      {editing?.isDeleted && <p className="text-sm text-destructive">{t('udhari.deleted_no_edit', { no: editing.txnNo })}</p>}
      {saved && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-green-600/30 bg-green-500/10 px-4 py-3 text-sm">
          <CheckCircle2 className="size-4 text-green-600 dark:text-green-500" aria-hidden />
          <span>{t('udhari.saved_banner', { no: saved.txnNo })}</span>
          <Link to={`/app/udhari/txn/${saved.id}`} className="ml-auto font-semibold text-brand-strong hover:underline">{t('udhari.view_receipt')}</Link>
        </div>
      )}
      {!branchReady && !isEdit && <SelectBranchForTxn note={t('udhari.branch_note')} />}

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

      {party && !!history?.items.length && (
        <Card className="overflow-hidden text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-6 py-3">
            <span className="font-bold">{t('udhari.recent_txns')}</span>
            <Link to={`/app/udhari/statement/${party.id}`} className="font-medium text-brand-strong hover:underline">{t('udhari.statement')}</Link>
          </div>
          <ul className="divide-y px-6">
            {history.items.map((r) => (
              <li key={`${r.source}-${r.sourceId}-${r.createdAt}`} className={`flex flex-wrap justify-between gap-2 py-2 tabular-nums ${r.isReversal ? 'text-muted-foreground line-through' : ''}`}>
                <span className="text-muted-foreground">{new Date(r.txnDate).toLocaleDateString('en-IN')} · {r.source} · {r.reference}</span>
                <span>{[Number(r.amount) ? `₹${r.amount}` : '', Number(r.gold) ? `${r.gold}g Au` : '', Number(r.silver) ? `${r.silver}g Ag` : ''].filter(Boolean).join(' · ') || '—'}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

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
            <div className="space-y-1.5">
              <Label>{t('udhari.enter_by')}</Label>
              <Select value={bhavBy} onValueChange={(v) => setBhavBy(v as 'AMOUNT' | 'WEIGHT')}>
                <SelectTrigger className="w-full" aria-label="Bhav entry by"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="AMOUNT">{t('udhari.amount')} (₹)</SelectItem><SelectItem value="WEIGHT">{t('udhari.weight_g')}</SelectItem></SelectContent>
              </Select>
            </div>
            {bhavBy === 'AMOUNT'
              ? <NumField id="u-bhavamt" label={t('udhari.amount')} value={bhav.amount} onChange={(v) => setB('amount', v)} />
              : <NumField id="u-bhavwt" label={t('udhari.weight_g')} value={bhav.weight} onChange={(v) => setB('weight', v)} step="0.001" />}
            <NumField id="u-bhavrate" label={t('udhari.rate')} value={bhav.rate} onChange={(v) => setB('rate', v)} />
            {bhavAmount > 0 && n(bhav.rate) > 0 && (
              <span className="pb-2 text-sm font-semibold text-brand-strong">
                ≈ {bhavBy === 'WEIGHT' && `₹${bhavAmount.toFixed(2)} · `}{moneyToMetal(bhavAmount, n(bhav.rate), n(bhav.unitGrams))} g {bhav.metal}
              </span>
            )}
            <p className="text-xs text-muted-foreground sm:col-span-3">{t('udhari.before_cut')} <span className="font-medium tabular-nums text-foreground">{beforeCut}</span></p>
          </div>
        )}
      </fieldset>
      </Card>

      <Card className="space-y-4 p-6">
      {((pending && pending.items.length > 0) || editBill) && (
        <div className="space-y-1.5">
          <Label>{t('udhari.settle')}</Label>
          <div className="flex flex-wrap gap-2">
            <div className="relative w-full sm:w-56">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input className="pl-9" placeholder={t('udhari.search_settle')} aria-label="Search settle bill" value={billQ} onChange={(e) => setBillQ(e.target.value)} />
            </div>
            <Select value={settleBillId || 'none'} onValueChange={(v) => setSettleBillId(v === 'none' ? '' : v)}>
              <SelectTrigger className="w-full sm:max-w-md sm:flex-1" aria-label="Settle bill"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t('udhari.none')}</SelectItem>
                {editBill && <SelectItem value={String(editBill.id)}>{editBill.billNo}</SelectItem>}
                {settleBills.map((b) => (
                  <SelectItem key={b.id} value={String(b.id)}>{b.kind === 'PURCHASE' ? 'Purchase · ' : ''}{t('udhari.settle_option', { billNo: b.billNo, balance: b.balance })}{b.itemsSummary ? ` · ${b.itemsSummary}` : ''}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {settleBill?.kind === 'PURCHASE' && !settleOk && <p className="text-xs text-destructive">Enter the amount paid (cash / online given), up to ₹{settleBill.balance}, to settle this purchase bill.</p>}
          {settleBill?.kind === 'SELL' && !settleOk && <p className="text-xs text-destructive">Enter the amount received to settle this bill.</p>}
          {kw && settleBills.length === 0 && <p className="text-xs text-muted-foreground">{t('udhari.no_bill_match', { q: billQ })}</p>}
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
        <Button size="lg" className="ml-auto" disabled={!valid || create.isPending || update.isPending} onClick={submit}>
          {create.isPending || update.isPending ? t('party.saving') : t('udhari.save')}
        </Button>
      </div>

      {isEdit && (
        <MpinDialog
          open={confirmEdit}
          title={t('udhari.update_title', { no: editing.txnNo })}
          onConfirm={async (mpin) => { await update.mutateAsync({ id: editing.id, mpin, body: body() }); navigate(`/app/udhari/txn/${editing.id}`) }}
          onClose={() => setConfirmEdit(false)}
        />
      )}
    </div>
  )
}
