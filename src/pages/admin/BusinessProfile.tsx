import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { ChangeMpinCard, ChangePasswordCard } from '@/components/SecurityCards'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAdminBusiness, useDistricts, useStates, useUpdateAdminBusiness } from '@/lib/queries'
import { updateBusinessBody } from '@/shared'

type ProfileForm = z.input<typeof updateBusinessBody>

export function BusinessProfile() {
  const { data, isLoading } = useAdminBusiness()
  const { data: states } = useStates()
  const update = useUpdateAdminBusiness()
  const { register, handleSubmit, reset, watch, setValue, formState } = useForm<ProfileForm>({ resolver: zodResolver(updateBusinessBody) })
  const stateId = watch('stateId')
  const { data: districts } = useDistricts(stateId ? Number(stateId) : undefined)

  useEffect(() => {
    if (data)
      reset({
        name: data.name,
        mobile: data.mobile,
        alternateMobile: data.alternateMobile,
        email: data.email ?? undefined,
        gstin: data.gstin ?? undefined,
        address: data.address ?? undefined,
        stateId: data.stateId ?? undefined,
        districtId: data.districtId ?? undefined,
      })
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
                <Label htmlFor="p-alt-mobile">Alternate No</Label>
                {/* blank -> null so saving clears it */}
                <Input id="p-alt-mobile" inputMode="numeric" maxLength={10} {...register('alternateMobile', { setValueAs: (v) => (v?.trim() ? v.trim() : null) })} />
                {formState.errors.alternateMobile && <p className="text-xs text-destructive">{formState.errors.alternateMobile.message}</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>State</Label>
                <Select value={stateId ? String(stateId) : ''} onValueChange={(v) => { setValue('stateId', Number(v)); setValue('districtId', undefined) }}>
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
              <div className="space-y-1.5">
                <Label>District</Label>
                <Select value={watch('districtId') ? String(watch('districtId')) : ''} onValueChange={(v) => setValue('districtId', Number(v))} disabled={!stateId}>
                  <SelectTrigger aria-label="District">
                    <SelectValue placeholder="Select district" />
                  </SelectTrigger>
                  <SelectContent>
                    {districts?.map((d) => (
                      <SelectItem key={d.id} value={String(d.id)}>
                        {d.name}
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
