import { ChevronDown, Eraser, Settings2 } from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useState } from 'react'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/ConfirmDialog'
import { MpinDialog } from '@/components/MpinDialog'
import { PartyPicker } from '@/components/PartyPicker'
import { SamplePicker } from '@/components/SamplePicker'
import { SelectBranchForTxn } from '@/components/SelectBranchForTxn'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useBankAccounts, useCurrentRates, useSettings } from '@/lib/appQueries'
import { useAuth } from '@/lib/auth'
import { metalRateUnitGrams } from '@/lib/billingQueries'
import { useT } from '@/lib/i18n'
import { SAMPLES_PERM } from '@/lib/samplesQueries'
import { useCreateExchange, useExchange, useUpdateExchange } from '@/lib/tradeQueries'
import { businessDayISO, METALS, TRADE_SIDES, computeLine, type PartyRefDto, type SamplePickDto } from '@/shared'

import { blankPay, payBody, payRowsFrom, payTotal, payValid, type PayRow } from './splitPay'
import { PartyBalanceChip, SplitPaymentTable, SplitToggle } from './TradeExtras'
import { DEFAULT_EXCHANGE, previewExchange } from './exchangeCalc'
import { InlineUdharCard } from './InlineUdhar'
import { blankInlineUdhar, fromInlineUdhar, toInlineUdhar } from './inlineUdharForm'
import { ExchangeDefaultsDialog } from './ExchangeDefaults'
import { fineRate } from './tradeRates'

let uid = 0
const k = () => `e${uid++}`
const today = businessDayISO
const inr = (s: string | number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(s))
const n = (s: string) => Number(s) || 0

interface Row { key: string; weight: string; touch: string; serialNo: string }
const blankRow = (): Row => ({ key: k(), weight: '', touch: '', serialNo: '' })
const fineOf = (r: Row) => Number(computeLine({ gross: n(r.weight), tunch: n(r.touch) }).fine)
const INITIAL_F = { diffPctPlus: '', diffGmPlus: '', diffPctMinus: '', diffGmMinus: '', givenGross: '', givenLess: '', givenTouch: '', rate: '0', charges: '0', discount: '0', cash: '0', online: '0', bankAccountId: '', remark: '' }
const BLANK_WB = { gross: '', less: '', sample: '' }

