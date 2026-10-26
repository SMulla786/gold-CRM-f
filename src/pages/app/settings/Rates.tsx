import { CalendarClock, Coins, History, Layers, ShieldCheck, type LucideIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { MpinDialog } from '@/components/MpinDialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useCurrentRates, useRateHistory, useRateLimits, useSaveRateLimits, useSetRates } from '@/lib/appQueries'
import { useAuth } from '@/lib/auth'
import { rateLimitsBody, setRatesBody, type Metal, type RateRowDto, type RateUnitKey } from '@/shared'

type MpinAction = { title: string; run: (mpin: string) => Promise<unknown> }
type EditRow = { karatCode: string; title: string; touch: string; sell: string; buy: string }
const toEdit = (r: RateRowDto): EditRow => ({ karatCode: r.karatCode, title: r.title, touch: r.touch, sell: r.sellRate, buy: r.buyRate })
const inr = (s: string) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(s))
// Purest row (highest touch) of a metal's current rates, for the summary tiles.
const purest = (rows: RateRowDto[]) => rows.reduce<RateRowDto | undefined>((a, b) => (!a || Number(b.touch) > Number(a.touch) ? b : a), undefined)

export function Rates() {
  const { data } = useCurrentRates()
  const [mpinAction, setMpinAction] = useState<MpinAction | null>(null)

  // Summary numbers derived from the current rates already fetched (no extra requests).
  const goldTop = data ? purest(data.gold.rows) : undefined
  const silverTop = data ? purest(data.silver.rows) : undefined
  const karatCount = data ? data.gold.rows.length + data.silver.rows.length : 0
  const lastUpdated = data ? [data.gold.updatedAt, data.silver.updatedAt].filter((d): d is string => !!d).sort().at(-1) : undefined
  const unitText = (u: RateUnitKey) => u.replace('_', ' ').toLowerCase()

  const tile = (label: string, value: string, sub: string | undefined, Icon: LucideIcon) => (
    <Card className="gap-2 hover:-translate-y-1">
      <CardHeader className="flex flex-row items-center justify-between pb-1">
        <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</CardTitle>
        <span className="icon-chip"><Icon className="size-5" aria-hidden /></span>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-extrabold tracking-tight tabular-nums">{value}</div>
        {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-8">
      <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tile('Gold sell', goldTop ? inr(goldTop.sellRate) : '—', data && goldTop ? `${goldTop.title} · buy ${inr(goldTop.buyRate)} · ${unitText(data.gold.rateUnit)}` : undefined, Coins)}
        {tile('Silver sell', silverTop ? inr(silverTop.sellRate) : '—', data && silverTop ? `${silverTop.title} · buy ${inr(silverTop.buyRate)} · ${unitText(data.silver.rateUnit)}` : undefined, Coins)}
        {tile('Karats tracked', data ? String(karatCount) : '—', data ? `${data.gold.rows.length} gold · ${data.silver.rows.length} silver` : undefined, Layers)}
        {tile('Last updated', lastUpdated ? new Date(lastUpdated).toLocaleDateString('en-IN') : '—', data ? 'Most recent change to either metal' : undefined, CalendarClock)}
      </div>

      {data ? (
        <>
          <MetalRates metal="GOLD" unit={data.gold.rateUnit} rows={data.gold.rows} updatedAt={data.gold.updatedAt} ask={setMpinAction} />
          <MetalRates metal="SILVER" unit={data.silver.rateUnit} rows={data.silver.rows} updatedAt={data.silver.updatedAt} ask={setMpinAction} />
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Loading…</p>
      )}
      <LimitsCard ask={setMpinAction} />
      <HistoryCard />
      <MpinDialog open={!!mpinAction} title={mpinAction?.title} onConfirm={(m) => mpinAction!.run(m)} onClose={() => setMpinAction(null)} />
    </div>
  )
}

