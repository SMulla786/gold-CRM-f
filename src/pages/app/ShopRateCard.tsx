import { Pencil } from 'lucide-react'
import { useState } from 'react'

import { SectionCard } from '@/components/SectionCard'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useCurrentRates, useSetRates } from '@/lib/appQueries'
import { useAuth } from '@/lib/auth'
import { RATE_UNIT_GRAMS, type RateRowDto, type RateUnitKey } from '@/shared'

const UNIT: Record<RateUnitKey, string> = { GRAM_1: 'per g', GRAM_10: 'per 10 g', TOLA: 'per tola', KG_1: 'per kg' }
const money = (s: string | number) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Number(s))

// Display-only unit switch (TASK-82). 'DEFAULT' keeps each metal's stored shop unit; the rest
// re-express the stored rate by grams. Troy ounce isn't a stored RateUnitKey — display math only.
const DISPLAY_UNITS: { key: string; label: string; grams: number | null }[] = [
  { key: 'DEFAULT', label: 'Shop units', grams: null },
  { key: 'GRAM_1', label: 'per g', grams: 1 },
  { key: 'GRAM_10', label: 'per 10 g', grams: 10 },
  { key: 'TOLA', label: 'per tola', grams: RATE_UNIT_GRAMS.TOLA },
  { key: 'TROY_OZ', label: 'per troy oz', grams: 31.1035 },
  { key: 'KG_1', label: 'per kg', grams: 1000 },
]

interface EditRow { karatCode: string; title: string; sell: string; buy: string }
const toEdit = (r: RateRowDto): EditRow => ({ karatCode: r.karatCode, title: r.title, sell: r.sellRate, buy: r.buyRate })

function EditRatesDialog({ onClose }: { onClose: () => void }) {
  const { data } = useCurrentRates()
  const setRates = useSetRates()
  const [gold, setGold] = useState<EditRow[]>(() => (data?.gold.rows ?? []).map(toEdit))
  const [silver, setSilver] = useState<EditRow[]>(() => (data?.silver.rows ?? []).map(toEdit))
  const set = (metal: 'gold' | 'silver', i: number, k: 'sell' | 'buy', v: string) =>
    (metal === 'gold' ? setGold : setSilver)((rs) => rs.map((r, j) => (j === i ? { ...r, [k]: v } : r)))

  const save = async () => {
    if (!data) return
    const body = (metal: 'GOLD' | 'SILVER', unit: RateUnitKey, rows: EditRow[]) => ({
      metal, rateUnit: unit, rates: rows.map((r) => ({ karatCode: r.karatCode, sellRate: Number(r.sell) || 0, buyRate: Number(r.buy) || 0 })),
    })
    await setRates.mutateAsync({ body: body('GOLD', data.gold.rateUnit, gold) })
    await setRates.mutateAsync({ body: body('SILVER', data.silver.rateUnit, silver) })
    onClose()
  }

  const section = (metal: 'gold' | 'silver', rows: EditRow[]) => (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-semibold capitalize">
        <span aria-hidden className={metal === 'gold' ? 'size-2 rounded-full bg-brand' : 'size-2 rounded-full bg-slate-400'} />
        {metal} ({data ? UNIT[data[metal].rateUnit] : ''})
      </div>
      {rows.map((r, i) => (
        <div key={r.karatCode} className="flex items-center gap-2">
          <span className="w-16 text-sm">{r.title}</span>
          <Input className="w-28" type="number" aria-label={`${metal} ${r.title} sell`} value={r.sell} onChange={(e) => set(metal, i, 'sell', e.target.value)} />
          <Input className="w-28" type="number" aria-label={`${metal} ${r.title} buy`} value={r.buy} onChange={(e) => set(metal, i, 'buy', e.target.value)} />
        </div>
      ))}
    </div>
  )

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Edit rates</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground">Sell · Buy. Rates outside the shop's limits are rejected — use Settings → Rates to override.</p>
        <div className="grid gap-4 sm:grid-cols-2">{section('gold', gold)}{section('silver', silver)}</div>
        <DialogFooter>
          <Button disabled={setRates.isPending} onClick={save}>{setRates.isPending ? 'Saving…' : 'Save rates'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function ShopRateCard() {
  const { can } = useAuth()
  const { data } = useCurrentRates()
  const [edit, setEdit] = useState(false)
  const [unit, setUnit] = useState('DEFAULT')
  if (!data) return null

  const to = DISPLAY_UNITS.find((u) => u.key === unit)?.grams ?? null
  const show = (metal: 'gold' | 'silver', rate: string) =>
    to === null ? money(rate) : money((Number(rate) / RATE_UNIT_GRAMS[data[metal].rateUnit]) * to)

  const rows = (metal: 'gold' | 'silver') =>
    data[metal].rows.map((r) => (
      <TableRow key={`${metal}-${r.karatCode}`}>
        <TableCell className="font-medium">
          <span className="inline-flex items-center gap-2.5">
            <span aria-hidden className={metal === 'gold' ? 'size-2.5 rounded-full bg-brand shadow-[0_0_8px_var(--color-brand)]' : 'size-2.5 rounded-full bg-slate-400'} />
            {metal === 'gold' ? 'Gold' : 'Silver'} {r.title}
          </span>
        </TableCell>
        <TableCell className="text-right font-bold">₹{show(metal, r.sellRate)}</TableCell>
        <TableCell className="text-right text-muted-foreground">₹{show(metal, r.buyRate)}</TableCell>
      </TableRow>
    ))

  const unitLabel = to === null ? `Gold ${UNIT[data.gold.rateUnit]} · Silver ${UNIT[data.silver.rateUnit]}` : DISPLAY_UNITS.find((u) => u.key === unit)!.label

  return (
    <SectionCard
      title={<>Today's rates <span className="text-sm font-normal text-muted-foreground">({unitLabel})</span></>}
      actions={
        <>
          <Select value={unit} onValueChange={setUnit}>
            <SelectTrigger className="h-8 w-32 rounded-xl" aria-label="Rate unit"><SelectValue /></SelectTrigger>
            <SelectContent>{DISPLAY_UNITS.map((u) => <SelectItem key={u.key} value={u.key}>{u.label}</SelectItem>)}</SelectContent>
          </Select>
          {can('settings.misc', 'edit') && <Button size="sm" variant="outline" onClick={() => setEdit(true)}><Pencil aria-hidden />Edit rates</Button>}
        </>
      }
    >
      <Table>
        <TableHeader><TableRow><TableHead>Metal</TableHead><TableHead className="text-right">Sell</TableHead><TableHead className="text-right">Buy</TableHead></TableRow></TableHeader>
        <TableBody>{rows('gold')}{rows('silver')}</TableBody>
      </Table>
      {edit && <EditRatesDialog onClose={() => setEdit(false)} />}
    </SectionCard>
  )
}
