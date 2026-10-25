import { useState } from 'react'
import { useParams } from 'react-router-dom'

import { MpinDialog } from '@/components/MpinDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAuth } from '@/lib/auth'
import { useEnrollment, useMarkWon, useRedeem, useReversePayment, useScheme } from '@/lib/schemesQueries'
import { schemeMaturity, type EnrollmentDto } from '@/shared'

import { AddMoneyDialog } from './AddMoneyDialog'

const inr = (s: string | number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(s))
const date = (s: string | null) => (s ? new Date(s).toLocaleDateString('en-IN') : '—')
const n = (s: string) => Number(s) || 0

export function MemberDetail() {
  const { id } = useParams()
  const enrollmentId = Number(id)
  const { can } = useAuth()
  const canCollect = can('schemes.add_money', 'edit')
  const canManage = can('schemes.all', 'edit')
  const canReverse = can('schemes.all', 'delete')

  const { data: e, isLoading } = useEnrollment(enrollmentId)
  const { data: scheme } = useScheme(e?.scheme.id ?? 0)
  const won = useMarkWon()
  const redeem = useRedeem()
  const reverse = useReversePayment()

  const [paying, setPaying] = useState(false)
  const [winning, setWinning] = useState(false)
  const [redeeming, setRedeeming] = useState(false)
  const [reversingId, setReversingId] = useState<number | null>(null)
  const [early, setEarly] = useState(false)
  const [redeemRate, setRedeemRate] = useState('')

  if (isLoading || !e) return <p className="text-muted-foreground">Loading…</p>
  const gold = e.scheme.type === 'GOLD'
  const open = e.status === 'ACTIVE' || e.status === 'WON'

  // Live maturity: recompute from payments as the user changes the redeem rate / early flag (scheme carries the bonus).
  const live = scheme
    ? schemeMaturity({
        type: e.scheme.type,
        payments: e.payments.filter((p) => !p.isReversed).map((p) => ({ amount: p.amount, fine: p.fine })),
        bonusType: scheme.bonusType, bonusValue: scheme.bonusValue, emiAmount: e.emiAmount,
        redeemRate: gold && redeemRate ? n(redeemRate) : undefined, early,
      })
    : e.maturity

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h2 className="text-xl font-semibold">{e.assignId} · {e.displayName}</h2>
          <p className="text-sm text-muted-foreground">{e.scheme.name} · {e.party.name} {e.party.mobile ? `· ${e.party.mobile}` : ''}</p>
        </div>
        <Badge variant={e.status === 'ACTIVE' ? 'default' : 'secondary'}>{e.status}</Badge>
        <div className="ml-auto flex flex-wrap gap-2">
          {canCollect && open && <Button onClick={() => setPaying(true)}>Add money</Button>}
          {canManage && e.status === 'ACTIVE' && <Button variant="outline" onClick={() => setWinning(true)}>Mark won</Button>}
          {canManage && open && <Button variant="outline" onClick={() => setRedeeming(true)}>Redeem / withdraw</Button>}
          <Button variant="ghost" onClick={() => window.print()}>Print passbook</Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card><CardHeader className="pb-1"><CardTitle className="text-sm font-medium text-muted-foreground">EMI</CardTitle></CardHeader><CardContent className="text-lg font-semibold tabular-nums">{inr(e.emiAmount)}</CardContent></Card>
        <Card><CardHeader className="pb-1"><CardTitle className="text-sm font-medium text-muted-foreground">Installments</CardTitle></CardHeader><CardContent className="text-lg font-semibold tabular-nums">{e.emisPaid}/{e.scheme.tenureMonths}{e.emisDue > 0 ? ` · ${e.emisDue} due` : ''}</CardContent></Card>
        <Card><CardHeader className="pb-1"><CardTitle className="text-sm font-medium text-muted-foreground">Next EMI</CardTitle></CardHeader><CardContent className="text-lg font-semibold tabular-nums">{e.nextEmiNo ? `#${e.nextEmiNo} · ${date(e.nextEmiDate)}` : '—'}</CardContent></Card>
        <Card><CardHeader className="pb-1"><CardTitle className="text-sm font-medium text-muted-foreground">Started</CardTitle></CardHeader><CardContent className="text-lg font-semibold tabular-nums">{date(e.startDate)}</CardContent></Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3 rounded-md border p-4">
          <h3 className="font-medium">Maturity {e.matured ? <Badge className="ml-2">Matured</Badge> : <span className="text-sm text-muted-foreground">(as of today)</span>}</h3>
          {gold && (
            <div className="flex items-end gap-3">
              <div className="space-y-1.5"><Label htmlFor="md-rate">Redeem rate /10g</Label><Input id="md-rate" className="w-40" type="number" placeholder="today" value={redeemRate} onChange={(ev) => setRedeemRate(ev.target.value)} /></div>
              <label className="flex items-center gap-2 pb-2 text-sm"><Checkbox checked={early} onCheckedChange={(v) => setEarly(v === true)} aria-label="Early (no bonus)" /> Early (no bonus)</label>
            </div>
          )}
          {!gold && <label className="flex items-center gap-2 text-sm"><Checkbox checked={early} onCheckedChange={(v) => setEarly(v === true)} aria-label="Early (no bonus)" /> Early withdrawal (no bonus)</label>}
          <div className="space-y-1 text-sm tabular-nums">
            <div className="flex justify-between"><span className="text-muted-foreground">Paid</span><span>{inr(live.paid)}</span></div>
            {gold && <div className="flex justify-between"><span className="text-muted-foreground">Fine</span><span>{live.fine} g</span></div>}
            <div className="flex justify-between"><span className="text-muted-foreground">Bonus</span><span>{gold ? `${live.bonus} g` : inr(live.bonus)}</span></div>
            <div className="flex justify-between border-t pt-1 font-semibold"><span>Maturity {gold ? '(gold)' : ''}</span><span>{gold ? `${live.maturity} g` : inr(live.maturity)}</span></div>
            <div className="flex justify-between font-semibold"><span>Credit value</span><span>{inr(live.maturityValue)}</span></div>
          </div>
        </div>

        {/* Passbook — the only region that prints */}
        <div className="print-area rounded-md border p-4">
          <h3 className="mb-2 font-medium">Passbook · {e.assignId}</h3>
          <Table>
            <TableHeader><TableRow><TableHead>EMI</TableHead><TableHead>Date</TableHead><TableHead>Amount</TableHead>{gold && <TableHead>Fine</TableHead>}<TableHead>Via</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {e.payments.length ? e.payments.map((p) => (
                <TableRow key={p.id} className={p.isReversed ? 'text-muted-foreground line-through' : ''}>
                  <TableCell>{p.emiNo ?? '—'}</TableCell>
                  <TableCell>{date(p.txnDate)}</TableCell>
                  <TableCell className="tabular-nums">{inr(p.amount)}</TableCell>
                  {gold && <TableCell className="tabular-nums">{p.fine ?? '—'}</TableCell>}
                  <TableCell>{p.medium}</TableCell>
                  <TableCell>{canReverse && open && !p.isReversed && <Button variant="ghost" size="sm" onClick={() => setReversingId(p.id)}>Reverse</Button>}</TableCell>
                </TableRow>
              )) : <TableRow><TableCell colSpan={gold ? 6 : 5} className="h-16 text-center text-muted-foreground">No payments yet</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      </div>

      {paying && <AddMoneyDialog enrollment={e as EnrollmentDto} onClose={() => setPaying(false)} />}
      <MpinDialog open={winning} title="Mark this enrolment as won" onConfirm={(mpin) => won.mutateAsync({ id: e.id, mpin })} onClose={() => setWinning(false)} />
      <MpinDialog open={redeeming} title={early ? 'Withdraw early (no bonus)' : 'Redeem matured scheme'} onConfirm={(mpin) => redeem.mutateAsync({ id: e.id, mpin, body: { early, redeemRate: gold && redeemRate ? n(redeemRate) : undefined } })} onClose={() => setRedeeming(false)} />
      <MpinDialog open={reversingId != null} title="Reverse this payment" onConfirm={(mpin) => reverse.mutateAsync({ id: reversingId!, mpin })} onClose={() => setReversingId(null)} />
    </div>
  )
}
