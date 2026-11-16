import { useState } from 'react'

import { MpinDialog } from '@/components/MpinDialog'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useSaveSetting, useSettings } from '@/lib/appQueries'
import { useT } from '@/lib/i18n'
import type { RoundMode } from '@/shared'

import { DEFAULT_EXCHANGE, type ExchangeDefaults } from './exchangeCalc'

const MODES: RoundMode[] = ['NONE', 'NEAREST', 'UP', 'DOWN']

/** G5 exchange.defaults: money round-off of the final amount (never weight / fine) and the base of the difference %. MPIN to save. */
export function ExchangeDefaultsDialog({ onClose }: { onClose: () => void }) {
  const t = useT()
  const { data: settings } = useSettings()
  const save = useSaveSetting()
  const [v, setV] = useState<ExchangeDefaults>(() => settings?.['exchange.defaults'] ?? DEFAULT_EXCHANGE)
  const [mpin, setMpin] = useState(false)
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('trade.ex.settings')}</DialogTitle>
          <DialogDescription>{t('trade.ex.settings_hint')}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>{t('trade.ex.round_off')}</Label>
            <Select value={v.roundOff} onValueChange={(x) => setV((s) => ({ ...s, roundOff: x as RoundMode }))}>
              <SelectTrigger aria-label="Round-off"><SelectValue /></SelectTrigger>
              <SelectContent>{MODES.map((m) => <SelectItem key={m} value={m}>{t(`trade.ex.round_${m}`)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="exd-step">{t('trade.ex.round_step')}</Label>
            <Input id="exd-step" type="number" min="0.01" step="0.01" disabled={v.roundOff === 'NONE'} value={v.roundStep} onChange={(e) => setV((s) => ({ ...s, roundStep: Number(e.target.value) || 0 }))} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>{t('trade.ex.diff_by')}</Label>
            <Select value={v.diffBy} onValueChange={(x) => setV((s) => ({ ...s, diffBy: x as ExchangeDefaults['diffBy'] }))}>
              <SelectTrigger aria-label="Difference base"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="FINE">{t('trade.ex.base_fine')}</SelectItem>
                <SelectItem value="WEIGHT">{t('trade.ex.base_weight')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
          <Button disabled={save.isPending || !(v.roundStep > 0)} onClick={() => setMpin(true)}>{t('common.save')}</Button>
        </DialogFooter>
        <MpinDialog open={mpin} title={t('trade.ex.settings')} onConfirm={async (pin) => { await save.mutateAsync({ key: 'exchange.defaults', value: v, mpin: pin }); setMpin(false); onClose() }} onClose={() => setMpin(false)} />
      </DialogContent>
    </Dialog>
  )
}
