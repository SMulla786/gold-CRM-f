import { FileDown, Printer } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { AuthedImage } from '@/components/AuthedImage'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useT } from '@/lib/i18n'
import { useAdminBusiness, useAdminSubscription, useSubmitSubscriptionPayment } from '@/lib/queries'
import { downloadPdf } from '@/lib/share'
import { MODULES, recordPaymentBody, type AvailablePlanDto, type SubscriptionPaymentRowDto } from '@/shared'

const inr = (s: string) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(s))
const statusVariant = (s: SubscriptionPaymentRowDto['status']) => (s === 'CONFIRMED' ? 'default' : s === 'PENDING' ? 'secondary' : 'destructive')
/** Plan type from its duration: whole months when it is close to one ("12 months"), else days. */
const durationLabel = (days: number): string => {
  const months = Math.round(days / 30.4)
  if (months >= 1 && Math.abs(months * 30.4 - days) <= 3) return `${months} ${months === 1 ? 'month' : 'months'}`
  return `${days} ${days === 1 ? 'day' : 'days'}`
}

/** TASK-95: owner submits a payment (UTR + optional screenshot); it stays PENDING until the platform confirms. */
function SubmitPayment({ plan, onClearPlan }: { plan: AvailablePlanDto | null; onClearPlan: () => void }) {
  const t = useT()
  const submit = useSubmitSubscriptionPayment()
  // Choosing a plan remounts this form (keyed), so the amount starts at that plan's price.
  const [amount, setAmount] = useState(plan ? String(Number(plan.price)) : '')
  const [method, setMethod] = useState<'UPI' | 'BANK' | 'CASH'>('UPI')
  const [utr, setUtr] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const amountRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (plan) amountRef.current?.focus({ preventScroll: true })
  }, [plan])
  // Same shared rule as the API: a UPI UTR is exactly 12 digits.
  const utrError = utr.trim()
    ? recordPaymentBody.safeParse({ amount: 1, method, utr: utr.trim(), status: 'PENDING' }).error?.issues.find((i) => i.path[0] === 'utr')?.message
    : undefined
  const valid = Number(amount) > 0 && (method === 'CASH' || utr.trim().length > 3) && !utrError
  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!valid || submit.isPending) return
    submit.mutate(
      { body: { amount: Number(amount), method, utr: utr.trim() || undefined, ...(plan ? { planId: plan.id } : {}) }, file },
      { onSuccess: () => { setAmount(''); setUtr(''); setFile(null); onClearPlan() } },
    )
  }
  return (
    <Card id="subscription-pay">
      <CardHeader>
        <CardTitle>{t('subscription.submit_title')}</CardTitle>
        <p className="text-sm text-muted-foreground">{t('subscription.submit_hint')}</p>
        {plan && (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <span>
              Paying for <span className="font-medium">{plan.name}</span> · {durationLabel(plan.durationDays)} · {inr(plan.price)}
            </span>
            <Button type="button" variant="ghost" size="sm" onClick={onClearPlan}>Clear plan</Button>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-3" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="pay-amount">{t('subscription.amount_label')}</Label>
            <Input ref={amountRef} id="pay-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pay-method">{t('subscription.method_label')}</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as typeof method)}>
              <SelectTrigger id="pay-method"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="UPI">UPI</SelectItem>
                <SelectItem value="BANK">{t('subscription.method_bank')}</SelectItem>
                <SelectItem value="CASH">{t('subscription.method_cash')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pay-utr">{t('subscription.utr_label')} {method !== 'CASH' && '*'}</Label>
            <Input
              id="pay-utr"
              maxLength={40}
              inputMode={method === 'UPI' ? 'numeric' : undefined}
              value={utr}
              onChange={(e) => setUtr(e.target.value)}
              aria-invalid={utrError ? true : undefined}
              aria-describedby={utrError ? 'pay-utr-error' : undefined}
            />
            {utrError && <p id="pay-utr-error" role="alert" className="text-xs text-destructive">{utrError}</p>}
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="pay-proof">{t('subscription.proof_label')}</Label>
            <Input id="pay-proof" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
          <div className="flex items-end">
            <Button type="submit" className="w-full" disabled={!valid || submit.isPending}>{submit.isPending ? t('subscription.submitting') : t('subscription.submit_btn')}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

/** Printable receipt for one CONFIRMED subscription payment (print / browser "Save as PDF"). */
function SubscriptionReceiptDialog({ payment: p, onClose }: { payment: SubscriptionPaymentRowDto; onClose: () => void }) {
  const { data: business } = useAdminBusiness()
  const line = (label: string, value: string) => (
    <div className="flex justify-between gap-4"><span className="text-muted-foreground">{label}</span><span className="text-right font-medium">{value}</span></div>
  )
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-3 p-4 sm:max-w-sm print:inset-0 print:max-w-none print:border-0 print:shadow-none">
        <DialogHeader><DialogTitle>Subscription receipt</DialogTitle></DialogHeader>
        <div className="print-area space-y-2 rounded-2xl border bg-card p-4 text-sm tabular-nums print:rounded-none print:border-0">
          <header className="text-center">
            <div className="text-base font-bold">{business?.name ?? 'Business'}</div>
            {business?.address && <div className="text-xs">{business.address}</div>}
            {business?.gstin && <div className="text-xs">GSTIN: {business.gstin}</div>}
            <div className="mt-1 text-xs font-medium tracking-wide">SUBSCRIPTION PAYMENT RECEIPT</div>
          </header>
          <div className="space-y-1 border-t pt-2">
            {line('Receipt no', String(p.id))}
            {line('Date', date(p.paidAt ?? p.createdAt))}
            {line('Plan', p.planName ?? '—')}
            {p.planDurationDays != null && line('Plan type', durationLabel(p.planDurationDays))}
            {line('Method', p.method)}
            {p.utr && line('UTR', p.utr)}
          </div>
          <div className="flex justify-between border-t-2 border-brand pt-2 text-base font-bold"><span>Amount</span><span>{inr(p.amount)}</span></div>
        </div>
        <DialogFooter className="print:hidden">
          <Button variant="outline" size="sm" onClick={downloadPdf}><FileDown aria-hidden />PDF</Button>
          <Button size="sm" onClick={() => window.print()}><Printer aria-hidden />Print</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function PaymentHistory({ rows }: { rows: SubscriptionPaymentRowDto[] }) {
  const t = useT()
  const [open, setOpen] = useState<number | null>(null)
  const [receipt, setReceipt] = useState<SubscriptionPaymentRowDto | null>(null)
  return (
    <Card>
      <CardHeader><CardTitle>{t('subscription.history')}</CardTitle></CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('subscription.history_empty')}</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('udhari.date')}</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Plan type</TableHead>
                  <TableHead className="text-right">{t('subscription.col_amount')}</TableHead>
                  <TableHead>{t('subscription.col_method')}</TableHead>
                  <TableHead>UTR</TableHead>
                  <TableHead>{t('stock.col_status')}</TableHead>
                  <TableHead>{t('subscription.col_proof')}</TableHead>
                  <TableHead>Invoice</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{date(p.createdAt)}</TableCell>
                    <TableCell>{p.planName ?? '—'}</TableCell>
                    <TableCell>{p.planDurationDays != null ? durationLabel(p.planDurationDays) : '—'}</TableCell>
                    <TableCell className="text-right tabular-nums">{inr(p.amount)}</TableCell>
                    <TableCell>{p.method}</TableCell>
                    <TableCell>{p.utr ?? '—'}</TableCell>
                    <TableCell><Badge variant={statusVariant(p.status)}>{p.status}</Badge></TableCell>
                    <TableCell>
                      {p.hasProof ? (
                        <Button variant="ghost" size="sm" onClick={() => setOpen(open === p.id ? null : p.id)}>{open === p.id ? t('subscription.hide') : t('subscription.view')}</Button>
                      ) : '—'}
                    </TableCell>
                    <TableCell>
                      {p.status === 'CONFIRMED' ? (
                        <Button variant="ghost" size="sm" aria-label={`Download receipt ${p.id}`} onClick={() => setReceipt(p)}><FileDown aria-hidden />Receipt</Button>
                      ) : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {open != null && <AuthedImage path={`/admin/subscription/payments/${open}/proof`} alt="Payment screenshot" className="mt-4 max-h-96 rounded-xl border" />}
        {receipt && <SubscriptionReceiptDialog payment={receipt} onClose={() => setReceipt(null)} />}
      </CardContent>
    </Card>
  )
}

const date = (s: string) => new Date(s).toLocaleDateString('en-IN')
const labelOf = (key: string) => MODULES.find((m) => m.key === key)?.label ?? key

function AvailablePlans({ plans, currentPlanId, onChoose }: { plans: AvailablePlanDto[]; currentPlanId?: number; onChoose: (p: AvailablePlanDto) => void }) {
  if (plans.length === 0) return null
  return (
    <section aria-labelledby="available-plans-title" className="space-y-3">
      <h2 id="available-plans-title" className="text-lg font-semibold">Available plans</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {plans.map((p) => {
          const current = p.id === currentPlanId
          return (
            <Card key={p.id} className={current ? 'border-primary' : undefined}>
              <CardHeader className="space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle>{p.name}</CardTitle>
                  {current && <Badge>Current plan</Badge>}
                </div>
                {p.description && <p className="text-sm text-muted-foreground">{p.description}</p>}
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <span className="text-2xl font-bold tabular-nums">{inr(p.price)}</span>
                  <span className="text-sm text-muted-foreground"> / {durationLabel(p.durationDays)}</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  Up to {p.maxBranches} {p.maxBranches === 1 ? 'branch' : 'branches'} · {p.maxUsers} {p.maxUsers === 1 ? 'user' : 'users'}
                </div>
                {p.modules.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {p.modules.map((m) => <Badge key={m} variant="secondary">{labelOf(m)}</Badge>)}
                  </div>
                )}
                <Button className="w-full" variant={current ? 'default' : 'outline'} aria-label={`${current ? 'Renew' : 'Choose plan'} ${p.name}`} onClick={() => onChoose(p)}>
                  {current ? 'Renew' : 'Choose plan'}
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </section>
  )
}

function Usage({ label, used, max }: { label: string; used: number; max: number }) {
  const pct = Math.min(100, Math.round((used / max) * 100))
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span>
          {used} / {max}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-secondary">
        <div className={`h-full ${pct >= 100 ? 'bg-destructive' : 'bg-primary'}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export function SubscriptionView() {
  const t = useT()
  const { data, isLoading } = useAdminSubscription()
  const [chosen, setChosen] = useState<{ plan: AvailablePlanDto; n: number } | null>(null)
  if (isLoading || !data) return <p className="text-sm text-muted-foreground">{t('common.loading')}</p>

  return (
    <div className="max-w-4xl space-y-8">
      <div className="flex items-center gap-3">
        <div>
          <h1>{t('subscription.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subscription.subtitle')}</p>
        </div>
        {data.readOnly && <Badge variant="destructive">{t('subscription.read_only')}</Badge>}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{data.planName}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground">
            {date(data.startsAt)} → {date(data.endsAt)}
          </div>
          <Usage label={t('subscription.branches')} used={data.usedBranches} max={data.maxBranches} />
          <Usage label={t('subscription.users')} used={data.usedUsers} max={data.maxUsers} />
          <div>
            <div className="mb-2 text-sm font-medium">{t('subscription.modules')}</div>
            <div className="flex flex-wrap gap-2">
              {data.modules.map((m) => (
                <Badge key={m} variant="secondary">
                  {labelOf(m)}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
      <AvailablePlans
        plans={data.availablePlans ?? []}
        currentPlanId={data.planId}
        onChoose={(plan) => {
          setChosen((c) => ({ plan, n: (c?.n ?? 0) + 1 }))
          document.getElementById('subscription-pay')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }}
      />
      <SubmitPayment key={chosen ? `plan-${chosen.n}` : 'none'} plan={chosen?.plan ?? null} onClearPlan={() => setChosen(null)} />
      <PaymentHistory rows={data.payments ?? []} />
    </div>
  )
}
