import { Pencil } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { SectionCard } from '@/components/SectionCard'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useCurrentRates, useSetRates } from '@/lib/appQueries'
import { useAuth } from '@/lib/auth'
import { useT } from '@/lib/i18n'
import { RATE_UNIT_GRAMS, setRatesBody, type RateRowDto } from '@/shared'

// Unit labels are i18n keys: `rates.unit.<RateUnitKey | display key>` (e.g. rates.unit.TOLA = 'per tola').
const money = (s: string | number) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Number(s))

// Display-only unit switch (TASK-82). 'DEFAULT' keeps each metal's stored shop unit; the rest
// re-express the stored rate by grams. Troy ounce isn't a stored RateUnitKey — display math only.
const DISPLAY_UNITS: { key: string; grams: number | null }[] = [
  { key: 'DEFAULT', grams: null },
  { key: 'GRAM_1', grams: 1 },
  { key: 'GRAM_10', grams: 10 },
  { key: 'TOLA', grams: RATE_UNIT_GRAMS.TOLA },
  { key: 'TROY_OZ', grams: 31.1035 },
  { key: 'KG_1', grams: 1000 },
]

interface EditRow { karatCode: string; title: string; touch: string; sell: string; buy: string }
const toEdit = (r: RateRowDto): EditRow => ({ karatCode: r.karatCode, title: r.title, touch: r.touch, sell: r.sellRate, buy: r.buyRate })
// Purest row (highest touch: 24K / 999) — the base for auto-calc and the one rate that must be set.
const purest = (rows: EditRow[]) => rows.reduce<EditRow | undefined>((a, b) => (!a || Number(b.touch) > Number(a.touch) ? b : a), undefined)

/** "Updated 5 min ago" from the newer of the two metals' updatedAt. */
function updatedAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
  if (mins < 1) return 'Updated just now'
  if (mins < 60) return `Updated ${mins} min ago`
  if (mins < 24 * 60) return `Updated ${Math.floor(mins / 60)} h ago`
  return `Updated on ${new Date(iso).toLocaleDateString('en-IN')}`
}

