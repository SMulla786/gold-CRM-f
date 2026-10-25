import type { ColumnDef } from '@tanstack/react-table'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'

import { DataTable } from '@/components/DataTable'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
          <div className="grid grid-cols-2 gap-3">
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Sign-up Requests</h1>
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
      </div>
      <DataTable columns={columns} data={data?.items ?? []} isLoading={isLoading} emptyText="No sign-up requests" />
      {approving && <ApproveDialog signup={approving} onClose={() => setApproving(null)} />}
      {rejecting && <RejectDialog signup={rejecting} onClose={() => setRejecting(null)} />}
    </div>
  )
}
