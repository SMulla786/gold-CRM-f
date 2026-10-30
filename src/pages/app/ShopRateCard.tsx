import { useQueryClient } from '@tanstack/react-query'
import { ArrowDownRight, ArrowUpRight, Coins, Gem, Info, Pencil } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { MpinDialog } from '@/components/MpinDialog'
import { SectionCard } from '@/components/SectionCard'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useCurrentRates, useRateLimits, useSaveSetting, useSetRatesBatch } from '@/lib/appQueries'
import { useAuth } from '@/lib/auth'
import { useT } from '@/lib/i18n'
import { RATE_UNIT_GRAMS, setRatesBody, type CurrentRatesDto, type RateRowDto } from '@/shared'

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
// Website lists karats purest first (24K, 22K, 18K).
const byTouch = <R extends { touch: string }>(rows: R[]) => [...rows].sort((a, b) => Number(b.touch) - Number(a.touch))
const purest = <R extends { touch: string }>(rows: R[]) => rows.reduce<R | undefined>((a, b) => (!a || Number(b.touch) > Number(a.touch) ? b : a), undefined)

/** "Updated 5 min ago" from the newer of the two metals' updatedAt. */
function updatedAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
  if (mins < 1) return 'Updated just now'
  if (mins < 60) return `Updated ${mins} min ago`
  if (mins < 24 * 60) return `Updated ${Math.floor(mins / 60)} h ago`
  return `Updated on ${new Date(iso).toLocaleDateString('en-IN')}`
}

