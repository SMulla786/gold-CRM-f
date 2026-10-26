import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { PartyPicker } from '@/components/PartyPicker'
import { SelectBranchForTxn } from '@/components/SelectBranchForTxn'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useBankAccounts, useSettings } from '@/lib/appQueries'
import { useAuth } from '@/lib/auth'
import { useCreateGirvi } from '@/lib/girviQueries'
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
    <div className="space-y-5">
      {!branchReady && <SelectBranchForTxn note="A girvi loan is booked at one branch. Select a branch." />}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5 lg:col-span-2"><Label htmlFor="ng-party">Customer</Label><PartyPicker value={party} onChange={setParty} placeholder="Search name / mobile" id="ng-party" ariaLabel="Customer" /></div>
        <div className="space-y-1.5"><Label htmlFor="ng-date">Issue date</Label><Input id="ng-date" type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} /></div>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow><TableHead>Category</TableHead><TableHead className="min-w-40">Item</TableHead><TableHead>Gross</TableHead><TableHead>Net</TableHead><TableHead>Purity%</TableHead><TableHead>Fine</TableHead><TableHead>Rate/g</TableHead><TableHead>Valuation</TableHead><TableHead /></TableRow>
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
                <TableCell><Button variant="ghost" size="sm" aria-label="Remove item" disabled={rows.length === 1} onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}>✕</Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Button variant="outline" size="sm" onClick={() => setRows((rs) => [...rs, blankRow(categories[0] ?? 'Gold')])}>+ Add item</Button>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-3 rounded-md border p-4">
          <h2 className="text-sm font-semibold">Loan terms</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label htmlFor="ng-rate">Interest %</Label><Input id="ng-rate" type="number" step="0.01" value={terms.ratePercent} onChange={(e) => setTerm('ratePercent', e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Per</Label>
              <Select value={terms.ratePeriod} onValueChange={(v) => setTerm('ratePeriod', v)}><SelectTrigger aria-label="Rate period"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="MONTHLY">Month</SelectItem><SelectItem value="ANNUAL">Year</SelectItem></SelectContent></Select>
            </div>
            <div className="space-y-1.5"><Label>Interest type</Label>
              <Select value={terms.interestType} onValueChange={(v) => setTerm('interestType', v)}><SelectTrigger aria-label="Interest type"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="SI">Simple</SelectItem><SelectItem value="CI">Compound</SelectItem></SelectContent></Select>
            </div>
            {terms.interestType === 'CI' && (
              <div className="space-y-1.5"><Label>Compounding</Label>
                <Select value={terms.ciPeriod} onValueChange={(v) => setTerm('ciPeriod', v)}><SelectTrigger aria-label="Compounding period"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="DAILY">Daily</SelectItem><SelectItem value="MONTHLY">Monthly</SelectItem><SelectItem value="HALF_YEARLY">Half-yearly</SelectItem><SelectItem value="YEARLY">Yearly</SelectItem></SelectContent></Select>
              </div>
            )}
            <div className="space-y-1.5"><Label>Day count</Label>
              <Select value={terms.method} onValueChange={(v) => setTerm('method', v)}><SelectTrigger aria-label="Day count method"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="FULL_MONTH">Full month</SelectItem><SelectItem value="DAY_WISE">Day-wise</SelectItem></SelectContent></Select>
            </div>
            <div className="space-y-1.5"><Label htmlFor="ng-tenure">Tenure (months)</Label><Input id="ng-tenure" type="number" value={terms.tenureMonths} onChange={(e) => setTerm('tenureMonths', e.target.value)} /></div>
          </div>
        </div>

        <div className="space-y-2 rounded-md border p-4 text-sm tabular-nums">
          <div className="flex justify-between"><span className="text-muted-foreground">Total valuation</span><span className="font-medium">{inr(valuation)}</span></div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Loan (principal)</span>
            <Input className="ml-auto w-28" type="number" value={principalTouched ? principal : String(stdPrincipal)} onChange={(e) => { setPrincipalTouched(true); setPrincipal(e.target.value) }} aria-label="Principal" />
          </div>
          <p className="text-xs text-muted-foreground">Default {def?.stdPercent ?? 60}% of valuation. Must not exceed valuation.</p>
          <div className="grid grid-cols-2 gap-2 border-t pt-2">
            <div className="space-y-1.5"><Label htmlFor="ng-cash">Pay cash ₹</Label><Input id="ng-cash" type="number" value={pay.cash} onChange={(e) => setPay((p) => ({ ...p, cash: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label htmlFor="ng-online">Pay online ₹</Label><Input id="ng-online" type="number" value={pay.online} onChange={(e) => setPay((p) => ({ ...p, online: e.target.value }))} /></div>
            {n(pay.online) > 0 && (
              <div className="col-span-2 space-y-1.5"><Label>Bank</Label>
                <Select value={pay.bankAccountId} onValueChange={(v) => setPay((p) => ({ ...p, bankAccountId: v }))}><SelectTrigger aria-label="Bank account"><SelectValue placeholder="Bank" /></SelectTrigger>
                  <SelectContent>{banks?.map((b) => <SelectItem key={b.id} value={String(b.id)}>{b.bankName} · {b.accountNo}</SelectItem>)}</SelectContent></Select>
              </div>
            )}
          </div>
          <div className="flex justify-between"><span className="text-muted-foreground">Payout vs loan</span><span className={Math.abs(payTotal - effPrincipal) < 0.005 ? '' : 'text-destructive'}>{inr(payTotal)} / {inr(effPrincipal)}</span></div>
          <div className="space-y-1.5"><Label htmlFor="ng-remark">Remark</Label><Input id="ng-remark" value={remark} onChange={(e) => setRemark(e.target.value)} /></div>
          <Button className="w-full" disabled={!valid || create.isPending} onClick={() => void submit().catch(() => {})}>
            {create.isPending ? 'Saving…' : 'Create loan'}
          </Button>
        </div>
      </div>
    </div>
  )
}
