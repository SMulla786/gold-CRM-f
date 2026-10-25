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
        <div className="space-y-4">
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
        <form onSubmit={onSubmit} className="space-y-4">
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
        <div className="space-y-2">
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">{b.name}</h1>
        <Badge variant={b.status === 'ACTIVE' ? 'default' : 'destructive'}>{b.status}</Badge>
        <div className="ml-auto flex gap-2">
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
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <Row k="Owner" v={b.owner ? `${b.owner.name} (${b.owner.username})` : '—'} />
            <Row k="Mobile" v={b.mobile} />
            <Row k="Email" v={b.email ?? '—'} />
            <Row k="GSTIN" v={b.gstin ?? '—'} />
            <Row k="State" v={b.state?.name ?? '—'} />
            <Row k="Address" v={b.address ?? '—'} />
            <Row k="Branches / Users" v={`${b.branchCount} / ${b.userCount}`} />
            <Row k="Created" v={date(b.createdAt)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Subscriptions</CardTitle>
            <Button size="sm" onClick={() => setDialog('assign')}>
              Assign / extend
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {b.subscriptions.length === 0 && <p className="text-sm text-muted-foreground">No subscriptions</p>}
            {b.subscriptions.map((s) => (
              <div key={s.id} className="rounded-md border p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{s.planName}</span>
                  <Badge variant={s.status === 'ACTIVE' ? 'default' : 'secondary'}>{s.status}</Badge>
                </div>
                <div className="mt-1 text-muted-foreground">
                  {date(s.startsAt)} → {date(s.endsAt)} · {s.maxBranches} br · {s.maxUsers} users · {s.modules.length} modules
                </div>
                {s.status === 'ACTIVE' && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
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
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Payments</CardTitle>
          <Button size="sm" onClick={() => setDialog('payment')}>
            Record payment
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {b.payments.length === 0 && <p className="text-sm text-muted-foreground">No payments</p>}
          {b.payments.map((p) => (
            <div key={p.id} className="flex items-center justify-between border-b py-1.5 text-sm last:border-0">
              <span>{date(p.paidAt)}</span>
              <span>{p.method}</span>
              <span className="text-muted-foreground">{p.utr ?? '—'}</span>
              <Badge variant={p.status === 'CONFIRMED' ? 'default' : p.status === 'PENDING' ? 'secondary' : 'destructive'}>{p.status}</Badge>
              <span className="font-medium">{inr(p.amount)}</span>
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
