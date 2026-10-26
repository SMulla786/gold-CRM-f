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
import { useT } from '@/lib/i18n'
import { useStates, useDistricts } from '@/lib/queries'
import { PARTY_TYPES, partyBody, type PartyDto, type PartyRefDto, type PartyType } from '@/shared'

type PartyIn = z.input<typeof partyBody>
type PartyOut = z.output<typeof partyBody>

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
  const t = useT()
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
  // birthday/anniversary are z.coerce.date() in the contract → keep as local YYYY-MM-DD strings (like the other date forms), inject on submit.
  const [birthday, setBirthday] = useState('')
  const [anniversary, setAnniversary] = useState('')

  useEffect(() => {
    if (party) {
      reset({
        type: party.type, countryCode: party.countryCode, name: party.name, mobile: party.mobile,
        email: party.email ?? undefined, address: party.address ?? undefined, aadhaar: party.aadhaar ?? undefined,
        pan: party.pan ?? undefined, gstin: party.gstin ?? undefined, shopName: party.shopName ?? undefined,
        stateId: party.stateId ?? undefined, districtId: party.districtId ?? undefined, area: party.area ?? undefined,
        specialty: party.specialty ?? undefined, parentId: party.parent?.id,
        licenseNo: party.licenseNo ?? undefined, regNo: party.regNo ?? undefined, logoTitle: party.logoTitle ?? undefined,
        shopAddress: party.shopAddress ?? undefined, pinCode: party.pinCode ?? undefined,
      })
      setBirthday(party.birthday ?? '')
      setAnniversary(party.anniversary ?? '')
      if (party.parent) {
        setIsSub(true)
        setParent({ id: party.parent.id, name: party.parent.name, type: 'CUSTOMER', mobile: '', shopName: null })
      }
    }
  }, [party, reset])

  const onSubmit = handleSubmit(async (values) => {
    const body = { ...values, parentId: isSub ? parent?.id : undefined, birthday: birthday || undefined, anniversary: anniversary || undefined }
    const saved = party ? await update.mutateAsync({ id: party.id, body }) : await create.mutateAsync(body)
    reset()
    setIsSub(false)
    setParent(null)
    setBirthday('')
    setAnniversary('')
    onSaved?.(saved as PartyDto)
    onClose()
  })

  const busy = create.isPending || update.isPending

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{party ? t('party.edit_title', { name: party.name }) : t('party.new_title')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('party.type')}>
              <Select value={type} onValueChange={(v) => setValue('type', v as PartyType)}>
                <SelectTrigger aria-label="Party type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PARTY_TYPES.map((pt) => (
                    <SelectItem key={pt} value={pt}>
                      {t(`party.type.${pt}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={t('party.mobile')} error={errors.mobile?.message}>
              <Input {...register('mobile')} />
            </Field>
          </div>
          <Field label={t('party.full_name')} error={errors.name?.message}>
            <Input {...register('name')} />
          </Field>

          {type === 'CUSTOMER' && (
            <div className="space-y-2 rounded-md border p-3">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={isSub} onCheckedChange={(v) => setIsSub(Boolean(v))} />
                {t('party.sub_profile')}
              </label>
              {isSub && <PartyCombobox value={parent} onChange={setParent} type="CUSTOMER" placeholder={t('party.search_parent')} />}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label={t('party.email')} error={errors.email?.message}>
              <Input type="email" {...register('email')} />
            </Field>
            <Field label={t('party.aadhaar')} error={errors.aadhaar?.message}>
              <Input {...register('aadhaar')} />
            </Field>
            <Field label={t('party.pan')} error={errors.pan?.message}>
              <Input {...register('pan')} />
            </Field>
            <Field label={t('party.gstin')} error={errors.gstin?.message}>
              <Input {...register('gstin')} />
            </Field>
          </div>

          <Field label={t('party.address')}>
            <Input {...register('address')} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Birthday"><Input type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} /></Field>
            <Field label="Anniversary"><Input type="date" value={anniversary} onChange={(e) => setAnniversary(e.target.value)} /></Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label={t('party.state')}>
              <Select value={stateId ? String(stateId) : ''} onValueChange={(v) => { setValue('stateId', Number(v)); setValue('districtId', undefined) }}>
                <SelectTrigger aria-label="State">
                  <SelectValue placeholder={t('party.select_state')} />
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
            <Field label={t('party.district')}>
              <Select value={watch('districtId') ? String(watch('districtId')) : ''} onValueChange={(v) => setValue('districtId', Number(v))} disabled={!stateId}>
                <SelectTrigger aria-label="District">
                  <SelectValue placeholder={t('party.select_district')} />
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
            <Field label={t('party.specialty')}>
              <Input {...register('specialty')} />
            </Field>
          )}
          {(type === 'SUPPLIER' || type === 'WHOLESALER') && (
            <Field label={t('party.shop_name')}>
              <Input {...register('shopName')} />
            </Field>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="License no."><Input {...register('licenseNo')} /></Field>
            <Field label="Registration no."><Input {...register('regNo')} /></Field>
            <Field label="Logo title"><Input {...register('logoTitle')} /></Field>
            <Field label="Area"><Input {...register('area')} /></Field>
            <Field label="Pin code" error={errors.pinCode?.message}><Input {...register('pinCode')} /></Field>
          </div>
          <Field label="Shop address"><Input {...register('shopAddress')} /></Field>

          <p className="text-xs text-muted-foreground">{t('party.photo_note')}</p>

          <DialogFooter>
            <Button type="submit" disabled={busy}>
              {busy ? t('party.saving') : party ? t('party.save_changes') : t('party.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
