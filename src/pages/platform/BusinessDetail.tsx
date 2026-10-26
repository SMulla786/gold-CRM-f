import { BadgeIndianRupee, Building2, CreditCard, Layers, Receipt, Users, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate, useParams } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAuth } from '@/lib/auth'
import { useAssignSubscription, useBusiness, usePlans, useRecordPayment, useSetBusinessStatus, useUpdateSubscription } from '@/lib/queries'

const inr = (s: string) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(s))
const date = (s: string | null) => (s ? new Date(s).toLocaleDateString('en-IN') : '—')

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1 text-sm">
      <span className="text-muted-foreground">{k}</span>
      <span className="text-right">{v}</span>
    </div>
  )
}

function AssignSubDialog({ businessId, onClose }: { businessId: number; onClose: () => void }) {
  const { data: plans } = usePlans()
  const assign = useAssignSubscription()
  const [planId, setPlanId] = useState('')
  const [notes, setNotes] = useState('')
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign subscription</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="space-y-1.5">
            <Label>Plan</Label>
            <Select value={planId} onValueChange={setPlanId}>
              <SelectTrigger aria-label="Plan">
                <SelectValue placeholder="Select a plan" />
              </SelectTrigger>
              <SelectContent>
                {plans?.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.name} · {p.durationDays}d · {inr(p.price)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={!planId || assign.isPending}
            onClick={async () => {
              await assign.mutateAsync({ id: businessId, body: { planId: Number(planId), notes: notes || undefined } })
              onClose()
            }}
          >
            Assign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function RecordPaymentDialog({ businessId, onClose }: { businessId: number; onClose: () => void }) {
  const record = useRecordPayment()
  const { register, handleSubmit, watch, setValue } = useForm<{ amount: number; method: string; utr?: string }>({ defaultValues: { method: 'UPI' } })
  const onSubmit = handleSubmit(async (v) => {
    await record.mutateAsync({ id: businessId, body: { amount: Number(v.amount), method: v.method, utr: v.utr || undefined } })
    onClose()
  })
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="amount">Amount (₹)</Label>
            <Input id="amount" type="number" step="0.01" {...register('amount', { valueAsNumber: true, required: true })} />
          </div>
          <div className="space-y-1.5">
            <Label>Method</Label>
            <Select value={watch('method')} onValueChange={(v) => setValue('method', v)}>
              <SelectTrigger aria-label="Payment method">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {['UPI', 'CASH', 'BANK', 'GATEWAY'].map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="utr">UTR / Reference</Label>
            <Input id="utr" {...register('utr')} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={record.isPending}>
              Record
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ImpersonateDialog({ businessId, onClose }: { businessId: number; onClose: () => void }) {
  const { impersonate } = useAuth()
  const navigate = useNavigate()
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Login as owner (support)</DialogTitle>
        </DialogHeader>
        <div className="grid gap-1.5">
          <Label htmlFor="reason">Reason (audit-logged)</Label>
          <Input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <DialogFooter>
          <Button
            disabled={reason.trim().length < 3 || busy}
            onClick={async () => {
              setBusy(true)
              try {
                await impersonate(businessId, reason)
                navigate('/admin')
              } finally {
                setBusy(false)
                onClose()
              }
            }}
          >
            Start session
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function BusinessDetail() {
  const { id } = useParams()
  const businessId = Number(id)
  const { data: b, isLoading } = useBusiness(businessId)
  const setStatus = useSetBusinessStatus()
  const updateSub = useUpdateSubscription()
  const [dialog, setDialog] = useState<'assign' | 'payment' | 'impersonate' | null>(null)

  if (isLoading || !b) return <p className="text-sm text-muted-foreground">Loading…</p>

  // Summary numbers derived from the business already fetched (no extra requests).
  const activeSub = b.subscriptions.find((s) => s.status === 'ACTIVE')
  const confirmedPayments = b.payments.filter((p) => p.status === 'CONFIRMED')
  const collected = confirmedPayments.reduce((sum, p) => sum + Number(p.amount), 0)

  const tile = (label: string, value: string, sub: string | undefined, Icon: LucideIcon) => (
    <Card className="gap-2 hover:-translate-y-1">
      <CardHeader className="flex flex-row items-center justify-between pb-1">
        <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</CardTitle>
        <span className="icon-chip"><Icon className="size-5" aria-hidden /></span>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-extrabold tracking-tight tabular-nums">{value}</div>
        {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1>{b.name}</h1>
            <Badge variant={b.status === 'ACTIVE' ? 'default' : 'destructive'}>{b.status}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Tenant account — owner details, plan history and billing.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setDialog('impersonate')}>
            Login as owner
          </Button>
          <Button
            variant={b.status === 'ACTIVE' ? 'destructive' : 'default'}
            onClick={() => setStatus.mutate({ id: businessId, action: b.status === 'ACTIVE' ? 'suspend' : 'activate' })}
          >
            {b.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
          </Button>
        </div>
      </header>

      <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tile('Current plan', activeSub ? activeSub.planName : '—', activeSub ? `Ends ${date(activeSub.endsAt)}` : 'No active plan', CreditCard)}
        {tile('Branch count', String(b.branchCount), activeSub ? `Limit ${activeSub.maxBranches}` : undefined, Building2)}
        {tile('User count', String(b.userCount), activeSub ? `Limit ${activeSub.maxUsers}` : undefined, Users)}
        {tile('Collected', inr(String(collected)), `${confirmedPayments.length} confirmed of ${b.payments.length} listed`, BadgeIndianRupee)}
      </div>

      <div className="stagger grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <Row k="Owner" v={b.owner ? `${b.owner.name} (${b.owner.username})` : '—'} />
            <Row k="Mobile" v={b.mobile} />
            <Row k="Alternate No" v={b.alternateMobile ?? '—'} />
            <Row k="Email" v={b.email ?? '—'} />
            <Row k="GSTIN" v={b.gstin ?? '—'} />
            <Row k="State" v={b.state?.name ?? '—'} />
            <Row k="Address" v={b.address ?? '—'} />
            <Row k="Branches / Users" v={`${b.branchCount} / ${b.userCount}`} />
            <Row k="Created" v={date(b.createdAt)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Subscriptions</CardTitle>
            <Button size="sm" onClick={() => setDialog('assign')}>
              Assign / extend
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {b.subscriptions.length === 0 && (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <span className="icon-chip"><Layers className="size-5" aria-hidden /></span>
                <p className="text-sm text-muted-foreground">No subscriptions</p>
              </div>
            )}
            {b.subscriptions.map((s) => (
              <div key={s.id} className="rounded-2xl border bg-muted/40 p-4 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold">{s.planName}</span>
                  <Badge variant={s.status === 'ACTIVE' ? 'default' : 'secondary'}>{s.status}</Badge>
                </div>
                <div className="mt-1 tabular-nums text-muted-foreground">
                  {date(s.startsAt)} → {date(s.endsAt)} · {s.maxBranches} br · {s.maxUsers} users · {s.modules.length} modules
                </div>
                {s.status === 'ACTIVE' && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => updateSub.mutate({ id: s.id, body: { status: 'CANCELLED' } })}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Payments</CardTitle>
          <Button size="sm" onClick={() => setDialog('payment')}>
            Record payment
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {b.payments.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <span className="icon-chip"><Receipt className="size-5" aria-hidden /></span>
              <p className="text-sm text-muted-foreground">No payments</p>
            </div>
          )}
          {b.payments.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 border-b py-2 text-sm last:border-0">
              <span className="tabular-nums">{date(p.paidAt)}</span>
              <span>{p.method}</span>
              <span className="text-muted-foreground">{p.utr ?? '—'}</span>
              <Badge variant={p.status === 'CONFIRMED' ? 'default' : p.status === 'PENDING' ? 'secondary' : 'destructive'}>{p.status}</Badge>
              <span className="font-semibold tabular-nums">{inr(p.amount)}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {dialog === 'assign' && <AssignSubDialog businessId={businessId} onClose={() => setDialog(null)} />}
      {dialog === 'payment' && <RecordPaymentDialog businessId={businessId} onClose={() => setDialog(null)} />}
      {dialog === 'impersonate' && <ImpersonateDialog businessId={businessId} onClose={() => setDialog(null)} />}
    </div>
  )
}
