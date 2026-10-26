import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { useForm, type FieldError } from 'react-hook-form'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAuth } from '@/lib/auth'
import { useAdminBusiness, useChangePassword, useSetMpin, useStates, useUpdateAdminBusiness } from '@/lib/queries'
import { changePasswordBody, setMpinBody, updateBusinessBody } from '@/shared'

type ProfileForm = z.input<typeof updateBusinessBody>

const passwordForm = changePasswordBody
  .extend({ confirm: z.string() })
  .refine((v) => v.next === v.confirm, { message: "Passwords don't match", path: ['confirm'] })
const mpinForm = setMpinBody
  .extend({ confirm: z.string() })
  .refine((v) => v.mpin === v.confirm, { message: "MPINs don't match", path: ['confirm'] })

const Err = ({ e }: { e?: FieldError }) => (e ? <p className="text-xs text-destructive">{e.message}</p> : null)

function ChangePasswordCard() {
  const change = useChangePassword()
  const { register, handleSubmit, reset, formState } = useForm<z.infer<typeof passwordForm>>({ resolver: zodResolver(passwordForm) })
  const onSubmit = handleSubmit(async ({ current, next }) => {
    await change.mutateAsync({ current, next })
    reset({ current: '', next: '', confirm: '' })
  })
  return (
    <Card>
      <CardHeader>
        <CardTitle>Change password</CardTitle>
        <CardDescription>You stay signed in here; other devices are signed out.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="pw-current">Current password</Label>
            <Input id="pw-current" type="password" autoComplete="current-password" {...register('current')} />
            <Err e={formState.errors.current} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pw-next">New password</Label>
              <Input id="pw-next" type="password" autoComplete="new-password" {...register('next')} />
              <Err e={formState.errors.next} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pw-confirm">Confirm new password</Label>
              <Input id="pw-confirm" type="password" autoComplete="new-password" {...register('confirm')} />
              <Err e={formState.errors.confirm} />
            </div>
          </div>
          <Button type="submit" disabled={change.isPending}>
            {change.isPending ? 'Saving…' : 'Change password'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function ChangeMpinCard() {
  const { me } = useAuth()
  // `me` is only reloaded on login, so remember a successful save locally to flip the wording.
  const [hasMpin, setHasMpin] = useState(!!me?.hasMpin)
  const save = useSetMpin()
  const { register, handleSubmit, reset, formState } = useForm<z.infer<typeof mpinForm>>({ resolver: zodResolver(mpinForm) })
  const onSubmit = handleSubmit(async ({ password, mpin }) => {
    await save.mutateAsync({ password, mpin })
    setHasMpin(true)
    reset({ password: '', mpin: '', confirm: '' })
  })
  const digits = { inputMode: 'numeric' as const, maxLength: 4, autoComplete: 'off' }
  return (
    <Card>
      <CardHeader>
        <CardTitle>{hasMpin ? 'Change MPIN' : 'Set MPIN'}</CardTitle>
        <CardDescription>4-digit PIN asked before sensitive edits and deletes.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="mpin-password">Account password</Label>
            <Input id="mpin-password" type="password" autoComplete="current-password" {...register('password')} />
            <Err e={formState.errors.password} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="mpin-new">New MPIN</Label>
              <Input id="mpin-new" type="password" {...digits} {...register('mpin')} />
              <Err e={formState.errors.mpin} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mpin-confirm">Confirm MPIN</Label>
              <Input id="mpin-confirm" type="password" {...digits} {...register('confirm')} />
              <Err e={formState.errors.confirm} />
            </div>
          </div>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : hasMpin ? 'Change MPIN' : 'Set MPIN'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

export function BusinessProfile() {
  const { data, isLoading } = useAdminBusiness()
  const { data: states } = useStates()
  const update = useUpdateAdminBusiness()
  const { register, handleSubmit, reset, watch, setValue } = useForm<ProfileForm>({ resolver: zodResolver(updateBusinessBody) })

  useEffect(() => {
    if (data) reset({ name: data.name, mobile: data.mobile, email: data.email ?? undefined, gstin: data.gstin ?? undefined, address: data.address ?? undefined, stateId: data.stateId ?? undefined })
  }, [data, reset])

  if (isLoading || !data) return <p className="text-sm text-muted-foreground">Loading…</p>

  const onSubmit = handleSubmit(async (v) => {
    await update.mutateAsync(v as Record<string, unknown>)
  })

  return (
    <div className="max-w-xl space-y-8">
      <div>
        <h1>Business Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your business name, address, GST and contact details.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="p-name">Business name</Label>
              <Input id="p-name" {...register('name', { required: true })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="p-mobile">Mobile</Label>
                <Input id="p-mobile" {...register('mobile', { required: true })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-email">Email</Label>
                <Input id="p-email" type="email" {...register('email')} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="p-gstin">GSTIN</Label>
                <Input id="p-gstin" {...register('gstin')} />
              </div>
              <div className="space-y-1.5">
                <Label>State</Label>
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
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-address">Address</Label>
              <Input id="p-address" {...register('address')} />
            </div>
            <Button type="submit" disabled={update.isPending}>
              {update.isPending ? 'Saving…' : 'Save changes'}
            </Button>
          </form>
        </CardContent>
      </Card>
      <h2 className="pt-2">Security</h2>
      <ChangePasswordCard />
      <ChangeMpinCard />
    </div>
  )
}
