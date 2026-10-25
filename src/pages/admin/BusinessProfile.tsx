import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAdminBusiness, useStates, useUpdateAdminBusiness } from '@/lib/queries'
import { updateBusinessBody } from '@/shared'

type ProfileForm = z.input<typeof updateBusinessBody>

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
    <div className="max-w-xl space-y-4">
      <h1 className="text-2xl font-semibold">Business Settings</h1>
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
    </div>
  )
}
