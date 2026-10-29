import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useT } from '@/lib/i18n'

import { blankStone, type StoneRow } from './billFormParts'

/** INV-12: a purchase line's stone elements (saved on the created stock item). Descriptive only — the line's Stone charge stays the money. */
export function StonesDialog({ stones, onSave, onClose }: { stones: StoneRow[]; onSave: (s: StoneRow[]) => void; onClose: () => void }) {
  const t = useT()
  const [rows, setRows] = useState<StoneRow[]>(stones.length ? stones : [blankStone()])
  const set = (i: number, patch: Partial<StoneRow>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  const total = rows.reduce((a, r) => a + (Number(r.amount) || 0), 0)

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader><DialogTitle>{t('bill.stones')}</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground">{t('bill.stones_hint')}</p>
        <div className="space-y-2">
          {rows.map((r, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <Input className="w-36" maxLength={60} placeholder={t('bill.stone_name')} aria-label="Stone name" value={r.name} onChange={(e) => set(i, { name: e.target.value })} />
              <Input className="w-16" type="number" min={0} placeholder={t('stock.col_pcs')} aria-label="Stone pcs" value={r.pcs} onChange={(e) => set(i, { pcs: e.target.value })} />
              <Input className="w-20" type="number" min={0} step="0.001" placeholder={t('bill.stone_weight')} aria-label="Stone weight" value={r.weight} onChange={(e) => set(i, { weight: e.target.value })} />
              <Select value={r.unit} onValueChange={(v) => set(i, { unit: v as StoneRow['unit'] })}>
                <SelectTrigger className="w-20" aria-label="Stone unit"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="CT">ct</SelectItem><SelectItem value="GM">g</SelectItem></SelectContent>
              </Select>
              <Input className="w-24" type="number" min={0} placeholder={t('udhari.rate')} aria-label="Stone rate" value={r.rate} onChange={(e) => set(i, { rate: e.target.value })} />
              <Input className="w-24" type="number" min={0} placeholder={t('bill.amount')} aria-label="Stone amount" value={r.amount} onChange={(e) => set(i, { amount: e.target.value })} />
              <Button type="button" variant="ghost" size="sm" aria-label="Remove stone" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}>✕</Button>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between text-sm">
          <Button type="button" variant="outline" size="sm" disabled={rows.length >= 20} onClick={() => setRows((rs) => [...rs, blankStone()])}>{t('common.add')}</Button>
          <span className="tabular-nums text-muted-foreground">{t('bill.amount')}: {total.toFixed(2)}</span>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="button" onClick={() => onSave(rows.filter((r) => r.name.trim()))}>{t('common.save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
