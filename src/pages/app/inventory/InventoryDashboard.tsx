import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useStockSummary } from '@/lib/inventoryQueries'

const CLASS_LABEL: Record<string, string> = { GOLD: 'Gold', SILVER: 'Silver', STONE: 'Stone', ARTIFICIAL: 'Artificial', FRANCHISE: 'Franchise' }
const inr = (s: string) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(s))

export function InventoryDashboard() {
  const { data, isLoading } = useStockSummary()
  if (isLoading || !data) return <p className="text-sm text-muted-foreground">Loading…</p>
  if (data.length === 0) return <p className="text-sm text-muted-foreground">No stock yet.</p>

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {data.map((s) => (
        <Card key={s.stockClass}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{CLASS_LABEL[s.stockClass] ?? s.stockClass}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div className="text-2xl font-semibold">{s.net} g <span className="text-sm font-normal text-muted-foreground">net</span></div>
            <div className="text-muted-foreground">Fine {s.fine} g · {s.pcs} pcs · {s.items} items</div>
            <div className="text-muted-foreground">Value {inr(s.value)}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