function EditRatesDialog({ onClose, showBuy, onShowBuy }: { onClose: () => void; showBuy: boolean; onShowBuy: (v: boolean) => void }) {
  const t = useT()
  const { data } = useCurrentRates()
  const { data: limits } = useRateLimits()
  const setRates = useSetRatesBatch()
  const [gold, setGold] = useState<EditRow[]>(() => (data?.gold.rows ?? []).map(toEdit))
  const [silver, setSilver] = useState<EditRow[]>(() => (data?.silver.rows ?? []).map(toEdit))
  const [auto, setAuto] = useState({ gold: true, silver: true })
  const setter = (metal: 'gold' | 'silver') => (metal === 'gold' ? setGold : setSilver)
  const set = (metal: 'gold' | 'silver', i: number, k: 'sell' | 'buy', v: string) =>
    setter(metal)((rs) => rs.map((r, j) => (j === i ? { ...r, [k]: v } : r)))

  // Same as Settings → Rates: every other karat = purest rate × touch / 100.
  const derive = (base: EditRow, r: EditRow, k: 'sell' | 'buy') => String(Math.round((Number(base[k]) * Number(r.touch)) / 100))
  const autoCalc = (metal: 'gold' | 'silver') =>
    setter(metal)((rs) => {
      const base = purest(rs)
      return base ? rs.map((r) => (r === base ? r : { ...r, sell: derive(base, r, 'sell'), buy: derive(base, r, 'buy') })) : rs
    })
  // Purest-rate edit; with auto-sync on, the other karats follow it.
  const setBase = (metal: 'gold' | 'silver', k: 'sell' | 'buy', v: string) =>
    setter(metal)((rs) => {
      const base = purest(rs)
      if (!base) return rs
      const next = { ...base, [k]: v }
      return rs.map((r) => (r === base ? next : auto[metal] ? { ...r, [k]: derive(next, r, k) } : r))
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
      if (bodies.length) await setRates.mutateAsync({ metals: bodies }) // one atomic save: both metals or neither
      onClose()
    } catch {
      /* the mutation already shows the error toast; keep the dialog open */
    }
  }

  const section = (metal: 'gold' | 'silver', rows: EditRow[]) => {
    const base = purest(rows)
    if (!base || !data) return null
    const isGold = metal === 'gold'
    const Icon = isGold ? Coins : Gem
    const lim = limits?.find((l) => l.metal === (isGold ? 'GOLD' : 'SILVER') && l.rateUnit === data[metal].rateUnit)
    const others = rows.map((r, i) => ({ r, i })).filter(({ r }) => r !== base)
    const fieldLabel = 'text-xs font-semibold uppercase tracking-wide text-muted-foreground'
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <span className={isGold ? 'icon-chip' : 'grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground'}><Icon className="size-5" aria-hidden /></span>
          <div>
            <div className="font-semibold">{t(isGold ? 'rates.gold_rate' : 'rates.silver_rate')}</div>
            <div className="text-xs text-muted-foreground">{t('rates.unit_label')}: {t(`rates.unit.${data[metal].rateUnit}`)}</div>
            {lim && <div className="text-xs text-muted-foreground">{t('rates.limits')}: {money(lim.minRate)} – {money(lim.maxRate)}</div>}
          </div>
        </div>
        <label className="block space-y-1.5">
          <span className={fieldLabel}>{t('rates.sell_rate_of', { k: base.title })}</span>
          <Input type="number" inputMode="decimal" aria-label={`${metal} ${base.title} sell`} value={base.sell} onChange={(e) => setBase(metal, 'sell', e.target.value)} />
        </label>
        <label className="block space-y-1.5">
          <span className={fieldLabel}>{t('rates.buy_rate_of', { k: base.title })}</span>
          <Input type="number" inputMode="decimal" aria-label={`${metal} ${base.title} buy`} value={base.buy} onChange={(e) => setBase(metal, 'buy', e.target.value)} />
        </label>
        {others.length > 0 && (
          <>
            <label className="flex items-center gap-2 text-sm font-medium">
              <Checkbox checked={auto[metal]} onCheckedChange={(c) => { setAuto((a) => ({ ...a, [metal]: c === true })); if (c === true) autoCalc(metal) }} />
              {t(isGold ? 'rates.auto_carats' : 'rates.auto_purities')}
            </label>
            <div className="overflow-hidden rounded-xl border">
              <div className="flex items-center justify-between border-b bg-muted/40 px-3 py-2 text-xs font-semibold uppercase tracking-wide">
                {t(isGold ? 'rates.other_carats' : 'rates.other_purities')}
                {auto[metal] && <span className="font-normal normal-case text-muted-foreground">{t('rates.auto_sync')}</span>}
              </div>
              <div className="grid grid-cols-[1fr_6.5rem_6.5rem] items-center gap-2 px-3 pt-2 text-xs font-semibold text-muted-foreground" aria-hidden>
                <span>{t(isGold ? 'rates.carat' : 'rates.purity')}</span><span>{t('rates.sell')} (₹)</span><span>{t('rates.buy')} (₹)</span>
              </div>
              {others.map(({ r, i }) => (
                <div key={r.karatCode} className="grid grid-cols-[1fr_6.5rem_6.5rem] items-center gap-2 px-3 py-2">
                  <span className="text-sm font-medium leading-tight">{r.title}<span className="block text-xs font-normal text-muted-foreground">{Number(r.touch)}%</span></span>
                  <Input type="number" inputMode="decimal" className="h-9" aria-label={`${metal} ${r.title} sell`} value={r.sell} onChange={(e) => set(metal, i, 'sell', e.target.value)} />
                  <Input type="number" inputMode="decimal" className="h-9" aria-label={`${metal} ${r.title} buy`} value={r.buy} onChange={(e) => set(metal, i, 'buy', e.target.value)} />
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t('rates.set_title')}</DialogTitle>
          <DialogDescription>{t('rates.edit_hint')}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 md:grid-cols-2">{section('gold', gold)}{section('silver', silver)}</div>
        <div className="space-y-2 border-t pt-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('rates.display_settings')}</div>
          <label className="flex items-center gap-2 text-sm font-medium">
            <Checkbox checked={showBuy} onCheckedChange={(c) => onShowBuy(c === true)} />
            {t('rates.show_buy')}
          </label>
        </div>
        <p className="flex items-start gap-2 rounded-xl bg-brand/10 px-3 py-2 text-sm"><Info className="mt-0.5 size-4 shrink-0" aria-hidden />{t('rates.save_note')}</p>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
          <Button disabled={setRates.isPending} onClick={save}>{setRates.isPending ? t('bill.saving') : t('rates.save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Sell-rate trend vs the previous save of that karat (RateRowDto.prevSellRate); nothing when unchanged or unknown. */
function RateTrend({ rate, prev, fmt }: { rate: string; prev?: string | null; fmt: (v: string) => string }) {
  if (prev == null || Number(prev) === Number(rate)) return null
  const up = Number(rate) > Number(prev)
  const Icon = up ? ArrowUpRight : ArrowDownRight
  const label = `${up ? 'Up' : 'Down'} from ₹${fmt(prev)}`
  return (
    <span role="img" aria-label={label} title={label} className={`ml-1 inline-flex align-[-2px] ${up ? 'text-green-600 dark:text-green-500' : 'text-destructive'}`}>
      <Icon className="size-3.5" aria-hidden />
    </span>
  )
}

export function ShopRateCard() {
  const t = useT()
  const { can } = useAuth()
  const { data } = useCurrentRates()
  const qc = useQueryClient()
  const saveSetting = useSaveSetting()
  const [edit, setEdit] = useState(false)
  const [unit, setUnit] = useState('DEFAULT')
  const [pendingShowBuy, setPendingShowBuy] = useState<boolean | null>(null) // toggle waiting for MPIN
  if (!data) return null
  const showBuy = data.display?.showBuy ?? true
  const saveShowBuy = async (mpin: string) => {
    await saveSetting.mutateAsync({ key: 'rates.display', value: { showBuy: pendingShowBuy }, mpin })
    await qc.invalidateQueries({ queryKey: ['rates-current'] })
  }

  const to = DISPLAY_UNITS.find((u) => u.key === unit)?.grams ?? null
  const show = (metal: 'gold' | 'silver', rate: string) =>
    to === null ? money(rate) : money((Number(rate) / RATE_UNIT_GRAMS[data[metal].rateUnit]) * to)
  // Website: clicking a rate opens "Set metal rates" (only for users who may edit them).
  const canEdit = can('settings.misc', 'edit')
  const opens: Opens = canEdit
    ? { role: 'button', tabIndex: 0, title: t('rates.set_title'), onClick: () => setEdit(true), onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setEdit(true) } } }
    : {}

  // One panel per metal (website layout): purest karat big SELL / BUY, the other karats as an "S … B …" line.
  const panel = (metal: 'gold' | 'silver') => {
    const all = data[metal].rows
    const base = purest(all)
    if (!base) return null
    const per = t(`rates.unit.${to === null ? data[metal].rateUnit : unit}`)
    return (
      <div {...opens} className={`space-y-3 rounded-2xl border p-4 ${canEdit ? 'cursor-pointer transition-colors hover:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring' : ''}`}>
        <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide">
          <span aria-hidden className={metal === 'gold' ? 'size-2.5 rounded-full bg-brand shadow-[0_0_8px_var(--color-brand)]' : 'size-2.5 rounded-full bg-slate-400'} />
          {t(metal === 'gold' ? 'class.GOLD' : 'class.SILVER')} {base.title}
        </div>
        <div className="flex flex-wrap justify-between gap-3">
          <div>
            <div className="text-xs text-muted-foreground">{t('rates.sell')} ({per})</div>
            <div className="text-2xl font-extrabold">₹{show(metal, base.sellRate)}<RateTrend rate={base.sellRate} prev={base.prevSellRate} fmt={(v) => show(metal, v)} /></div>
          </div>
          {showBuy && (
            <div className="text-right">
              <div className="text-xs text-muted-foreground">{t('rates.buy')} ({per})</div>
              <div className="text-2xl font-extrabold text-muted-foreground">₹{show(metal, base.buyRate)}</div>
            </div>
          )}
        </div>
        {all.length > 1 && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 border-t pt-3 text-sm">
            {byTouch(all.filter((r) => r !== base)).map((r) => (
              <span key={r.karatCode} className="whitespace-nowrap">
                <span className="font-semibold">{r.title}</span> S ₹{show(metal, r.sellRate)}<RateTrend rate={r.sellRate} prev={r.prevSellRate} fmt={(v) => show(metal, v)} />
                {showBuy && <span className="text-muted-foreground"> · B ₹{show(metal, r.buyRate)}</span>}
              </span>
            ))}
          </div>
        )}
      </div>
    )
  }

  const lastUpdated = [data.gold.updatedAt, data.silver.updatedAt].filter((d): d is string => !!d).sort().at(-1)

  const unitLabel = to === null
    ? t('rates.both_units', { gold: t(`rates.unit.${data.gold.rateUnit}`), silver: t(`rates.unit.${data.silver.rateUnit}`) })
    : t(`rates.unit.${unit}`)

  return (
    <>
      <RateTicker data={data} opens={opens} />
      <SectionCard
        title={<>{`${t('rates.today')} `}<span className="text-sm font-normal text-muted-foreground">({unitLabel})</span></>}
        actions={
          <>
            <Select value={unit} onValueChange={setUnit}>
              <SelectTrigger className="h-8 w-32 rounded-xl" aria-label="Rate unit"><SelectValue /></SelectTrigger>
              <SelectContent>{DISPLAY_UNITS.map((u) => <SelectItem key={u.key} value={u.key}>{t(`rates.unit.${u.key}`)}</SelectItem>)}</SelectContent>
            </Select>
            {canEdit && <Button size="sm" variant="outline" onClick={() => setEdit(true)}><Pencil aria-hidden />{t('rates.edit')}</Button>}
          </>
        }
      >
        <div className="grid gap-4 p-6 pb-2 md:grid-cols-2">{panel('gold')}{panel('silver')}</div>
        {lastUpdated && <p className="px-6 pb-4 pt-2 text-xs text-muted-foreground" title={new Date(lastUpdated).toLocaleString('en-IN')}>{updatedAgo(lastUpdated)}</p>}
        {edit && <EditRatesDialog showBuy={showBuy} onShowBuy={setPendingShowBuy} onClose={() => setEdit(false)} />}
        <MpinDialog open={pendingShowBuy != null} title={pendingShowBuy ? 'Show buy rates' : 'Hide buy rates'} onConfirm={saveShowBuy} onClose={() => setPendingShowBuy(null)} />
      </SectionCard>
    </>
  )
}

type Opens = React.HTMLAttributes<HTMLElement>

// Website's top rate strip, fed by the shop's own saved rates (no market feed, so no "LIVE" badge and INR only: no FX rates).
const TICKER_UNITS = ['GRAM_1', 'TROY_OZ', 'KG_1']

function RateTicker({ data, opens }: { data: CurrentRatesDto; opens: Opens }) {
  const t = useT()
  const [unit, setUnit] = useState('GRAM_1')
  const to = DISPLAY_UNITS.find((u) => u.key === unit)?.grams ?? 1
  const show = (metal: 'gold' | 'silver', rate: string) => money((Number(rate) / RATE_UNIT_GRAMS[data[metal].rateUnit]) * to)
  const lastUpdated = [data.gold.updatedAt, data.silver.updatedAt].filter((d): d is string => !!d).sort().at(-1)
  return (
    <Card className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl px-5 py-3 text-sm">
      {(['gold', 'silver'] as const).flatMap((metal) =>
        byTouch(data[metal].rows).map((r) => (
          <span key={`${metal}-${r.karatCode}`} {...opens} className={`inline-flex items-center gap-2 whitespace-nowrap rounded-lg ${opens.onClick ? 'cursor-pointer hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring' : ''}`}>
            <span aria-hidden className={metal === 'gold' ? 'size-2 rounded-full bg-brand' : 'size-2 rounded-full bg-slate-400'} />
            <span className="font-semibold uppercase">{t(metal === 'gold' ? 'class.GOLD' : 'class.SILVER')} {r.title}</span>
            <span className="font-bold">₹{show(metal, r.sellRate)}</span>
            {r.prevSellRate == null || Number(r.prevSellRate) === Number(r.sellRate)
              ? <span className="text-xs text-muted-foreground">{t('dash.rate_stable')}</span>
              : <RateTrend rate={r.sellRate} prev={r.prevSellRate} fmt={(v) => show(metal, v)} />}
          </span>
        )),
      )}
      {lastUpdated && <span className="text-xs text-muted-foreground" title={new Date(lastUpdated).toLocaleString('en-IN')}>{updatedAgo(lastUpdated)}</span>}
      <span className="ml-auto flex items-center gap-3 text-xs font-medium text-muted-foreground">
        <span>{t('dash.currency')} INR ₹</span>
        <Select value={unit} onValueChange={setUnit}>
          <SelectTrigger className="h-8 w-32 rounded-xl" aria-label="Ticker unit"><SelectValue /></SelectTrigger>
          <SelectContent>{TICKER_UNITS.map((u) => <SelectItem key={u} value={u}>{t(`rates.unit.${u}`)}</SelectItem>)}</SelectContent>
        </Select>
      </span>
    </Card>
  )
}
