import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { usePlatformDashboard } from '@/lib/queries'

const inr = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

function Tile({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{value}</div>
        {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  )
}

export function PlatformDashboard() {
  const { data, isLoading } = usePlatformDashboard()
  if (isLoading || !data) return <p className="text-sm text-muted-foreground">Loading…</p>
  const b = data.businesses

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Platform Dashboard</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Businesses" value={b.total} sub={`${b.active} active · ${b.suspended} suspended`} />
        <Tile label="Expiring ≤15 days" value={b.expiringIn15Days} sub={`${b.expired} expired`} />
        <Tile label="Pending sign-ups" value={data.pendingSignups} />
        <Tile label="Revenue this month" value={inr(data.revenue.thisMonth)} sub={`${inr(data.revenue.thisYear)} this year`} />
        <Tile label="Total branches" value={data.branches} />
        <Tile label="Total users" value={data.users} />
      </div>
    </div>
  )
}
