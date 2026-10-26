import { useState } from 'react'

import { AuthedImage } from '@/components/AuthedImage'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAdminSubscription, useSubmitSubscriptionPayment } from '@/lib/queries'
import { MODULES, type SubscriptionPaymentRowDto } from '@/shared'

const inr = (s: string) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(s))
const statusVariant = (s: SubscriptionPaymentRowDto['status']) => (s === 'CONFIRMED' ? 'default' : s === 'PENDING' ? 'secondary' : 'destructive')

/** TASK-95: owner submits a payment (UTR + optional screenshot); it stays PENDING until the platform confirms. */
function SubmitPayment() {
  const submit = useSubmitSubscriptionPayment()
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<'UPI' | 'BANK' | 'CASH'>('UPI')
  const [utr, setUtr] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const valid = Number(amount) > 0 && (method === 'CASH' || utr.trim().length > 3)
  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!valid || submit.isPending) return
    submit.mutate(
      { body: { amount: Number(amount), method, utr: utr.trim() || undefined }, file },
      { onSuccess: () => { setAmount(''); setUtr(''); setFile(null) } },
    )
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Submit a payment</CardTitle>
        <p className="text-sm text-muted-foreground">Paid by UPI or bank transfer? Send the reference and a screenshot — it is confirmed by the platform team.</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-3" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="pay-amount">Amount (₹) *</Label>
            <Input id="pay-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pay-method">Method *</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as typeof method)}>
              <SelectTrigger id="pay-method"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="UPI">UPI</SelectItem>
                <SelectItem value="BANK">Bank transfer</SelectItem>
                <SelectItem value="CASH">Cash</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pay-utr">Transaction ID / UTR {method !== 'CASH' && '*'}</Label>
            <Input id="pay-utr" maxLength={40} value={utr} onChange={(e) => setUtr(e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="pay-proof">Payment screenshot (JPEG / PNG / WebP, max 2 MB)</Label>
            <Input id="pay-proof" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
          <div className="flex items-end">
            <Button type="submit" className="w-full" disabled={!valid || submit.isPending}>{submit.isPending ? 'Submitting…' : 'Submit payment proof'}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function PaymentHistory({ rows }: { rows: SubscriptionPaymentRowDto[] }) {
  const [open, setOpen] = useState<number | null>(null)
  return (
    <Card>
      <CardHeader><CardTitle>Transaction history</CardTitle></CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No payments submitted yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>UTR</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Proof</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{date(p.createdAt)}</TableCell>
                    <TableCell className="text-right tabular-nums">{inr(p.amount)}</TableCell>
                    <TableCell>{p.method}</TableCell>
                    <TableCell>{p.utr ?? '—'}</TableCell>
                    <TableCell><Badge variant={statusVariant(p.status)}>{p.status}</Badge></TableCell>
                    <TableCell>
                      {p.hasProof ? (
                        <Button variant="ghost" size="sm" onClick={() => setOpen(open === p.id ? null : p.id)}>{open === p.id ? 'Hide' : 'View'}</Button>
                      ) : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {open != null && <AuthedImage path={`/admin/subscription/payments/${open}/proof`} alt="Payment screenshot" className="mt-4 max-h-96 rounded-xl border" />}
      </CardContent>
    </Card>
  )
}

const date = (s: string) => new Date(s).toLocaleDateString('en-IN')
const labelOf = (key: string) => MODULES.find((m) => m.key === key)?.label ?? key

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
  const { data, isLoading } = useAdminSubscription()
  if (isLoading || !data) return <p className="text-sm text-muted-foreground">Loading…</p>

  return (
    <div className="max-w-4xl space-y-8">
      <div className="flex items-center gap-3">
        <div>
          <h1>Subscription</h1>
          <p className="mt-1 text-sm text-muted-foreground">Your plan, limits and usage.</p>
        </div>
        {data.readOnly && <Badge variant="destructive">Read-only</Badge>}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{data.planName}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground">
            {date(data.startsAt)} → {date(data.endsAt)}
          </div>
          <Usage label="Branches" used={data.usedBranches} max={data.maxBranches} />
          <Usage label="Users" used={data.usedUsers} max={data.maxUsers} />
          <div>
            <div className="mb-2 text-sm font-medium">Enabled modules</div>
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
      <SubmitPayment />
      <PaymentHistory rows={data.payments ?? []} />
    </div>
  )
}
