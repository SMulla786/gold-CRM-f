import { Coins, Gem, Medal, Package, Sparkles, Store, type LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useShortage, useStockSummary } from '@/lib/inventoryQueries'
import { useAuth } from '@/lib/auth'
import { plural } from '@/lib/plural'

const CLASS_LABEL: Record<string, string> = { GOLD: 'Gold', SILVER: 'Silver', STONE: 'Stone', ARTIFICIAL: 'Artificial', FRANCHISE: 'Franchise' }
const CLASS_ICON: Record<string, LucideIcon> = { GOLD: Coins, SILVER: Medal, STONE: Gem, ARTIFICIAL: Sparkles, FRANCHISE: Store }
const inr = (s: string) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(s))

export function InventoryDashboard() {
  const { can } = useAuth()
  const canStock = can('inventory.all_stock', 'view')
  const { data, isLoading } = useStockSummary()
  const { data: shortage } = useShortage({})
  const shortageCount = (shortage ?? []).filter((r) => r.status === 'SHORTAGE').length

  if (isLoading || !data) return <p className="text-sm text-muted-foreground">Loading…</p>
  if (data.length === 0)
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <span className="icon-chip"><Package className="size-5" aria-hidden /></span>
        <p className="text-sm text-muted-foreground">No stock yet.</p>
      </div>
    )

  // Headline numbers derived from the summary already fetched (no extra requests).
  const goldFine = Number(data.find((s) => s.stockClass === 'GOLD')?.fine ?? 0)
  const silverFine = Number(data.find((s) => s.stockClass === 'SILVER')?.fine ?? 0)
  const totalValue = data.reduce((sum, s) => sum + Number(s.value), 0)
  const totalItems = data.reduce((sum, s) => sum + s.items, 0)
  const totalPcs = data.reduce((sum, s) => sum + s.pcs, 0)
  const fineTotal = goldFine + silverFine || 1

  return (
    <div className="space-y-8">
      {canStock && shortageCount > 0 && (
        <Link to="/app/inventory/shortage" className="inline-flex items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm hover:bg-destructive/10">
          <Badge variant="destructive">{shortageCount}</Badge>
          <span>group{shortageCount > 1 ? 's' : ''} below minimum — view shortage</span>
        </Link>
      )}

      <div className="hero-card space-y-6 p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-xl">Stock on hand</h2>
          <p className="text-sm text-white/70">{plural(totalItems, 'item')} · {plural(totalPcs, 'pc')} across all classes</p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {[
            { label: 'Gold fine', g: goldFine, bar: 'from-brand-strong to-brand' },
            { label: 'Silver fine', g: silverFine, bar: 'from-white/60 to-white/30' },
          ].map((m) => (
            <div key={m.label} className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-white/60">{m.label}</p>
              <p className="text-3xl font-extrabold tabular-nums">{m.g.toFixed(3)} <span className="text-base font-medium text-white/60">g</span></p>
              <div className="h-3 rounded-full bg-white/10 shadow-[inset_0_2px_4px_rgb(0_0_0/0.3)]">
                <div className={`bar-grow h-3 rounded-full bg-gradient-to-r ${m.bar} shadow-[0_0_10px_rgb(212_175_55/0.5)]`} style={{ width: `${Math.max(4, (m.g / fineTotal) * 100)}%` }} />
              </div>
            </div>
          ))}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-white/60">Total value at cost</p>
            <p className="text-3xl font-extrabold tabular-nums">{inr(String(totalValue))}</p>
            <p className="text-xs text-white/60">Sum of known purchase costs</p>
          </div>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-xl">By stock class</h2>
        <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((s) => {
            const Icon = CLASS_ICON[s.stockClass] ?? Package
            const card = (
              <Card className={canStock ? 'h-full gap-2 hover:-translate-y-1 hover:border-primary' : 'h-full gap-2'}>
                <CardHeader className="flex flex-row items-center justify-between pb-1">
                  <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{CLASS_LABEL[s.stockClass] ?? s.stockClass}</CardTitle>
                  <span className="icon-chip"><Icon className="size-5" aria-hidden /></span>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                  <div className="text-3xl font-extrabold tracking-tight tabular-nums">{s.net} g <span className="text-sm font-normal text-muted-foreground">net</span></div>
                  <div className="text-muted-foreground">Fine {s.fine} g · {plural(s.pcs, 'pc')} · {plural(s.items, 'item')}</div>
                  <div className="text-muted-foreground">Value {inr(s.value)}</div>
                </CardContent>
              </Card>
            )
            return canStock ? (
              <Link key={s.stockClass} to={`/app/inventory/stock?class=${s.stockClass}`}>{card}</Link>
            ) : (
              <div key={s.stockClass}>{card}</div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
