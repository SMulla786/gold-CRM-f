import { ImagePlus, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

import { MpinDialog } from '@/components/MpinDialog'
import { PartyPicker } from '@/components/PartyPicker'
import { TABLE_EDGES } from '@/components/SectionCard'
import { SelectBranchForTxn } from '@/components/SelectBranchForTxn'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { api } from '@/lib/api'
import { useBankAccounts, useParty, useSaveSetting, useSettings } from '@/lib/appQueries'
import { useAuth } from '@/lib/auth'
import { useCreateGirvi, useGirviKarats } from '@/lib/girviQueries'
import { useT } from '@/lib/i18n'
import { qs } from '@/lib/queries'
import { businessDayISO, type GirviListItemDto, type Paged, type PartyRefDto } from '@/shared'

const NEW_CAT = '__new__'

let uid = 0
const k = () => `g${uid++}`
const today = businessDayISO
const inr = (s: string | number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(s))
const n = (s: string) => Number(s) || 0

// itemRate = optional per-item interest % (blank = loan rate); karat = optional karat id that filled purity (UI only);
// customCat = typing a free-text category (the contract's category is a free string)
// photo = optional item photo picked on the form; uploaded right after create to the matching created item (same order)
interface Row { key: string; category: string; name: string; gross: string; net: string; purity: string; rate: string; itemRate: string; karat: string; customCat: boolean; photo?: File }
const blankRow = (category: string): Row => ({ key: k(), category, name: '', gross: '', net: '', purity: '', rate: '', itemRate: '', karat: '', customCat: false })
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const PHOTO_MAX = 2 * 1024 * 1024 // same 2 MB cap as the item photo upload
const fineOf = (r: Row) => (n(r.net) * n(r.purity)) / 100
const valOf = (r: Row) => fineOf(r) * n(r.rate)
/** Mirrors backend girvi/service.ts createGirvi: returnDate = addMonths(businessDate(issueDate), tenureMonths) via setUTCMonth on the
 *  IST day at 00:00Z — no month-end clamp (e.g. 31 Jan + 1 → 3 Mar in a 28-day February), exactly what the server stores. */
const returnDateOf = (issueISO: string, months: number): Date | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(issueISO) || !Number.isInteger(months) || months < 1 || months > 120) return null
  const d = new Date(`${issueISO}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return null
  d.setUTCMonth(d.getUTCMonth() + months)
  return d
}

export function NewGirvi() {
  const t = useT()
  const navigate = useNavigate()
  const { activeBranch, can } = useAuth()
  const branchReady = activeBranch !== '' && activeBranch !== 'all'
  const { data: settings } = useSettings()
  // karat → purity helper needs /app/karats (settings.misc view)
  const canKarat = can('settings.misc', 'view')
  const { data: karats } = useGirviKarats(canKarat)
  const saveSetting = useSaveSetting()
  const [savingCat, setSavingCat] = useState<number | null>(null) // row index whose typed category is being saved to girvi.defaults
  const [lookupNo, setLookupNo] = useState('')
  const [lookupBusy, setLookupBusy] = useState(false)
  const [tenureUnit, setTenureUnit] = useState<'MONTHS' | 'DAYS'>('MONTHS')
  const [tenureDaysIn, setTenureDaysIn] = useState('')
  const [roundUp, setRoundUp] = useState(false)
  const [firstMode, setFirstMode] = useState<'AMOUNT' | 'PERCENT'>('AMOUNT')
  const { data: banks } = useBankAccounts()
  const create = useCreateGirvi()
  const def = settings?.['girvi.defaults']
  const categories = (def?.categories ?? ['Gold', 'Silver']).filter((c) => !def?.inactiveCategories?.includes(c))

  const [party, setParty] = useState<PartyRefDto | null>(null)
  // ?partyId=… (from a customer's girvi list) pre-selects the customer once
  const prefillId = Number(useSearchParams()[0].get('partyId')) || undefined
  const { data: prefill } = useParty(prefillId)
  useEffect(() => {
    if (prefill && !party) setParty({ id: prefill.id, type: prefill.type, name: prefill.name, mobile: prefill.mobile, shopName: prefill.shopName ?? null })
  }, [prefill]) // eslint-disable-line react-hooks/exhaustive-deps
  const [issueDate, setIssueDate] = useState(today())
  const [rows, setRows] = useState<Row[]>([blankRow('Gold')])
  const [terms, setTerms] = useState({ ratePercent: '', ratePeriod: '', interestType: '', ciPeriod: '', method: '', tenureMonths: '', firstMonthInterest: '', penaltyRatePercent: '' })
  const [principal, setPrincipal] = useState('')
  const [principalTouched, setPrincipalTouched] = useState(false)
  const [pay, setPay] = useState({ cash: '', online: '', bankAccountId: '' })
  const [remark, setRemark] = useState('')
  const [seeded, setSeeded] = useState(false)

  // seed terms + std-% principal from girvi.defaults once settings arrive
  if (def && !seeded) {
    setSeeded(true)
    setTerms({ ratePercent: String(def.ratePercent), ratePeriod: def.ratePeriod, interestType: def.interestType, ciPeriod: def.ciPeriod, method: def.method, tenureMonths: String(def.tenureMonths), firstMonthInterest: '', penaltyRatePercent: String(def.penaltyRatePercent ?? 0) })
  }

  const setRow = (i: number, key: keyof Row, v: string) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [key]: v } : r)))
  const setTerm = (key: keyof typeof terms, v: string) => setTerms((s) => ({ ...s, [key]: v }))
  const valuation = rows.reduce((a, r) => a + valOf(r), 0)
  const stdPrincipal = def ? Math.round((def.stdPercent / 100) * valuation) : 0
  const effPrincipal = principalTouched ? n(principal) : stdPrincipal
  const payTotal = n(pay.cash) + n(pay.online)
  // Tenure in days (optional): "round up" converts to whole months client-side (ceil(days / 30)); otherwise tenureDays is sent and the
  // server sets returnDate = issueDate + days (tenureMonths = ceil(days / 30)).
  const daysIn = Math.min(3600, Math.max(1, Math.floor(n(tenureDaysIn)) || 1))
  const inDays = tenureUnit === 'DAYS'
  const sendMonths = inDays ? Math.ceil(daysIn / 30) : Number(terms.tenureMonths) || 1 // same tenure the submit sends
  const exactDays = inDays && !roundUp
  const issueMs = new Date(`${issueDate}T00:00:00Z`).getTime()
  const returnDate = exactDays ? (Number.isNaN(issueMs) ? null : new Date(issueMs + daysIn * 864e5)) : returnDateOf(issueDate, sendMonths)
  const tenureDays = returnDate ? Math.round((returnDate.getTime() - issueMs) / 864e5) : null
  // First-month interest: entered as ₹ or as % of the principal (converted to ₹ here, before submit)
  const firstAmount = firstMode === 'PERCENT' ? Math.round(effPrincipal * n(terms.firstMonthInterest)) / 100 : n(terms.firstMonthInterest)

  const valid = branchReady && !!party && rows.every((r) => r.category.trim() && r.name.trim() && n(r.gross) > 0 && n(r.net) > 0 && n(r.purity) > 0 && n(r.rate) > 0)
    && effPrincipal > 0 && effPrincipal <= valuation + 0.005 && Math.abs(payTotal - effPrincipal) < 0.005 && (n(pay.online) === 0 || pay.bankAccountId)
    && (!inDays || (n(tenureDaysIn) >= 1 && n(tenureDaysIn) <= 3600))

  // Girvi-ID lookup: find loan #N (numeric q also matches names/mobiles, so pick the exact girviNo) and take its customer
  const lookup = async () => {
    const no = Number(lookupNo)
    if (!Number.isInteger(no) || no < 1) return
    setLookupBusy(true)
    try {
      const res = await api.get<Paged<GirviListItemDto>>(`/app/girvi${qs({ q: String(no), pageSize: 100 })}`)
      const hit = res.items.find((r) => r.girviNo === no)
      if (hit) { setParty(hit.party); toast.success(`Customer from girvi #${no}: ${hit.party.name}`) } else toast.error(`Girvi #${no} not found`)
    } finally {
      setLookupBusy(false)
    }
  }
  const pickKarat = (i: number, id: string) => {
    const kt = karats?.find((x) => String(x.id) === id)
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, karat: id, purity: kt ? String(Number(kt.touch)) : r.purity } : r)))
  }
  const karatsFor = (category: string) => {
    const metal = category.trim().toUpperCase()
    const same = karats?.filter((x) => x.metal === metal) ?? []
    return same.length ? same : (karats ?? [])
  }
  const saveCategory = async (i: number, mpin: string) => {
    const name = rows[i]?.category.trim()
    if (!def || !name) return
    if (!def.categories.some((c) => c.toLowerCase() === name.toLowerCase())) {
      await saveSetting.mutateAsync({ key: 'girvi.defaults', value: { ...def, categories: [...def.categories, name] }, mpin })
    }
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, customCat: false } : r)))
  }

  const submit = async () => {
    const body = {
      partyId: party!.id, issueDate,
      items: rows.map((r) => ({ category: r.category.trim(), name: r.name.trim(), gross: n(r.gross), net: n(r.net), purity: n(r.purity), rate: n(r.rate), ...(r.itemRate.trim() ? { ratePercent: n(r.itemRate) } : {}) })),
      principal: effPrincipal, ratePercent: n(terms.ratePercent), ratePeriod: terms.ratePeriod, interestType: terms.interestType,
      ciPeriod: terms.interestType === 'CI' ? terms.ciPeriod : undefined, method: terms.method, tenureMonths: sendMonths, ...(exactDays ? { tenureDays: daysIn } : {}),
      firstMonthInterest: firstAmount, penaltyRatePercent: n(terms.penaltyRatePercent),
      cash: n(pay.cash), online: n(pay.online), bankAccountId: n(pay.online) > 0 ? Number(pay.bankAccountId) : undefined, remark: remark || undefined,
    }
    const saved = await create.mutateAsync(body)
    // the loan exists now: upload each picked photo to its created item (server keeps item order = row order); a failed
    // upload is toasted (re-upload from the loan page) and never blocks navigation or invites a duplicate create
    const uploads = rows.map((r, i) => ({ file: r.photo, itemId: saved.items[i]?.id })).filter((u): u is { file: File; itemId: number } => !!u.file && u.itemId != null)
    const results = await Promise.allSettled(uploads.map((u) => {
      const fd = new FormData()
      fd.append('file', u.file)
      return api.post(`/app/girvi/items/${u.itemId}/photo`, fd)
    }))
    const failed = results.filter((r) => r.status === 'rejected').length
    if (failed) toast.error(`${failed} item photo(s) could not be uploaded. Add them from the loan page.`)
    navigate(`/app/girvi/${saved.id}`)
  }

  return (
    <div className="space-y-6">
      {!branchReady && <SelectBranchForTxn note={t('girvi.branch_note')} />}

      <Card className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5 lg:col-span-2"><Label htmlFor="ng-party">{t('bill.customer')}</Label><PartyPicker value={party} onChange={setParty} placeholder={t('udhari.search_party')} id="ng-party" ariaLabel="Customer" /></div>
        <div className="space-y-1.5"><Label htmlFor="ng-date">{t('girvi.issue_date')}</Label><Input id="ng-date" type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} /></div>
        <div className="space-y-1.5">
          <Label htmlFor="ng-lookup">Girvi no</Label>
          <div className="flex gap-2">
            <Input id="ng-lookup" inputMode="numeric" placeholder="e.g. 12" value={lookupNo} onChange={(e) => setLookupNo(e.target.value.replace(/\D/g, ''))} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void lookup().catch(() => {}) } }} />
            <Button type="button" variant="outline" disabled={!lookupNo || lookupBusy} onClick={() => void lookup().catch(() => {})}>Find</Button>
          </div>
          <p className="text-xs text-muted-foreground">Pick the customer of an existing girvi</p>
        </div>
      </Card>

      {/* Items stay before Loan terms in the DOM (specs use .nth(i) on Rate/Gross/Net). */}
      <Card className="overflow-hidden">
      <div className={`overflow-x-auto ${TABLE_EDGES}`}>
        <Table>
          <TableHeader>
            <TableRow><TableHead>{t('girvi.col_category')}</TableHead><TableHead className="min-w-40">{t('girvi.col_item')}</TableHead><TableHead>{t('stock.col_gross')}</TableHead><TableHead>{t('stock.col_net')}</TableHead>{canKarat && <TableHead>Karat</TableHead>}<TableHead>{t('girvi.col_purity_pct')}</TableHead><TableHead>{t('stock.col_fine')}</TableHead><TableHead>{t('girvi.col_rate_g')}</TableHead><TableHead>{t('girvi.valuation')}</TableHead><TableHead title="Optional: overrides the loan interest % for this item">{t('girvi.item_int_pct')}</TableHead><TableHead>Photo</TableHead><TableHead /></TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={r.key}>
                <TableCell>
                  {r.customCat ? (
                    <div className="flex items-center gap-1">
                      <Input className="w-28" maxLength={40} autoFocus aria-label="New category name" placeholder="New category" value={r.category} onChange={(e) => setRow(i, 'category', e.target.value)} />
                      {can('settings.misc', 'edit') && def && (
                        <Button type="button" variant="ghost" size="sm" disabled={!r.category.trim()} title="Add to the girvi category list (MPIN)" onClick={() => setSavingCat(i)}>Save</Button>
                      )}
                      <Button type="button" variant="ghost" size="sm" aria-label="Cancel new category" onClick={() => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, customCat: false, category: categories[0] ?? 'Gold' } : x)))}>✕</Button>
                    </div>
                  ) : (
                    <Select value={r.category} onValueChange={(v) => setRows((rs) => rs.map((x, j) => (j === i ? (v === NEW_CAT ? { ...x, customCat: true, category: '' } : { ...x, category: v }) : x)))}>
                      <SelectTrigger className="w-28" aria-label="Category"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        {!categories.includes(r.category) && r.category && <SelectItem value={r.category}>{r.category}</SelectItem>}
                        <SelectItem value={NEW_CAT}>+ New category</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </TableCell>
                <TableCell><Input className="w-40" aria-label="Item name" value={r.name} onChange={(e) => setRow(i, 'name', e.target.value)} /></TableCell>
                <TableCell><Input className="w-20" type="number" step="0.001" aria-label="Gross" value={r.gross} onChange={(e) => setRow(i, 'gross', e.target.value)} /></TableCell>
                <TableCell><Input className="w-20" type="number" step="0.001" aria-label="Net" value={r.net} onChange={(e) => setRow(i, 'net', e.target.value)} /></TableCell>
                {canKarat && (
                  <TableCell>
                    <Select value={r.karat} onValueChange={(v) => pickKarat(i, v)}>
                      <SelectTrigger className="w-24" aria-label="Karat"><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>{karatsFor(r.category).map((x) => <SelectItem key={x.id} value={String(x.id)}>{x.code} · {Number(x.touch)}%</SelectItem>)}</SelectContent>
                    </Select>
                  </TableCell>
                )}
                <TableCell><Input className="w-16" type="number" step="0.01" aria-label="Purity" value={r.purity} onChange={(e) => setRow(i, 'purity', e.target.value)} /></TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground tabular-nums">{fineOf(r).toFixed(3)}</TableCell>
                <TableCell><Input className="w-24" type="number" aria-label="Rate" value={r.rate} onChange={(e) => setRow(i, 'rate', e.target.value)} /></TableCell>
                <TableCell className="whitespace-nowrap tabular-nums">{inr(valOf(r))}</TableCell>
                <TableCell><Input className="w-20" type="number" step="0.01" min={0} max={100} aria-label="Item interest %" placeholder={terms.ratePercent || '—'} value={r.itemRate} onChange={(e) => setRow(i, 'itemRate', e.target.value)} /></TableCell>
                <TableCell><RowPhoto row={r} index={i} onPick={(f) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, photo: f } : x)))} /></TableCell>
                <TableCell><Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" aria-label="Remove item" disabled={rows.length === 1} onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}>✕</Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="border-t bg-muted/40 px-6 py-3">
        <Button variant="outline" size="sm" onClick={() => setRows((rs) => [...rs, blankRow(categories[0] ?? 'Gold')])}>{t('girvi.add_item')}</Button>
      </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
        <Card className="self-start overflow-hidden">
          <div className="border-b bg-muted/40 px-6 py-4"><h2 className="text-lg font-bold">{t('girvi.loan_terms')}</h2></div>
          <div className="grid gap-4 p-6 sm:grid-cols-2 xl:grid-cols-3">
            <div className="space-y-1.5"><Label htmlFor="ng-rate">{t('girvi.interest_pct')}</Label><Input id="ng-rate" type="number" step="0.01" value={terms.ratePercent} onChange={(e) => setTerm('ratePercent', e.target.value)} /></div>
            <div className="space-y-1.5"><Label>{t('udhari.per')}</Label>
              <Select value={terms.ratePeriod} onValueChange={(v) => setTerm('ratePeriod', v)}><SelectTrigger aria-label="Rate period"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="MONTHLY">{t('gst.month')}</SelectItem><SelectItem value="ANNUAL">{t('girvi.year')}</SelectItem></SelectContent></Select>
            </div>
            <div className="space-y-1.5"><Label>{t('girvi.interest_type')}</Label>
              <Select value={terms.interestType} onValueChange={(v) => setTerm('interestType', v)}><SelectTrigger aria-label="Interest type"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="SI">{t('girvi.simple')}</SelectItem><SelectItem value="CI">{t('girvi.compound')}</SelectItem></SelectContent></Select>
            </div>
            {terms.interestType === 'CI' && (
              <div className="space-y-1.5"><Label>{t('girvi.compounding')}</Label>
                <Select value={terms.ciPeriod} onValueChange={(v) => setTerm('ciPeriod', v)}><SelectTrigger aria-label="Compounding period"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="DAILY">{t('girvi.daily')}</SelectItem><SelectItem value="MONTHLY">{t('girvi.monthly')}</SelectItem><SelectItem value="HALF_YEARLY">{t('girvi.half_yearly')}</SelectItem><SelectItem value="YEARLY">{t('girvi.yearly')}</SelectItem></SelectContent></Select>
              </div>
            )}
            <div className="space-y-1.5"><Label>{t('girvi.day_count')}</Label>
              <Select value={terms.method} onValueChange={(v) => setTerm('method', v)}><SelectTrigger aria-label="Day count method"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="FULL_MONTH">{t('girvi.full_month')}</SelectItem><SelectItem value="DAY_WISE">{t('girvi.day_wise')}</SelectItem></SelectContent></Select>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                {inDays ? <Label htmlFor="ng-tenure-days">Tenure (days)</Label> : <Label htmlFor="ng-tenure">{t('girvi.tenure_months')}</Label>}
                <Select value={tenureUnit} onValueChange={(v) => setTenureUnit(v as 'MONTHS' | 'DAYS')}>
                  <SelectTrigger size="sm" className="h-7 w-24" aria-label="Tenure unit"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="MONTHS">Months</SelectItem><SelectItem value="DAYS">Days</SelectItem></SelectContent>
                </Select>
              </div>
              {inDays ? (
                <>
                  <Input id="ng-tenure-days" type="number" min={1} max={3600} value={tenureDaysIn} onChange={(e) => setTenureDaysIn(e.target.value)} />
                  <label className="flex items-center gap-2 text-xs"><Checkbox checked={roundUp} onCheckedChange={(c) => setRoundUp(c === true)} />Round up to whole months</label>
                  <p className="text-xs text-muted-foreground tabular-nums" aria-live="polite">{roundUp ? `Saved as ${sendMonths} month(s)` : `Return date = issue date + ${daysIn} days`}</p>
                </>
              ) : (
                <>
                  <Input id="ng-tenure" type="number" value={terms.tenureMonths} onChange={(e) => setTerm('tenureMonths', e.target.value)} />
                  <p className="text-xs text-muted-foreground tabular-nums" aria-live="polite">{tenureDays != null ? t('girvi.tenure_days', { n: tenureDays }) : t('girvi.tenure_hint')}</p>
                </>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ng-return">{t('girvi.return_date')}</Label>
              <Input id="ng-return" readOnly tabIndex={-1} className="bg-muted/40" value={returnDate ? returnDate.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }) : '—'} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="ng-first">{t('girvi.first_month_interest')}</Label>
                <Select value={firstMode} onValueChange={(v) => setFirstMode(v as 'AMOUNT' | 'PERCENT')}>
                  <SelectTrigger size="sm" className="h-7 w-20" aria-label="First month mode"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="AMOUNT">₹</SelectItem><SelectItem value="PERCENT">%</SelectItem></SelectContent>
                </Select>
              </div>
              <Input id="ng-first" type="number" step="0.01" min={0} max={firstMode === 'PERCENT' ? 100 : undefined} placeholder="0" value={terms.firstMonthInterest} onChange={(e) => setTerm('firstMonthInterest', e.target.value)} />
              {firstMode === 'PERCENT' && <p className="text-xs text-muted-foreground tabular-nums">{`= ${inr(firstAmount)} (% of the loan amount)`}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ng-penalty">{t('girvi.penalty_pct')}</Label>
              <Input id="ng-penalty" type="number" step="0.01" min={0} max={100} value={terms.penaltyRatePercent} onChange={(e) => setTerm('penaltyRatePercent', e.target.value)} />
            </div>
          </div>
        </Card>

        <Card className="space-y-3 self-start p-6 text-sm tabular-nums">
          <table className="w-full border-collapse" aria-label="Item summary">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground"><th className="py-1.5 pr-2 font-medium">{t('girvi.col_sn')}</th><th className="py-1.5 pr-2 font-medium">{t('girvi.col_name')}</th><th className="py-1.5 text-right font-medium">{t('gst.col_value')}</th></tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.key} className="border-b last:border-0">
                  <td className="py-1.5 pr-2 text-muted-foreground">{i + 1}</td>
                  <td className="max-w-40 truncate py-1.5 pr-2">{r.name.trim() || '—'}</td>
                  <td className="py-1.5 text-right">{inr(valOf(r))}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-baseline justify-between border-b-2 border-brand pb-3"><span className="text-muted-foreground">{t('girvi.total_valuation')}</span><span className="text-xl font-extrabold">{inr(valuation)}</span></div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">{t('girvi.loan_principal')}</span>
            <Input className="ml-auto w-28" type="number" value={principalTouched ? principal : String(stdPrincipal)} onChange={(e) => { setPrincipalTouched(true); setPrincipal(e.target.value) }} aria-label="Principal" />
          </div>
          {def?.showStdPercent !== false && <p className="text-xs text-muted-foreground">{t('girvi.default_pct', { pct: def?.stdPercent ?? 60 })}</p>}
          <div className="grid grid-cols-2 gap-4 border-t pt-3">
            <div className="space-y-1.5"><Label htmlFor="ng-cash">{t('girvi.pay_cash')}</Label><Input id="ng-cash" type="number" value={pay.cash} onChange={(e) => setPay((p) => ({ ...p, cash: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label htmlFor="ng-online">{t('girvi.pay_online')}</Label><Input id="ng-online" type="number" value={pay.online} onChange={(e) => setPay((p) => ({ ...p, online: e.target.value }))} /></div>
            {n(pay.online) > 0 && (
              <div className="col-span-2 space-y-1.5"><Label>{t('udhari.bank')}</Label>
                <Select value={pay.bankAccountId} onValueChange={(v) => setPay((p) => ({ ...p, bankAccountId: v }))}><SelectTrigger aria-label="Bank account"><SelectValue placeholder={t('udhari.bank')} /></SelectTrigger>
                  <SelectContent>{banks?.map((b) => <SelectItem key={b.id} value={String(b.id)}>{b.bankName} · {b.accountNo}</SelectItem>)}</SelectContent></Select>
              </div>
            )}
          </div>
          <div className="flex justify-between"><span className="text-muted-foreground">{t('girvi.payout_vs_loan')}</span><span className={Math.abs(payTotal - effPrincipal) < 0.005 ? '' : 'text-destructive'}>{inr(payTotal)} / {inr(effPrincipal)}</span></div>
          <div className="space-y-1.5"><Label htmlFor="ng-remark">{t('udhari.remark')}</Label><Input id="ng-remark" value={remark} onChange={(e) => setRemark(e.target.value)} /></div>
          <Button size="lg" className="mt-2 w-full" disabled={!valid || create.isPending} onClick={() => void submit().catch(() => {})}>
            {create.isPending ? t('bill.saving') : t('girvi.create_loan')}
          </Button>
        </Card>
      </div>
      <MpinDialog open={savingCat != null} title="Add category to girvi settings" onConfirm={(mpin) => saveCategory(savingCat!, mpin)} onClose={() => setSavingCat(null)} />
    </div>
  )
}

/** Pick (or clear) one row's item photo before save; validated like the server (JPEG/PNG/WebP, 2 MB). */
function RowPhoto({ row, index, onPick }: { row: Row; index: number; onPick: (f: File | undefined) => void }) {
  const id = `ng-photo-${row.key}`
  const pick = (f: File | undefined) => {
    if (!f) return
    if (!PHOTO_TYPES.includes(f.type)) return toast.error('Photo must be a JPEG, PNG or WebP image')
    if (f.size > PHOTO_MAX) return toast.error('Photo must be 2 MB or smaller')
    onPick(f)
  }
  if (row.photo) {
    return (
      <span className="flex max-w-32 items-center gap-1 text-xs">
        <span className="truncate" title={row.photo.name}>{row.photo.name}</span>
        <Button type="button" variant="ghost" size="icon" className="size-6 shrink-0" aria-label={`Remove photo item ${index + 1}`} onClick={() => onPick(undefined)}><X className="size-3.5" aria-hidden /></Button>
      </span>
    )
  }
  return (
    <>
      <input id={id} type="file" accept={PHOTO_TYPES.join(',')} className="hidden" aria-label={`Photo file item ${index + 1}`} onChange={(e) => { pick(e.target.files?.[0]); e.target.value = '' }} />
      <Button type="button" variant="ghost" size="icon" className="size-8" aria-label={`Add photo item ${index + 1}`} title="Add photo (uploaded after save)" onClick={() => document.getElementById(id)?.click()}>
        <ImagePlus className="size-4" aria-hidden />
      </Button>
    </>
  )
}
