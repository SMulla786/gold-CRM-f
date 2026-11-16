import { zodResolver } from '@hookform/resolvers/zod'
import type { ColumnDef } from '@tanstack/react-table'
import { BadgeIndianRupee, CircleCheck, Layers, Users, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'

import { DataTable } from '@/components/DataTable'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { z } from 'zod'

import { useSavePlan, usePlans } from '@/lib/queries'
import { MODULES, planBody, type PlanDto } from '@/shared'

const inr = (s: string) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(s))

type PlanIn = z.input<typeof planBody>
type PlanOut = z.output<typeof planBody>

function PlanDialog({ plan, trigger }: { plan?: PlanDto; trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const save = useSavePlan()
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<PlanIn, unknown, PlanOut>({
    resolver: zodResolver(planBody),
    defaultValues: plan
      ? { name: plan.name, description: plan.description ?? undefined, durationDays: plan.durationDays, price: Number(plan.price), maxBranches: plan.maxBranches, maxUsers: plan.maxUsers, modules: plan.modules, isActive: plan.isActive, adSupported: plan.adSupported }
      : { durationDays: 365, price: 0, maxBranches: 1, maxUsers: 3, modules: ['dashboard', 'settings'], isActive: true, adSupported: false },
  })
  const modules = watch('modules') ?? []
  const toggle = (key: string) => setValue('modules', modules.includes(key) ? modules.filter((m) => m !== key) : [...modules, key], { shouldValidate: true })

  const onSubmit = handleSubmit(async (values) => {
    await save.mutateAsync({ id: plan?.id, body: values })
    setOpen(false)
    reset()
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{plan ? 'Edit plan' : 'New plan'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" {...register('name')} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Input id="description" {...register('description')} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="price">Price (₹)</Label>
              <Input id="price" type="number" step="0.01" {...register('price', { valueAsNumber: true })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="durationDays">Duration (days)</Label>
              <Input id="durationDays" type="number" {...register('durationDays', { valueAsNumber: true })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="maxBranches">Max branches</Label>
              <Input id="maxBranches" type="number" {...register('maxBranches', { valueAsNumber: true })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="maxUsers">Max users</Label>
              <Input id="maxUsers" type="number" {...register('maxUsers', { valueAsNumber: true })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Modules</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {MODULES.map((m) => (
                <label key={m.key} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={modules.includes(m.key)} onCheckedChange={() => toggle(m.key)} />
                  {m.label}
                </label>
              ))}
            </div>
            {errors.modules && <p className="text-xs text-destructive">{errors.modules.message}</p>}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={watch('isActive')} onCheckedChange={(v) => setValue('isActive', Boolean(v))} />
            Active (offered to new businesses)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={watch('adSupported')} onCheckedChange={(v) => setValue('adSupported', Boolean(v))} />
            Ad-supported (shows ads; applies to terms started from now on)
          </label>
          <DialogFooter>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? 'Saving…' : 'Save plan'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function Plans() {
  const { data, isLoading } = usePlans()

  const columns: ColumnDef<PlanDto, unknown>[] = [
    { accessorKey: 'name', header: 'Plan' },
    { accessorKey: 'price', header: 'Price', cell: ({ row }) => inr(row.original.price) },
    { accessorKey: 'durationDays', header: 'Days' },
    { header: 'Limits', cell: ({ row }) => `${row.original.maxBranches} br · ${row.original.maxUsers} users` },
    { header: 'Modules', cell: ({ row }) => row.original.modules.length },
    { accessorKey: 'activeSubscriptions', header: 'Active subs' },
    { accessorKey: 'isActive', header: 'Status', cell: ({ row }) => <Badge variant={row.original.isActive ? 'default' : 'secondary'}>{row.original.isActive ? 'Active' : 'Inactive'}</Badge> },
    { id: 'actions', header: '', cell: ({ row }) => <PlanDialog plan={row.original} trigger={<Button variant="outline" size="sm">Edit</Button>} /> },
  ]

  // Summary numbers derived from the plans already fetched (no extra requests).
  const plans = data ?? []
  const activePlans = plans.filter((p) => p.isActive)
  const subscriptionTotal = plans.reduce((sum, p) => sum + p.activeSubscriptions, 0)
  const lowestPrice = activePlans.length > 0 ? Math.min(...activePlans.map((p) => Number(p.price))) : null

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
          <h1>Plans</h1>
          <p className="mt-1 text-sm text-muted-foreground">Subscription tiers offered to businesses — pricing, limits and modules.</p>
        </div>
        <PlanDialog trigger={<Button>New plan</Button>} />
      </header>
      <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tile('Total tiers', data ? String(plans.length) : '—', 'All configured', Layers)}
        {tile('Offered now', data ? String(activePlans.length) : '—', data ? `${plans.length - activePlans.length} switched off` : undefined, CircleCheck)}
        {tile('Subscribers', data ? String(subscriptionTotal) : '—', 'Live subscriptions across tiers', Users)}
        {tile('Entry price', lowestPrice !== null ? inr(String(lowestPrice)) : '—', 'Cheapest offered tier', BadgeIndianRupee)}
      </div>
      <Card className="p-4">
        <DataTable columns={columns} data={data ?? []} isLoading={isLoading} />
      </Card>
    </div>
  )
}
