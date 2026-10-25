import { Link } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useShortage, useStockSummary } from '@/lib/inventoryQueries'
import { useAuth } from '@/lib/auth'

const CLASS_LABEL: Record<string, string> = { GOLD: 'Gold', SILVER: 'Silver', STONE: 'Stone', ARTIFICIAL: 'Artificial', FRANCHISE: 'Franchise' }
const inr = (s: string) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(s))

export function InventoryDashboard() {
  const { can } = useAuth()
  const canStock = can('inventory.all_stock', 'view')
  const { data, isLoading } = useStockSummary()
  const { data: shortage } = useShortage({})
  const shortageCount = (shortage ?? []).filter((r) => r.status === 'SHORTAGE').length

  if (isLoading || !data) return <p className="text-sm text-muted-foreground">Loading…</p>
  if (data.length === 0) return <p className="text-sm text-muted-foreground">No stock yet.</p>

  return (
    <div className="space-y-4">
      {canStock && shortageCount > 0 && (
        <Link to="/app/inventory/shortage" className="inline-flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm hover:bg-destructive/10">
          <Badge variant="destructive">{shortageCount}</Badge>
          <span>group{shortageCount > 1 ? 's' : ''} below minimum — view shortage</span>
        </Link>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data.map((s) => {
          const card = (
            <Card className={canStock ? 'h-full transition-colors hover:border-primary' : 'h-full'}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{CLASS_LABEL[s.stockClass] ?? s.stockClass}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <div className="text-2xl font-semibold">{s.net} g <span className="text-sm font-normal text-muted-foreground">net</span></div>
                <div className="text-muted-foreground">Fine {s.fine} g · {s.pcs} pcs · {s.items} items</div>
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
    </div>
  )
}