export function NewExchange() {
  const t = useT()
  const navigate = useNavigate()
  const { activeBranch, can } = useAuth()
  const branchReady = activeBranch !== '' && activeBranch !== 'all'
  const { data: settings } = useSettings()
  const { data: banks } = useBankAccounts()
  const { data: rates } = useCurrentRates()
  const create = useCreateExchange()
  const update = useUpdateExchange()

  const [side, setSide] = useState('BUY')
  const [party, setParty] = useState<PartyRefDto | null>(null)
  const [metal, setMetal] = useState('GOLD')
  const [txnDate, setTxnDate] = useState(today())
  const [rows, setRows] = useState<Row[]>([blankRow()])
  const [f, setF] = useState(INITIAL_F)
  const set = (key: keyof typeof f, v: string) => setF((s) => ({ ...s, [key]: v }))
  const [split, setSplit] = useState(false)
  const [pays, setPays] = useState<PayRow[]>(() => [blankPay()])
  const [askMpin, setAskMpin] = useState(false)
  // New exchange: the rate field follows today's fine rate until the user types in it (then it is theirs).
  const [askClear, setAskClear] = useState(false)
  // Weighing block (TASK-98): display/derivation only. Nothing here goes into the exchange body or calc.
  const [weighOpen, setWeighOpen] = useState(false)
  const [wb, setWb] = useState(BLANK_WB)
  const [tounchSample, setTounchSample] = useState<SamplePickDto | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [iu, setIu] = useState(() => blankInlineUdhar('GOLD')) // TRD-02 inline udhar
  const meltWt = n(wb.gross) - n(wb.less)
  const netAfterSample = meltWt - n(wb.sample)
  /** Explicit only: copy the picked sample's tounch into the Touch of lines without one (or the last line if all have one). */
  const applySampleTounch = () => {
    if (!tounchSample) return
    const touch = String(Number(tounchSample.tounchPercent))
    setRows((rs) => (rs.some((r) => r.touch === '') ? rs.map((r) => (r.touch === '' ? { ...r, touch } : r)) : rs.map((r, j) => (j === rs.length - 1 ? { ...r, touch } : r))))
  }

  // ?edit=<id> opens this form prefilled with a saved exchange; saving replaces it (same number) after MPIN.
  const [params] = useSearchParams()
  const editParam = Number(params.get('edit'))
  const editId = Number.isInteger(editParam) && editParam > 0 && editParam <= 2_147_483_647 ? editParam : 0
  const { data: editing } = useExchange(editId)
  const [prefilled, setPrefilled] = useState<number | null>(null)
  if (editing && prefilled !== editing.id) {
    setPrefilled(editing.id)
    setSide(editing.side)
    setParty(editing.party)
    setMetal(editing.metal)
    setTxnDate(editing.txnDate)
    setRows(editing.lines.map((l) => ({ key: k(), weight: l.weight, touch: l.touch, serialNo: l.serialNo ?? '' })))
    // G5: difference parts (a pre-G5 exchange has only the signed diffFine: grams on its side), given metal, weighing (line 1)
    const d = editing.diff
    const legacy = !d || (d.plusBy == null && d.minusBy == null)
    const old = Number(editing.diffFine)
    const wl = editing.lines[0]
    if (wl?.grossWeight != null || wl?.sampleWeight != null) { setWeighOpen(true); setWb({ gross: wl.grossWeight ?? '', less: wl.lessWeight ?? '', sample: wl.sampleWeight ?? '' }) }
    setF({
      diffPctPlus: legacy ? '' : d.pctPlus, diffGmPlus: legacy ? (old > 0 ? String(old) : '') : d.gmPlus,
      diffPctMinus: legacy ? '' : d.pctMinus, diffGmMinus: legacy ? (old < 0 ? String(-old) : '') : d.gmMinus,
      givenGross: editing.given?.gross ?? '', givenLess: editing.given ? String(Number(editing.given.gross) - Number(editing.given.net)) : '', givenTouch: editing.given?.touch ?? '',
      rate: editing.rate, charges: editing.charges, discount: editing.discount, cash: editing.cash, online: editing.online, bankAccountId: editing.bankAccount ? String(editing.bankAccount.id) : '', remark: editing.remark ?? '' })
    if (editing.payments?.length) { setSplit(true); setPays(payRowsFrom(editing.payments)) }
    setIu(fromInlineUdhar(editing.udhar, editing.metal))
  }

  const setRow = (i: number, key: keyof Row, v: string) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [key]: v } : r)))
  const defaults = settings?.['exchange.defaults'] ?? DEFAULT_EXCHANGE
  const pv = previewExchange({
    side, lines: rows, diff: { pctPlus: f.diffPctPlus, gmPlus: f.diffGmPlus, pctMinus: f.diffPctMinus, gmMinus: f.diffGmMinus },
    given: { gross: f.givenGross, less: f.givenLess, touch: f.givenTouch }, rate: f.rate, charges: f.charges, discount: f.discount, unitGrams: metalRateUnitGrams(metal, settings), defaults,
  })
  const { totalFine, afterFine, moneyMode, finalAmount } = pv
  const todayRate = fineRate(rates, metal, side, settings) // hint + one-click fill only; posting uses whatever is in the field
  const splitOn = split && moneyMode
  const paid = splitOn ? payTotal(pays) : n(f.cash) + n(f.online)
  const balance = finalAmount - paid

  const setAllTouch100 = () => setRows((rs) => rs.map((r) => ({ ...r, touch: '100' })))
  const dirty = !!party || side !== 'BUY' || metal !== 'GOLD' || txnDate !== today() || rows.length > 1 || rows.some((r) => r.weight !== '' || r.touch !== '' || r.serialNo !== '')
    || (Object.keys(INITIAL_F) as Array<keyof typeof INITIAL_F>).some((key) => f[key] !== INITIAL_F[key])
    || split || wb.gross !== '' || wb.less !== '' || wb.sample !== '' || !!tounchSample
  /** Back to a blank new exchange (same as opening the page fresh). */
  const clearForm = () => {
    setSide('BUY'); setParty(null); setMetal('GOLD'); setTxnDate(today()); setRows([blankRow()])
    setF(INITIAL_F); setSplit(false); setPays([blankPay()])
    setWeighOpen(false); setWb(BLANK_WB); setTounchSample(null); setIu(blankInlineUdhar('GOLD'))
  }

  const valid = branchReady && !!party && rows.every((r) => n(r.weight) > 0 && n(r.touch) > 0) && afterFine > 0 && pv.settleFine >= 0
    && (!pv.givenOn || (n(f.givenTouch) > 0 && n(f.givenLess) < n(f.givenGross)))
    && (moneyMode || (paid === 0 && n(f.charges) === 0 && n(f.discount) === 0))
    && (splitOn ? payValid(pays) : n(f.online) === 0 || f.bankAccountId)
    && !(editing && editing.processed)

  const body = () => ({
    side, partyId: party!.id, metal, txnDate,
    // shortcut: one weighing block per exchange, saved on line 1 (the server stores weighing per line); upgrade if lines get their own block
    lines: rows.map((r, i) => ({
      weight: n(r.weight), touch: n(r.touch), serialNo: r.serialNo || undefined,
      ...(i === 0 && weighOpen && (wb.gross !== '' || wb.sample !== '') ? { grossWeight: n(wb.gross), lessWeight: n(wb.less), meltWeight: Math.max(meltWt, 0), sampleWeight: n(wb.sample), sampleId: tounchSample?.id } : {}),
    })),
    diffPctPlus: n(f.diffPctPlus), diffGmPlus: n(f.diffGmPlus), diffPctMinus: n(f.diffPctMinus), diffGmMinus: n(f.diffGmMinus),
    given: pv.givenOn ? { gross: n(f.givenGross), less: n(f.givenLess), touch: n(f.givenTouch) } : undefined,
    udhar: toInlineUdhar(iu, metalRateUnitGrams(iu.metal, settings)),
    rate: n(f.rate), charges: n(f.charges), discount: n(f.discount),
    ...(splitOn ? payBody(pays) : { cash: n(f.cash), online: n(f.online), bankAccountId: n(f.online) > 0 ? Number(f.bankAccountId) : undefined }),
    remark: f.remark || undefined,
  })
  const submit = async () => {
    if (editing) { setAskMpin(true); return }
    const saved = await create.mutateAsync(body())
    navigate(`/app/exchange`)
    toast(t('trade.ex.toast_saved', { no: saved.exchangeNo }), { action: { label: t('trade.ex.print_receipt'), onClick: () => navigate(`/app/exchange/${saved.id}/print`) } })
  }
  const saveEdit = async (mpin: string) => {
    await update.mutateAsync({ id: editing!.id, mpin, body: body() })
    navigate('/app/exchange')
  }
  const pending = create.isPending || update.isPending

  return (
    <div className="space-y-8">
      {!branchReady && <SelectBranchForTxn note={t('trade.ex.branch_note')} />}
      {editing && (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6 text-sm">
            <span>{t('trade.ex.editing', { no: editing.exchangeNo })}{editing.processed && t('trade.ex.editing_processed')}</span>
            <Button asChild variant="outline" size="sm"><Link to="/app/exchange">{t('trade.cancel_edit')}</Link></Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>{t('trade.ex.details')}</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1.5">
            <Label>{t('trade.side')}</Label>
            <Select value={side} onValueChange={setSide}>
              <SelectTrigger aria-label="Side"><SelectValue /></SelectTrigger>
              <SelectContent>{TRADE_SIDES.map((s) => <SelectItem key={s} value={s}>{s === 'BUY' ? t('trade.ex.side_buy') : t('trade.ex.side_sell')}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 lg:col-span-2"><Label htmlFor="ex-party">{t('udhari.party')}</Label><PartyPicker value={party} onChange={setParty} placeholder={t('bill.search_party')} id="ex-party" ariaLabel="Party" /><PartyBalanceChip partyId={party?.id} /></div>
          <div className="space-y-1.5">
            <Label>{t('udhari.metal')}</Label>
            <Select value={metal} onValueChange={setMetal}>
              <SelectTrigger aria-label="Metal"><SelectValue /></SelectTrigger>
              <SelectContent>{METALS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label htmlFor="ex-date">{t('udhari.date')}</Label><Input id="ex-date" type="date" value={txnDate} onChange={(e) => setTxnDate(e.target.value)} /></div>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-xl">{t('trade.ex.metal_lines')}</h2>
        <Card className="overflow-x-auto p-2">
          <Table>
            <TableHeader><TableRow><TableHead>{t('udhari.weight_g')}</TableHead><TableHead>{t('trade.touch_pct')}</TableHead><TableHead>{t('stock.col_fine')}</TableHead><TableHead>{t('trade.serial')}</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {rows.map((r, i) => (
                <TableRow key={r.key}>
                  <TableCell><Input className="w-24" type="number" step="0.001" aria-label="Weight" value={r.weight} onChange={(e) => setRow(i, 'weight', e.target.value)} /></TableCell>
                  <TableCell><Input className="w-20" type="number" step="0.01" aria-label="Touch" value={r.touch} onChange={(e) => setRow(i, 'touch', e.target.value)} /></TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">{fineOf(r).toFixed(3)}</TableCell>
                  <TableCell><Input className="w-28" aria-label="Serial" value={r.serialNo} onChange={(e) => setRow(i, 'serialNo', e.target.value)} /></TableCell>
                  <TableCell><Button variant="ghost" size="sm" aria-label="Remove line" disabled={rows.length === 1} onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}>✕</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setRows((rs) => [...rs, blankRow()])}>{t('jbill.add_line')}</Button>
          <Button variant="outline" size="sm" title={t('trade.ex.touch_100_hint')} onClick={setAllTouch100}>{t('trade.ex.touch_100')}</Button>
        </div>
      </section>

      <Card>
        <CardHeader className="pb-0">
          <button type="button" className="flex w-full items-center justify-between text-left" aria-expanded={weighOpen} aria-controls="ex-weighing" onClick={() => setWeighOpen((o) => !o)}>
            <CardTitle>{t('trade.ex.weighing')}</CardTitle>
            <ChevronDown className={`size-4 transition-transform ${weighOpen ? 'rotate-180' : ''}`} aria-hidden />
          </button>
        </CardHeader>
        {weighOpen && (
          <CardContent id="ex-weighing" className="space-y-4 pt-4">
            <p className="text-xs text-muted-foreground">{t('trade.ex.weigh_note')}</p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <div className="space-y-1.5"><Label htmlFor="wb-gross">{t('trade.ex.gross_wt')}</Label><Input id="wb-gross" type="number" step="0.001" min="0" value={wb.gross} onChange={(e) => setWb((s) => ({ ...s, gross: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label htmlFor="wb-less">{t('trade.ex.less_wt')}</Label><Input id="wb-less" type="number" step="0.001" min="0" value={wb.less} onChange={(e) => setWb((s) => ({ ...s, less: e.target.value }))} /></div>
              <div className="space-y-1.5"><div className="text-sm font-medium">{t('trade.ex.melt_wt')}</div><div className="flex h-9 items-center tabular-nums" aria-live="polite">{meltWt.toFixed(3)}</div></div>
              <div className="space-y-1.5"><Label htmlFor="wb-sample">{t('trade.ex.sample_wt')}</Label><Input id="wb-sample" type="number" step="0.001" min="0" value={wb.sample} onChange={(e) => setWb((s) => ({ ...s, sample: e.target.value }))} /></div>
              <div className="space-y-1.5"><div className="text-sm font-medium">{t('trade.ex.net_after_sample')}</div><div className="flex h-9 items-center font-semibold tabular-nums" aria-live="polite">{netAfterSample.toFixed(3)}</div></div>
            </div>
            {can(SAMPLES_PERM, 'view') && <div className="space-y-1.5">
              <Label htmlFor="wb-tounch-sample">{t('trade.ex.tounch_sample')}</Label>
              <SamplePicker id="wb-tounch-sample" ariaLabel="Search tounch samples" metal={metal} value={tounchSample} onChange={setTounchSample} />
              {tounchSample && (
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="tabular-nums">{t('trade.ex.sample_tounch', { no: tounchSample.sampleNo })} <span className="font-semibold">{Number(tounchSample.tounchPercent).toFixed(2)}%</span></span>
                  <Button type="button" variant="outline" size="sm" onClick={applySampleTounch}>{t('trade.ex.use_tounch')}</Button>
                </div>
              )}
            </div>}
          </CardContent>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>{t('trade.ex.settlement')}</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <fieldset className="space-y-1.5 sm:col-span-2 lg:col-span-3">
              <legend className="text-sm font-medium">{t('trade.ex.diff_title', { base: t(defaults.diffBy === 'WEIGHT' ? 'trade.ex.base_weight' : 'trade.ex.base_fine') })}</legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Input type="number" step="0.01" min="0" aria-label="Difference plus percent" placeholder="+ %" value={f.diffPctPlus} onChange={(e) => set('diffPctPlus', e.target.value)} />
                <Input type="number" step="0.001" min="0" aria-label="Difference plus grams" placeholder="+ g" value={f.diffGmPlus} onChange={(e) => set('diffGmPlus', e.target.value)} />
                <Input type="number" step="0.01" min="0" aria-label="Difference minus percent" placeholder="− %" value={f.diffPctMinus} onChange={(e) => set('diffPctMinus', e.target.value)} />
                <Input type="number" step="0.001" min="0" aria-label="Difference minus grams" placeholder="− g" value={f.diffGmMinus} onChange={(e) => set('diffGmMinus', e.target.value)} />
              </div>
            </fieldset>
            <fieldset className="space-y-1.5 sm:col-span-2 lg:col-span-3">
              <legend className="text-sm font-medium">{t('trade.ex.given_title')}</legend>
              <div className="grid grid-cols-3 gap-2">
                <Input type="number" step="0.001" min="0" aria-label="Given metal gross" placeholder={t('trade.ex.gross_wt')} value={f.givenGross} onChange={(e) => set('givenGross', e.target.value)} />
                <Input type="number" step="0.001" min="0" aria-label="Given metal less" placeholder={t('trade.ex.less_wt')} value={f.givenLess} onChange={(e) => set('givenLess', e.target.value)} />
                <Input type="number" step="0.01" min="0" max="100" aria-label="Given metal touch" placeholder={t('trade.touch_pct')} value={f.givenTouch} onChange={(e) => set('givenTouch', e.target.value)} />
              </div>
              {pv.givenOn && <p className="text-xs text-muted-foreground tabular-nums">{t('trade.ex.given_note', { fine: pv.givenFine.toFixed(3) })}</p>}
            </fieldset>
            <div className="space-y-1.5"><Label htmlFor="ex-rate">{t('trade.rate_unit', { unit: metal === 'GOLD' ? '/10g' : '/kg' })}</Label><Input id="ex-rate" type="number" value={f.rate} onChange={(e) => set('rate', e.target.value)} />
              {/* Not auto-filled: a rate switches the exchange to money settlement, so the user opts in. */}
              {todayRate && <button type="button" className="text-left text-xs text-muted-foreground tabular-nums underline-offset-2 hover:text-foreground hover:underline" onClick={() => set('rate', todayRate)}>{t('trade.ex.today_rate', { side: side === 'BUY' ? t('trade.side_buy_lc') : t('trade.side_sell_lc'), rate: todayRate })}</button>}
            </div>
            {moneyMode && <>
              <div className="space-y-1.5"><Label htmlFor="ex-charges">{t('trade.charges_inr')}</Label><Input id="ex-charges" type="number" value={f.charges} onChange={(e) => set('charges', e.target.value)} /></div>
              <div className="space-y-1.5"><Label htmlFor="ex-disc">{t('girvi.discount_inr')}</Label><Input id="ex-disc" type="number" value={f.discount} onChange={(e) => set('discount', e.target.value)} /></div>
              <div className="sm:col-span-2 lg:col-span-3"><SplitToggle id="ex-split" checked={split} onChange={setSplit} /></div>
              {split ? (
                <div className="sm:col-span-2 lg:col-span-3"><SplitPaymentTable rows={pays} onChange={setPays} /></div>
              ) : <>
                <div className="space-y-1.5"><Label htmlFor="ex-cash">{side === 'BUY' ? t('trade.cash_paid') : t('trade.cash_recd')}</Label><Input id="ex-cash" type="number" value={f.cash} onChange={(e) => set('cash', e.target.value)} /></div>
                <div className="space-y-1.5"><Label htmlFor="ex-online">{t('udhari.online')}</Label><Input id="ex-online" type="number" value={f.online} onChange={(e) => set('online', e.target.value)} /></div>
                {n(f.online) > 0 && (
                  <div className="space-y-1.5 sm:col-span-2"><Label>{t('bill.bank')}</Label>
                    <Select value={f.bankAccountId} onValueChange={(v) => set('bankAccountId', v)}><SelectTrigger aria-label="Bank account"><SelectValue placeholder={t('bill.bank')} /></SelectTrigger>
                      <SelectContent>{banks?.map((b) => <SelectItem key={b.id} value={String(b.id)}>{b.bankName} · {b.accountNo}</SelectItem>)}</SelectContent></Select>
                  </div>
                )}
              </>}
            </>}
            <div className="space-y-1.5 sm:col-span-2 lg:col-span-3"><Label htmlFor="ex-remark">{t('udhari.remark')}</Label><Input id="ex-remark" value={f.remark} onChange={(e) => set('remark', e.target.value)} /></div>
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader><CardTitle>{t('dash.col_summary')}</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm tabular-nums">
            <div className="flex justify-between"><span className="text-muted-foreground">{t('trade.ex.total_fine')}</span><span>{totalFine.toFixed(3)} g</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">{t('trade.ex.diff_short')}</span><span>{pv.diffFine.toFixed(3)} g</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">{t('trade.ex.after_adjust')}</span><span className="font-medium">{afterFine.toFixed(3)} g</span></div>
            {pv.givenOn && <div className="flex justify-between"><span className="text-muted-foreground">{t('trade.ex.given_fine')}</span><span>{pv.givenFine.toFixed(3)} g</span></div>}
            {moneyMode ? (
              <>
                {pv.roundOff !== 0 && <>
                  <div className="flex justify-between"><span className="text-muted-foreground">{t('trade.ex.exact_amount')}</span><span>{inr(pv.exact)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">{t('trade.ex.round_off')}</span><span>{inr(pv.roundOff)}</span></div>
                </>}
                <div className="flex justify-between border-t pt-2 text-base font-semibold"><span>{t('trade.final_amount')}</span><span>{inr(finalAmount)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{t('bill.paid')}</span><span>{inr(paid)}</span></div>
                <div className="flex justify-between font-medium"><span>{t('trade.balance_who', { who: side === 'BUY' ? t('trade.shop_owes') : t('trade.party_owes') })}</span><span>{inr(Math.abs(balance))}</span></div>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">{t('trade.ex.metal_settle', { who: side === 'BUY' ? t('trade.shop_owes') : t('trade.party_owes'), wt: pv.settleFine.toFixed(3), metal })}</p>
            )}
          </CardContent>
        </Card>
      </div>

      <InlineUdharCard value={iu} onChange={setIu} unitGrams={metalRateUnitGrams(iu.metal, settings)} txnNo={editing?.udhar?.txnNo} />

      <div className="flex flex-wrap justify-end gap-2">
        {can('settings.misc', 'edit') && <Button variant="ghost" className="w-full sm:mr-auto sm:w-auto" onClick={() => setSettingsOpen(true)}><Settings2 className="size-4" aria-hidden />{t('trade.ex.settings')}</Button>}
        {!editing && <Button variant="outline" className="w-full sm:w-auto" disabled={pending} onClick={() => (dirty ? setAskClear(true) : clearForm())}><Eraser className="size-4" aria-hidden />{t('trade.ex.clear')}</Button>}
        <Button className="w-full sm:w-auto" disabled={!valid || pending} onClick={() => void submit().catch(() => {})}>
          {pending ? t('bill.saving') : editing ? t('party.save_changes') : t('trade.save_kind', { kind: side === 'BUY' ? t('trade.kind_purchase') : t('trade.kind_sale') })}
        </Button>
      </div>
      <ConfirmDialog open={askClear} title={t('trade.ex.clear_title')} description={t('trade.ex.clear_desc')} confirmLabel={t('trade.ex.clear')} destructive onConfirm={clearForm} onClose={() => setAskClear(false)} />
      {settingsOpen && <ExchangeDefaultsDialog onClose={() => setSettingsOpen(false)} />}
      <MpinDialog open={askMpin} title={t('trade.ex.save_changes_title', { no: editing?.exchangeNo ?? '' })} onConfirm={saveEdit} onClose={() => setAskMpin(false)} />
    </div>
  )
}
