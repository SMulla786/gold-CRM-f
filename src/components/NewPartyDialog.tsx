import { zodResolver } from '@hookform/resolvers/zod'
import { cloneElement, isValidElement, useEffect, useId, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { PartyCombobox } from '@/components/PartyCombobox'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useCreateParty, useUpdateParty } from '@/lib/appQueries'
import { useStates, useDistricts } from '@/lib/queries'
import { PARTY_TYPES, partyBody, type PartyDto, type PartyRefDto, type PartyType } from '@/shared'

type PartyIn = z.input<typeof partyBody>
type PartyOut = z.output<typeof partyBody>

const TYPE_LABEL: Record<PartyType, string> = { CUSTOMER: 'Customer', SUPPLIER: 'Supplier', KARIGAR: 'Karigar', WHOLESALER: 'Wholesaler' }

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

interface Props {
  open: boolean
  onClose: () => void
  defaultType?: PartyType
  /** Seed a new party's name/mobile (e.g. billing a walk-in showroom draft). */
  defaultName?: string
  defaultMobile?: string
  /** When set, edit this party instead of creating. */
  party?: PartyDto
  /** Called with the saved party (for pickers that want to auto-select it). */
  onSaved?: (p: PartyDto) => void
}

export function NewPartyDialog({ open, onClose, defaultType = 'CUSTOMER', defaultName, defaultMobile, party, onSaved }: Props) {
  const create = useCreateParty()
  const update = useUpdateParty()
  const { data: states } = useStates()

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<PartyIn, unknown, PartyOut>({
    resolver: zodResolver(partyBody),
    defaultValues: { type: defaultType, countryCode: '+91', name: defaultName, mobile: defaultMobile },
  })

  const type = watch('type') as PartyType
  const stateId = watch('stateId')
  const { data: districts } = useDistricts(stateId ? Number(stateId) : undefined)

  const [isSub, setIsSub] = useState(false)
  const [parent, setParent] = useState<PartyRefDto | null>(null)

  useEffect(() => {
    if (party) {
      reset({
        type: party.type, countryCode: party.countryCode, name: party.name, mobile: party.mobile,
        email: party.email ?? undefined, address: party.address ?? undefined, aadhaar: party.aadhaar ?? undefined,
        pan: party.pan ?? undefined, gstin: party.gstin ?? undefined, shopName: party.shopName ?? undefined,
        stateId: party.stateId ?? undefined, districtId: party.districtId ?? undefined, area: party.area ?? undefined,
        specialty: party.specialty ?? undefined, parentId: party.parent?.id,
      })
      if (party.parent) {
        setIsSub(true)
        setParent({ id: party.parent.id, name: party.parent.name, type: 'CUSTOMER', mobile: '', shopName: null })
      }
    }
  }, [party, reset])

  const onSubmit = handleSubmit(async (values) => {
    const body = { ...values, parentId: isSub ? parent?.id : undefined }
    const saved = party ? await update.mutateAsync({ id: party.id, body }) : await create.mutateAsync(body)
    reset()
    setIsSub(false)
    setParent(null)
    onSaved?.(saved as PartyDto)
    onClose()
  })

  const busy = create.isPending || update.isPending

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{party ? `Edit ${party.name}` : 'New party'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">
              <Select value={type} onValueChange={(v) => setValue('type', v as PartyType)}>
                <SelectTrigger aria-label="Party type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PARTY_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {TYPE_LABEL[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Mobile" error={errors.mobile?.message}>
              <Input {...register('mobile')} />
            </Field>
          </div>
          <Field label="Full name" error={errors.name?.message}>
            <Input {...register('name')} />
          </Field>

          {type === 'CUSTOMER' && (
            <div className="space-y-2 rounded-md border p-3">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={isSub} onCheckedChange={(v) => setIsSub(Boolean(v))} />
                Add as family sub-profile (under a parent customer)
              </label>
              {isSub && <PartyCombobox value={parent} onChange={setParent} type="CUSTOMER" placeholder="Search parent customer…" />}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Email" error={errors.email?.message}>
              <Input type="email" {...register('email')} />
            </Field>
            <Field label="Aadhaar" error={errors.aadhaar?.message}>
              <Input {...register('aadhaar')} />
            </Field>
            <Field label="PAN" error={errors.pan?.message}>
              <Input {...register('pan')} />
            </Field>
            <Field label="GSTIN" error={errors.gstin?.message}>
              <Input {...register('gstin')} />
            </Field>
          </div>

          <Field label="Address">
            <Input {...register('address')} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="State">
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
            </Field>
            <Field label="District">
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
            </Field>
          </div>

          {type === 'KARIGAR' && (
            <Field label="Specialty">
              <Input {...register('specialty')} />
            </Field>
          )}
          {(type === 'SUPPLIER' || type === 'WHOLESALER') && (
            <Field label="Shop / business name">
              <Input {...register('shopName')} />
            </Field>
          )}

          <p className="text-xs text-muted-foreground">Photo / shop-logo upload available after saving (coming soon).</p>

          <DialogFooter>
            <Button type="submit" disabled={busy}>
              {busy ? 'Saving…' : party ? 'Save changes' : 'Create party'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