function MetalRates({ metal, unit, rows, updatedAt, ask }: { metal: Metal; unit: RateUnitKey; rows: RateRowDto[]; updatedAt: string | null; ask: (a: MpinAction) => void }) {
  const { can } = useAuth()
  const canEdit = can('settings.misc', 'edit')
  const setRates = useSetRates()
  const [edit, setEdit] = useState<EditRow[]>(rows.map(toEdit))
  const [override, setOverride] = useState(false)
  useEffect(() => setEdit(rows.map(toEdit)), [rows])

  const set = (i: number, k: 'sell' | 'buy', val: string) => setEdit((e) => e.map((r, j) => (j === i ? { ...r, [k]: val } : r)))

  // Auto-calc every karat from the purest row (touch 100): rate * touch/100.
  const autoCalc = () => {
    const base = edit.reduce((a, b) => (Number(b.touch) > Number(a.touch) ? b : a), edit[0])
    if (!base) return
    setEdit((e) => e.map((r) => ({ ...r, sell: String(Math.round((Number(base.sell) * Number(r.touch)) / 100)), buy: String(Math.round((Number(base.buy) * Number(r.touch)) / 100)) })))
  }

  const save = () => {
    // shared zod coerces + rejects blanks (decimalInput: blank -> NaN -> error, not 0)
    const parsed = setRatesBody.safeParse({ metal, rateUnit: unit, overrideLimits: override, rates: edit.map((r) => ({ karatCode: r.karatCode, sellRate: r.sell, buyRate: r.buy })) })
    if (!parsed.success) return toast.error(parsed.error.issues[0]?.message ?? 'Enter valid rates')
    const body = parsed.data as Record<string, unknown>
    if (override) ask({ title: 'Override rate limits', run: (mpin) => setRates.mutateAsync({ body, mpin }) })
    else setRates.mutate({ body })
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <CardTitle>
          {metal === 'GOLD' ? 'Gold' : 'Silver'} rates <span className="text-sm font-normal text-muted-foreground">({unit.replace('_', ' ').toLowerCase()}{updatedAt ? ` · updated ${new Date(updatedAt).toLocaleDateString('en-IN')}` : ''})</span>
        </CardTitle>
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={autoCalc}>
              Auto-calc from {metal === 'GOLD' ? '24K' : '999'}
            </Button>
            <Button size="sm" onClick={save} disabled={setRates.isPending}>
              Save
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Karat</TableHead>
              <TableHead>Touch</TableHead>
              <TableHead>Sell</TableHead>
              <TableHead>Buy</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {edit.map((r, i) => (
              <TableRow key={r.karatCode}>
                <TableCell className="font-medium">{r.title}</TableCell>
                <TableCell className="tabular-nums text-muted-foreground">{r.touch}%</TableCell>
                <TableCell>
                  <Input className="w-32" type="number" aria-label={`${r.title} sell rate`} disabled={!canEdit} value={r.sell} onChange={(e) => set(i, 'sell', e.target.value)} />
                </TableCell>
                <TableCell>
                  <Input className="w-32" type="number" aria-label={`${r.title} buy rate`} disabled={!canEdit} value={r.buy} onChange={(e) => set(i, 'buy', e.target.value)} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {canEdit && (
          <label className="flex items-center gap-2 pt-1 text-sm">
            <Checkbox checked={override} onCheckedChange={(v) => setOverride(Boolean(v))} />
            Override rate limits (needs MPIN)
          </label>
        )}
      </CardContent>
    </Card>
  )
}

function LimitsCard({ ask }: { ask: (a: MpinAction) => void }) {
  const { can } = useAuth()
  const canEdit = can('settings.misc', 'edit')
  const { data } = useRateLimits()
  const save = useSaveRateLimits()
  const [rows, setRows] = useState<{ metal: Metal; rateUnit: RateUnitKey; min: string; max: string }[]>([])
  useEffect(() => { if (data) setRows(data.map((l) => ({ metal: l.metal, rateUnit: l.rateUnit, min: l.minRate, max: l.maxRate }))) }, [data])

  const set = (i: number, k: 'min' | 'max', v: string) => setRows((r) => r.map((row, j) => (j === i ? { ...row, [k]: v } : row)))
  const onSave = () => {
    // rateLimitsBody enforces max > min and rejects blanks via shared zod
    const parsed = rateLimitsBody.safeParse({ limits: rows.map((r) => ({ metal: r.metal, rateUnit: r.rateUnit, minRate: r.min, maxRate: r.max })) })
    if (!parsed.success) return toast.error(parsed.error.issues[0]?.message ?? 'Enter valid limits')
    ask({ title: 'Save rate limits', run: (mpin) => save.mutateAsync({ limits: parsed.data.limits, mpin }) })
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <CardTitle>Rate limits (min / max guard)</CardTitle>
        {canEdit && (
          <Button size="sm" onClick={onSave} disabled={!rows.length || save.isPending}>
            Save limits
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.map((r, i) => (
          <div key={`${r.metal}-${r.rateUnit}`} className="flex flex-wrap items-center gap-3 rounded-2xl border bg-muted/40 p-3 text-sm">
            <span className="w-40 font-medium">{r.metal} · {r.rateUnit.replace('_', ' ').toLowerCase()}</span>
            <Label className="text-xs">Min</Label>
            <Input className="w-32" type="number" aria-label={`${r.metal} ${r.rateUnit} min`} disabled={!canEdit} value={r.min} onChange={(e) => set(i, 'min', e.target.value)} />
            <Label className="text-xs">Max</Label>
            <Input className="w-32" type="number" aria-label={`${r.metal} ${r.rateUnit} max`} disabled={!canEdit} value={r.max} onChange={(e) => set(i, 'max', e.target.value)} />
          </div>
        ))}
        {!rows.length && (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <span className="icon-chip"><ShieldCheck className="size-5" aria-hidden /></span>
            <p className="text-sm text-muted-foreground">No limits configured</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function HistoryCard() {
  const { data } = useRateHistory({ page: 1 })
  return (
    <Card>
      <CardHeader>
        <CardTitle>Rate history</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Metal</TableHead>
              <TableHead>Karat</TableHead>
              <TableHead>Sell</TableHead>
              <TableHead>Buy</TableHead>
              <TableHead>By</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.items.length ? (
              data.items.map((h) => (
                <TableRow key={h.id}>
                  <TableCell>{new Date(h.effectiveAt).toLocaleString('en-IN')}</TableCell>
                  <TableCell>{h.metal}</TableCell>
                  <TableCell>{h.karatCode}</TableCell>
                  <TableCell className="tabular-nums">{h.sellRate}</TableCell>
                  <TableCell className="tabular-nums">{h.buyRate}</TableCell>
                  <TableCell>{h.createdBy ?? '—'}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="h-28 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <span className="icon-chip"><History className="size-5" aria-hidden /></span>
                    <p className="text-sm text-muted-foreground">No history</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
