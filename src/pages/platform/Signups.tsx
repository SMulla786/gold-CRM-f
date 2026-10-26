import type { ColumnDef } from '@tanstack/react-table'
import { CalendarClock, Inbox, ListChecks, MapPin, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'

import { DataTable } from '@/components/DataTable'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useApproveSignup, usePlans, useRejectSignup, useSignups } from '@/lib/queries'
import type { SignupRequestDto } from '@/shared'

const date = (s: string) => new Date(s).toLocaleDateString('en-IN')
const statusVariant = (s: SignupRequestDto['status']) => (s === 'PENDING' ? 'secondary' : s === 'APPROVED' ? 'default' : 'destructive')

function ApproveDialog({ signup, onClose }: { signup: SignupRequestDto; onClose: () => void }) {
  const { data: plans } = usePlans()
  const approve = useApproveSignup()
  const navigate = useNavigate()
  const [planId, setPlanId] = useState<string>('')
  const { register, handleSubmit, formState } = useForm<{ name: string; username: string; password: string }>({
    defaultValues: { name: signup.ownerName },
  })

  const onSubmit = handleSubmit(async (owner) => {
    const biz = await approve.mutateAsync({ id: signup.id, planId: Number(planId), owner })
    onClose()
    navigate(`/platform/businesses/${biz.id}`)
  })

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Approve “{signup.shopName}”</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Plan</Label>
            <Select value={planId} onValueChange={setPlanId}>
              <SelectTrigger aria-label="Plan">
                <SelectValue placeholder="Select a plan" />
              </SelectTrigger>
              <SelectContent>
                {plans?.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="o-name">Owner name</Label>
            <Input id="o-name" {...register('name', { required: true })} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="o-user">Username</Label>
              <Input id="o-user" {...register('username', { required: true })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="o-pass">Password</Label>
              <Input id="o-pass" type="text" {...register('password', { required: true, minLength: 8 })} />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={!planId || !formState.isValid || approve.isPending}>
              {approve.isPending ? 'Creating…' : 'Approve & create business'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function RejectDialog({ signup, onClose }: { signup: SignupRequestDto; onClose: () => void }) {
  const reject = useRejectSignup()
  const { register, handleSubmit } = useForm<{ reason: string }>()
  const onSubmit = handleSubmit(async ({ reason }) => {
    await reject.mutateAsync({ id: signup.id, reason })
    onClose()
  })
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject “{signup.shopName}”</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="reason">Reason</Label>
            <Input id="reason" {...register('reason', { required: true, minLength: 3 })} />
          </div>
          <DialogFooter>
            <Button type="submit" variant="destructive" disabled={reject.isPending}>
              Reject
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function Signups() {
  const [status, setStatus] = useState('PENDING')
  const { data, isLoading } = useSignups(status)
  const [approving, setApproving] = useState<SignupRequestDto | null>(null)
  const [rejecting, setRejecting] = useState<SignupRequestDto | null>(null)

  const columns: ColumnDef<SignupRequestDto, unknown>[] = [
    { accessorKey: 'shopName', header: 'Shop' },
    { accessorKey: 'ownerName', header: 'Owner' },
    { accessorKey: 'whatsapp', header: 'WhatsApp' },
    { header: 'State', cell: ({ row }) => row.original.state.name },
    { accessorKey: 'createdAt', header: 'Requested', cell: ({ row }) => date(row.original.createdAt) },
    { accessorKey: 'status', header: 'Status', cell: ({ row }) => <Badge variant={statusVariant(row.original.status)}>{row.original.status}</Badge> },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) =>
        row.original.status === 'PENDING' ? (
          <div className="flex gap-2">
            <Button size="sm" onClick={() => setApproving(row.original)}>
              Approve
            </Button>
            <Button size="sm" variant="outline" onClick={() => setRejecting(row.original)}>
              Reject
            </Button>
          </div>
        ) : null,
    },
  ]

  // Summary numbers derived from the list already fetched (no extra requests).
  const items = data?.items ?? []
  const stateCount = new Set(items.map((r) => r.state.name)).size
  const latest = items.reduce<string | null>((max, r) => (max === null || r.createdAt > max ? r.createdAt : max), null)

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
          <h1>Sign-up Requests</h1>
          <p className="mt-1 text-sm text-muted-foreground">Review new jeweller applications and onboard their shops</p>
        </div>
      </header>

      <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tile('Total in view', data ? String(data.total) : '—', 'Matching status filter', Inbox)}
        {tile('Shown on this page', data ? String(items.length) : '—', data ? `of ${data.total} total` : undefined, ListChecks)}
        {tile('Regions on this page', data ? String(stateCount) : '—', 'Distinct states', MapPin)}
        {tile('Latest on this page', latest ? date(latest) : '—', 'Most recent request date', CalendarClock)}
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 pt-6">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-40" aria-label="Filter by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="APPROVED">Approved</SelectItem>
              <SelectItem value="REJECTED">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card className="p-4">
        <DataTable columns={columns} data={data?.items ?? []} isLoading={isLoading} emptyText="No sign-up requests" />
      </Card>
      {approving && <ApproveDialog signup={approving} onClose={() => setApproving(null)} />}
      {rejecting && <RejectDialog signup={rejecting} onClose={() => setRejecting(null)} />}
    </div>
  )
}