function EditRatesDialog({ onClose }: { onClose: () => void }) {
  const t = useT()
  const { data } = useCurrentRates()
  const setRates = useSetRates()
  const [gold, setGold] = useState<EditRow[]>(() => (data?.gold.rows ?? []).map(toEdit))
  const [silver, setSilver] = useState<EditRow[]>(() => (data?.silver.rows ?? []).map(toEdit))
  const set = (metal: 'gold' | 'silver', i: number, k: 'sell' | 'buy', v: string) =>
    (metal === 'gold' ? setGold : setSilver)((rs) => rs.map((r, j) => (j === i ? { ...r, [k]: v } : r)))

  // Same as Settings → Rates: every karat = purest rate × touch / 100.
  const autoCalc = (metal: 'gold' | 'silver') =>
    (metal === 'gold' ? setGold : setSilver)((rs) => {
      const base = purest(rs)
      if (!base) return rs
      return rs.map((r) => ({ ...r, sell: String(Math.round((Number(base.sell) * Number(r.touch)) / 100)), buy: String(Math.round((Number(base.buy) * Number(r.touch)) / 100)) }))
    })

  const save = async () => {
    if (!data) return
    const bodies: Record<string, unknown>[] = []
    for (const [metal, rows] of [['gold', gold], ['silver', silver]] as const) {
      if (!rows.length) continue
      const base = purest(rows)
      if (!base || !(Number(base.sell) > 0)) return toast.error(`Enter the ${metal === 'gold' ? 'gold' : 'silver'} ${base?.title ?? ''} sell rate (must be more than 0)`)
      // shared zod coerces + rejects blanks (blank -> error, not a silent 0)
      const parsed = setRatesBody.safeParse({ metal: metal === 'gold' ? 'GOLD' : 'SILVER', rateUnit: data[metal].rateUnit, rates: rows.map((r) => ({ karatCode: r.karatCode, sellRate: r.sell, buyRate: r.buy })) })
      if (!parsed.success) return toast.error(parsed.error.issues[0]?.message ?? 'Enter valid rates')
      bodies.push(parsed.data as Record<string, unknown>)
    }
    try {
      for (const body of bodies) await setRates.mutateAsync({ body })
      onClose()
    } catch {
      /* the mutation already shows the error toast; keep the dialog open */
    }
  }

  const section = (metal: 'gold' | 'silver', rows: EditRow[]) => (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-semibold capitalize">
        <span aria-hidden className={metal === 'gold' ? 'size-2 rounded-full bg-brand' : 'size-2 rounded-full bg-slate-400'} />
        {t(metal === 'gold' ? 'class.GOLD' : 'class.SILVER')} ({data ? t(`rates.unit.${data[metal].rateUnit}`) : ''})
      </div>
      {rows.length > 1 && (
        <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => autoCalc(metal)}>
          Auto-calculate from {purest(rows)?.title ?? (metal === 'gold' ? '24K' : '999')}
        </Button>
      )}
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground" aria-hidden>
        <span className="w-16" />
        <span className="w-28">{t('rates.sell')}</span>
        <span className="w-28">{t('rates.buy')}</span>
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
        <DialogHeader><DialogTitle>{t('rates.edit')}</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground">{t('rates.edit_hint')}</p>
        <div className="grid gap-4 sm:grid-cols-2">{section('gold', gold)}{section('silver', silver)}</div>
        <DialogFooter>
          <Button disabled={setRates.isPending} onClick={save}>{setRates.isPending ? t('bill.saving') : t('rates.save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function ShopRateCard() {
  const t = useT()
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
            {t(metal === 'gold' ? 'class.GOLD' : 'class.SILVER')} {r.title}
          </span>
        </TableCell>
        <TableCell className="text-right font-bold">₹{show(metal, r.sellRate)}</TableCell>
        <TableCell className="text-right text-muted-foreground">₹{show(metal, r.buyRate)}</TableCell>
      </TableRow>
    ))

  const lastUpdated = [data.gold.updatedAt, data.silver.updatedAt].filter((d): d is string => !!d).sort().at(-1)

  const unitLabel = to === null
    ? t('rates.both_units', { gold: t(`rates.unit.${data.gold.rateUnit}`), silver: t(`rates.unit.${data.silver.rateUnit}`) })
    : t(`rates.unit.${unit}`)

  return (
    <SectionCard
      title={<>{`${t('rates.today')} `}<span className="text-sm font-normal text-muted-foreground">({unitLabel})</span></>}
      actions={
        <>
          <Select value={unit} onValueChange={setUnit}>
            <SelectTrigger className="h-8 w-32 rounded-xl" aria-label="Rate unit"><SelectValue /></SelectTrigger>
            <SelectContent>{DISPLAY_UNITS.map((u) => <SelectItem key={u.key} value={u.key}>{t(`rates.unit.${u.key}`)}</SelectItem>)}</SelectContent>
          </Select>
          {can('settings.misc', 'edit') && <Button size="sm" variant="outline" onClick={() => setEdit(true)}><Pencil aria-hidden />{t('rates.edit')}</Button>}
        </>
      }
    >
      <Table>
        <TableHeader><TableRow><TableHead>{t('udhari.metal')}</TableHead><TableHead className="text-right">{t('rates.sell')}</TableHead><TableHead className="text-right">{t('rates.buy')}</TableHead></TableRow></TableHeader>
        <TableBody>{rows('gold')}{rows('silver')}</TableBody>
      </Table>
      {lastUpdated && <p className="px-6 pb-4 pt-2 text-xs text-muted-foreground" title={new Date(lastUpdated).toLocaleString('en-IN')}>{updatedAgo(lastUpdated)}</p>}
      {edit && <EditRatesDialog onClose={() => setEdit(false)} />}
    </SectionCard>
  )
}
