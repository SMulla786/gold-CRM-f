import { zodResolver } from '@hookform/resolvers/zod'
import type { ColumnDef } from '@tanstack/react-table'
import { cloneElement, isValidElement, useId, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'

import { DataTable } from '@/components/DataTable'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useBusinesses, useCreateBusiness, usePlans, useStates } from '@/lib/queries'
import { createBusinessBody, type BusinessListItemDto } from '@/shared'

type CreateForm = ReturnType<typeof createBusinessBody.parse>

const subBadge = (s: BusinessListItemDto['subscriptionState']) =>
  s === 'active' ? 'default' : s === 'expiring' ? 'secondary' : 'destructive'

function CreateWizard() {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(1)
  const create = useCreateBusiness()
  const navigate = useNavigate()
  const { data: states } = useStates()
  const { data: plans } = usePlans()

  const form = useForm<CreateForm>({ resolver: zodResolver(createBusinessBody), defaultValues: { owner: {} } as CreateForm })
  const { register, handleSubmit, trigger, watch, setValue, reset, formState } = form

  const close = () => {
    setOpen(false)
    setStep(1)
    reset()
  }
  const next = async () => {
    const ok = await trigger(step === 1 ? (['name', 'ownerName', 'mobile'] as const) : (['owner'] as const))
    if (ok) setStep((s) => s + 1)
  }
  const onSubmit = handleSubmit(async (values) => {
    const biz = await create.mutateAsync(values)
    close()
    navigate(`/platform/businesses/${biz.id}`)
  })

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <DialogTrigger asChild>
        <Button>New business</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New business · step {step} of 3</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          {step === 1 && (
            <>
              <Field label="Business name" error={formState.errors.name?.message}>
                <Input {...register('name')} />
              </Field>
              <Field label="Owner name" error={formState.errors.ownerName?.message}>
                <Input {...register('ownerName')} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Mobile" error={formState.errors.mobile?.message}>
                  <Input {...register('mobile')} />
                </Field>
                <Field label="Email">
                  <Input type="email" {...register('email')} />
                </Field>
              </div>
              <Field label="GSTIN">
                <Input {...register('gstin')} />
              </Field>
              <Field label="State">
                <Select value={watch('stateId') ? String(watch('stateId')) : ''} onValueChange={(v) => setValue('stateId', Number(v))}>
                  <SelectTrigger aria-label="State">
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent>
                    {states?.map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </>
          )}

          {step === 2 && (
            <>
              <Field label="Owner login name" error={formState.errors.owner?.name?.message}>
                <Input {...register('owner.name')} defaultValue={watch('ownerName')} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Username" error={formState.errors.owner?.username?.message}>
                  <Input {...register('owner.username')} />
                </Field>
                <Field label="Password" error={formState.errors.owner?.password?.message}>
                  <Input type="text" {...register('owner.password')} />
                </Field>
              </div>
            </>
          )}

          {step === 3 && (
            <Field label="Plan" error={formState.errors.planId?.message}>
              <Select value={watch('planId') ? String(watch('planId')) : ''} onValueChange={(v) => setValue('planId', Number(v), { shouldValidate: true })}>
                <SelectTrigger aria-label="Plan">
                  <SelectValue placeholder="Select a plan" />
                </SelectTrigger>
                <SelectContent>
                  {plans?.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name} — {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(p.price))}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}

          <DialogFooter className="justify-between sm:justify-between">
            {step > 1 ? (
              <Button type="button" variant="outline" onClick={() => setStep((s) => s - 1)}>
                Back
              </Button>
            ) : (
              <span />
            )}
            {step < 3 ? (
              <Button type="button" onClick={next}>
                Next
              </Button>
            ) : (
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? 'Creating…' : 'Create business'}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  const id = useId()
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {isValidElement(children) ? cloneElement(children as React.ReactElement<{ id?: string }>, { id }) : children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

export function Businesses() {
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('')
  const { data, isLoading } = useBusinesses({ page, status: status || undefined })

  const columns: ColumnDef<BusinessListItemDto, unknown>[] = [
    { accessorKey: 'name', header: 'Business', cell: ({ row }) => <Link className="font-medium hover:underline" to={`/platform/businesses/${row.original.id}`}>{row.original.name}</Link> },
    { accessorKey: 'ownerName', header: 'Owner' },
    { accessorKey: 'planName', header: 'Plan', cell: ({ row }) => row.original.planName ?? '—' },
    { accessorKey: 'subscriptionState', header: 'Subscription', cell: ({ row }) => <Badge variant={subBadge(row.original.subscriptionState)}>{row.original.subscriptionState}</Badge> },
    { header: 'Branches / Users', cell: ({ row }) => `${row.original.branchCount} / ${row.original.userCount}` },
    { accessorKey: 'status', header: 'Status', cell: ({ row }) => <Badge variant={row.original.status === 'ACTIVE' ? 'default' : 'destructive'}>{row.original.status}</Badge> },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Businesses</h1>
        <div className="flex items-center gap-3">
          <Select value={status || 'all'} onValueChange={(v) => setStatus(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-40" aria-label="Filter by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="SUSPENDED">Suspended</SelectItem>
            </SelectContent>
          </Select>
          <CreateWizard />
        </div>
      </div>
      <DataTable
        columns={columns}
        data={data?.items ?? []}
        isLoading={isLoading}
        pagination={data ? { page: data.page, pageSize: data.pageSize, total: data.total, onPage: setPage } : undefined}
      />
    </div>
  )
}
