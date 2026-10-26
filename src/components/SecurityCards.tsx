import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm, type FieldError } from 'react-hook-form'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/lib/auth'
import { useChangePassword, useSetMpin } from '@/lib/queries'
import { changePasswordBody, setMpinBody } from '@/shared'

// Self-service security for the signed-in user (any level): /auth/password and /auth/mpin act on the caller.
const passwordForm = changePasswordBody
  .extend({ confirm: z.string() })
  .refine((v) => v.next === v.confirm, { message: "Passwords don't match", path: ['confirm'] })
const mpinForm = setMpinBody
  .extend({ confirm: z.string() })
  .refine((v) => v.mpin === v.confirm, { message: "MPINs don't match", path: ['confirm'] })

const Err = ({ e }: { e?: FieldError }) => (e ? <p className="text-xs text-destructive">{e.message}</p> : null)

export function ChangePasswordCard() {
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

export function ChangeMpinCard() {
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
