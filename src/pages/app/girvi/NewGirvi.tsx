import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { PartyPicker } from '@/components/PartyPicker'
import { TABLE_EDGES } from '@/components/SectionCard'
import { SelectBranchForTxn } from '@/components/SelectBranchForTxn'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useBankAccounts, useSettings } from '@/lib/appQueries'
import { useAuth } from '@/lib/auth'
import { useCreateGirvi } from '@/lib/girviQueries'
import { useT } from '@/lib/i18n'
import { businessDayISO, type PartyRefDto } from '@/shared'

let uid = 0
const k = () => `g${uid++}`
const today = businessDayISO
const inr = (s: string | number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(s))
const n = (s: string) => Number(s) || 0

interface Row { key: string; category: string; name: string; gross: string; net: string; purity: string; rate: string }
const blankRow = (category: string): Row => ({ key: k(), category, name: '', gross: '', net: '', purity: '', rate: '' })
const fineOf = (r: Row) => (n(r.net) * n(r.purity)) / 100
const valOf = (r: Row) => fineOf(r) * n(r.rate)

export function NewGirvi() {
  const t = useT()
  const navigate = useNavigate()
  const { activeBranch } = useAuth()
  const branchReady = activeBranch !== '' && activeBranch !== 'all'
  const { data: settings } = useSettings()
  const { data: banks } = useBankAccounts()
  const create = useCreateGirvi()
  const def = settings?.['girvi.defaults']
  const categories = def?.categories ?? ['Gold', 'Silver']

  const [party, setParty] = useState<PartyRefDto | null>(null)
  const [issueDate, setIssueDate] = useState(today())
  const [rows, setRows] = useState<Row[]>([blankRow('Gold')])
  const [terms, setTerms] = useState({ ratePercent: '', ratePeriod: '', interestType: '', ciPeriod: '', method: '', tenureMonths: '' })
  const [principal, setPrincipal] = useState('')
  const [principalTouched, setPrincipalTouched] = useState(false)
  const [pay, setPay] = useState({ cash: '', online: '', bankAccountId: '' })
  const [remark, setRemark] = useState('')
  const [seeded, setSeeded] = useState(false)

  // seed terms + std-% principal from girvi.defaults once settings arrive
  if (def && !seeded) {
    setSeeded(true)
    setTerms({ ratePercent: String(def.ratePercent), ratePeriod: def.ratePeriod, interestType: def.interestType, ciPeriod: def.ciPeriod, method: def.method, tenureMonths: String(def.tenureMonths) })
  }

  const setRow = (i: number, key: keyof Row, v: string) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [key]: v } : r)))
  const setTerm = (key: keyof typeof terms, v: string) => setTerms((s) => ({ ...s, [key]: v }))
  const valuation = rows.reduce((a, r) => a + valOf(r), 0)
  const stdPrincipal = def ? Math.round((def.stdPercent / 100) * valuation) : 0
  const effPrincipal = principalTouched ? n(principal) : stdPrincipal
  const payTotal = n(pay.cash) + n(pay.online)

  const valid = branchReady && !!party && rows.every((r) => r.name.trim() && n(r.gross) > 0 && n(r.net) > 0 && n(r.purity) > 0 && n(r.rate) > 0)
    && effPrincipal > 0 && effPrincipal <= valuation + 0.005 && Math.abs(payTotal - effPrincipal) < 0.005 && (n(pay.online) === 0 || pay.bankAccountId)

  const submit = async () => {
    const body = {
      partyId: party!.id, issueDate,
      items: rows.map((r) => ({ category: r.category, name: r.name.trim(), gross: n(r.gross), net: n(r.net), purity: n(r.purity), rate: n(r.rate) })),
      principal: effPrincipal, ratePercent: n(terms.ratePercent), ratePeriod: terms.ratePeriod, interestType: terms.interestType,
      ciPeriod: terms.interestType === 'CI' ? terms.ciPeriod : undefined, method: terms.method, tenureMonths: Number(terms.tenureMonths) || 1,
      cash: n(pay.cash), online: n(pay.online), bankAccountId: n(pay.online) > 0 ? Number(pay.bankAccountId) : undefined, remark: remark || undefined,
    }
    const saved = await create.mutateAsync(body)
    navigate(`/app/girvi/${saved.id}`)
  }

  return (
    <div className="space-y-6">
      {!branchReady && <SelectBranchForTxn note={t('girvi.branch_note')} />}

      <Card className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5 lg:col-span-2"><Label htmlFor="ng-party">{t('bill.customer')}</Label><PartyPicker value={party} onChange={setParty} placeholder={t('udhari.search_party')} id="ng-party" ariaLabel="Customer" /></div>
        <div className="space-y-1.5"><Label htmlFor="ng-date">{t('girvi.issue_date')}</Label><Input id="ng-date" type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} /></div>
      </Card>

      {/* Items stay before Loan terms in the DOM (specs use .nth(i) on Rate/Gross/Net). */}
      <Card className="overflow-hidden">
      <div className={`overflow-x-auto ${TABLE_EDGES}`}>
        <Table>
          <TableHeader>
            <TableRow><TableHead>{t('girvi.col_category')}</TableHead><TableHead className="min-w-40">{t('girvi.col_item')}</TableHead><TableHead>{t('stock.col_gross')}</TableHead><TableHead>{t('stock.col_net')}</TableHead><TableHead>{t('girvi.col_purity_pct')}</TableHead><TableHead>{t('stock.col_fine')}</TableHead><TableHead>{t('girvi.col_rate_g')}</TableHead><TableHead>{t('girvi.valuation')}</TableHead><TableHead /></TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={r.key}>
                <TableCell>
                  <Select value={r.category} onValueChange={(v) => setRow(i, 'category', v)}>
                    <SelectTrigger className="w-28" aria-label="Category"><SelectValue /></SelectTrigger>
                    <SelectContent>{categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </TableCell>
                <TableCell><Input className="w-40" aria-label="Item name" value={r.name} onChange={(e) => setRow(i, 'name', e.target.value)} /></TableCell>
                <TableCell><Input className="w-20" type="number" step="0.001" aria-label="Gross" value={r.gross} onChange={(e) => setRow(i, 'gross', e.target.value)} /></TableCell>
                <TableCell><Input className="w-20" type="number" step="0.001" aria-label="Net" value={r.net} onChange={(e) => setRow(i, 'net', e.target.value)} /></TableCell>
                <TableCell><Input className="w-16" type="number" step="0.01" aria-label="Purity" value={r.purity} onChange={(e) => setRow(i, 'purity', e.target.value)} /></TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground tabular-nums">{fineOf(r).toFixed(3)}</TableCell>
                <TableCell><Input className="w-24" type="number" aria-label="Rate" value={r.rate} onChange={(e) => setRow(i, 'rate', e.target.value)} /></TableCell>
                <TableCell className="whitespace-nowrap tabular-nums">{inr(valOf(r))}</TableCell>
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
            <div className="space-y-1.5"><Label htmlFor="ng-tenure">{t('girvi.tenure_months')}</Label><Input id="ng-tenure" type="number" value={terms.tenureMonths} onChange={(e) => setTerm('tenureMonths', e.target.value)} /></div>
          </div>
        </Card>

        <Card className="space-y-3 self-start p-6 text-sm tabular-nums">
          <div className="flex items-baseline justify-between border-b-2 border-brand pb-3"><span className="text-muted-foreground">{t('girvi.total_valuation')}</span><span className="text-xl font-extrabold">{inr(valuation)}</span></div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">{t('girvi.loan_principal')}</span>
            <Input className="ml-auto w-28" type="number" value={principalTouched ? principal : String(stdPrincipal)} onChange={(e) => { setPrincipalTouched(true); setPrincipal(e.target.value) }} aria-label="Principal" />
          </div>
          <p className="text-xs text-muted-foreground">{t('girvi.default_pct', { pct: def?.stdPercent ?? 60 })}</p>
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
    </div>
  )
}
