import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { CalendarClock, CalendarDays, IndianRupee, ListChecks, ReceiptText, type LucideIcon } from 'lucide-react'

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

const tile = (label: string, value: string, Icon: LucideIcon) => (
  <Card className="gap-2 hover:-translate-y-1">
    <CardHeader className="flex flex-row items-center justify-between pb-1">
      <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</CardTitle>
      <span className="icon-chip"><Icon className="size-5" aria-hidden /></span>
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-extrabold tracking-tight tabular-nums">{value}</div>
    </CardContent>
  </Card>
)

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

  if (isLoading || !e) return <p className="text-sm text-muted-foreground">Loading…</p>
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
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <h2 className="text-xl">{e.assignId} · {e.displayName}</h2>
            <p className="text-sm text-muted-foreground">{e.scheme.name} · {e.party.name} {e.party.mobile ? `· ${e.party.mobile}` : ''}</p>
          </div>
          <Badge variant={e.status === 'ACTIVE' ? 'default' : 'secondary'}>{e.status}</Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          {canCollect && open && <Button onClick={() => setPaying(true)}>Add money</Button>}
          {canManage && e.status === 'ACTIVE' && <Button variant="outline" onClick={() => setWinning(true)}>Mark won</Button>}
          {canManage && open && <Button variant="outline" onClick={() => setRedeeming(true)}>Redeem / withdraw</Button>}
          <Button variant="ghost" onClick={() => window.print()}>Print passbook</Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tile('EMI', inr(e.emiAmount), IndianRupee)}
        {tile('Installments', `${e.emisPaid}/${e.scheme.tenureMonths}${e.emisDue > 0 ? ` · ${e.emisDue} due` : ''}`, ListChecks)}
        {tile('Next EMI', e.nextEmiNo ? `#${e.nextEmiNo} · ${date(e.nextEmiDate)}` : '—', CalendarClock)}
        {tile('Started', date(e.startDate), CalendarDays)}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">Maturity {e.matured ? <Badge className="ml-2">Matured</Badge> : <span className="text-sm font-normal text-muted-foreground">(as of today)</span>}</h3>
          </CardHeader>
          <CardContent className="space-y-4">
            {gold && (
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1.5"><Label htmlFor="md-rate">Redeem rate /10g</Label><Input id="md-rate" className="w-40" type="number" placeholder="today" value={redeemRate} onChange={(ev) => setRedeemRate(ev.target.value)} /></div>
                <label className="flex items-center gap-2 pb-2 text-sm"><Checkbox checked={early} onCheckedChange={(v) => setEarly(v === true)} aria-label="Early (no bonus)" /> Early (no bonus)</label>
              </div>
            )}
            {!gold && <label className="flex items-center gap-2 text-sm"><Checkbox checked={early} onCheckedChange={(v) => setEarly(v === true)} aria-label="Early (no bonus)" /> Early withdrawal (no bonus)</label>}
            <div className="space-y-2 rounded-2xl bg-muted/50 p-4 text-sm tabular-nums">
              <div className="flex justify-between"><span className="text-muted-foreground">Paid</span><span>{inr(live.paid)}</span></div>
              {gold && <div className="flex justify-between"><span className="text-muted-foreground">Fine</span><span>{live.fine} g</span></div>}
              <div className="flex justify-between"><span className="text-muted-foreground">Bonus</span><span>{gold ? `${live.bonus} g` : inr(live.bonus)}</span></div>
              <div className="flex justify-between border-t pt-2 font-semibold"><span>Maturity {gold ? '(gold)' : ''}</span><span>{gold ? `${live.maturity} g` : inr(live.maturity)}</span></div>
              <div className="flex justify-between text-base font-extrabold text-primary"><span>Credit value</span><span>{inr(live.maturityValue)}</span></div>
            </div>
          </CardContent>
        </Card>

        {/* Passbook — the only region that prints */}
        <div className="print-area space-y-3 rounded-3xl border bg-card p-6 shadow-sm">
          <h3 className="text-lg font-semibold">Passbook · {e.assignId}</h3>
          <div className="overflow-x-auto">
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
                )) : (
                  <TableRow>
                    <TableCell colSpan={gold ? 6 : 5} className="py-10 text-center text-muted-foreground">
                      <div className="flex flex-col items-center gap-3">
                        <span className="icon-chip"><ReceiptText className="size-5" aria-hidden /></span>
                        <span className="text-sm">No payments yet</span>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      {paying && <AddMoneyDialog enrollment={e as EnrollmentDto} onClose={() => setPaying(false)} />}
      <MpinDialog open={winning} title="Mark this enrolment as won" onConfirm={(mpin) => won.mutateAsync({ id: e.id, mpin })} onClose={() => setWinning(false)} />
      <MpinDialog open={redeeming} title={early ? 'Withdraw early (no bonus)' : 'Redeem matured scheme'} onConfirm={(mpin) => redeem.mutateAsync({ id: e.id, mpin, body: { early, redeemRate: gold && redeemRate ? n(redeemRate) : undefined } })} onClose={() => setRedeeming(false)} />
      <MpinDialog open={reversingId != null} title="Reverse this payment" onConfirm={(mpin) => reverse.mutateAsync({ id: reversingId!, mpin })} onClose={() => setReversingId(null)} />
    </div>
  )
}
