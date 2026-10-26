import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { MpinDialog } from '@/components/MpinDialog'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useReplaceGirviItem } from '@/lib/girviQueries'
import { useT } from '@/lib/i18n'
import { girviItemReplaceBody, type GirviItemDto } from '@/shared'

type Form = z.input<typeof girviItemReplaceBody>
type Out = z.output<typeof girviItemReplaceBody>

/** Replace / revalue a PLEDGED item (PATCH /app/girvi/:id/items/:itemId, MPIN). Server rejects if the loan exceeds the new valuation. */
export function ItemReplaceDialog({ batchId, item, onClose }: { batchId: number; item: GirviItemDto; onClose: () => void }) {
  const t = useT()
  const replace = useReplaceGirviItem()
  const [pending, setPending] = useState<Out | null>(null)
  const { register, handleSubmit, formState } = useForm<Form, unknown, Out>({
    resolver: zodResolver(girviItemReplaceBody),
    defaultValues: { category: item.category, name: item.name, gross: Number(item.gross), net: Number(item.net), purity: Number(item.purity), rate: Number(item.rate), remark: '' },
  })
  const err = (k: keyof Form) => formState.errors[k] && <p className="text-xs text-destructive">{formState.errors[k]?.message}</p>
  const num = (k: 'gross' | 'net' | 'purity' | 'rate', label: string) => (
    <div className="space-y-1.5">
      <Label htmlFor={`rp-${k}`}>{label}</Label>
      <Input id={`rp-${k}`} type="number" step="any" inputMode="decimal" {...register(k)} />
      {err(k)}
    </div>
  )

  return (
    <>
      <Dialog open={!pending} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('girvi.replace_title', { name: item.name })}</DialogTitle>
            <DialogDescription>{t('girvi.replace_desc')}</DialogDescription>
          </DialogHeader>
          <form id="rp-form" onSubmit={handleSubmit((v) => setPending(v))} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="rp-category">{t('girvi.col_category')}</Label>
                <Input id="rp-category" {...register('category')} />
                {err('category')}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rp-name">{t('bill.item_name')}</Label>
                <Input id="rp-name" {...register('name')} />
                {err('name')}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {num('gross', t('girvi.gross_g'))}
              {num('net', t('girvi.net_g'))}
              {num('purity', t('girvi.purity_pct'))}
              {num('rate', t('girvi.rate_per_g_fine'))}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rp-remark">{t('draft.reason')}</Label>
              <Input id="rp-remark" placeholder={t('girvi.replace_placeholder')} {...register('remark')} />
              {err('remark')}
            </div>
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
            <Button type="submit" form="rp-form">{t('girvi.continue')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <MpinDialog
        open={!!pending}
        title={t('girvi.confirm_change', { name: item.name })}
        onConfirm={async (mpin) => {
          await replace.mutateAsync({ id: batchId, itemId: item.id, body: pending as Record<string, unknown>, mpin })
          onClose()
        }}
        onClose={() => setPending(null)}
      />
    </>
  )
}
