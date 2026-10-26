import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAdminSubscription } from '@/lib/queries'
import { MODULES } from '@/shared'

const date = (s: string) => new Date(s).toLocaleDateString('en-IN')
const labelOf = (key: string) => MODULES.find((m) => m.key === key)?.label ?? key

function Usage({ label, used, max }: { label: string; used: number; max: number }) {
  const pct = Math.min(100, Math.round((used / max) * 100))
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span>
          {used} / {max}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-secondary">
        <div className={`h-full ${pct >= 100 ? 'bg-destructive' : 'bg-primary'}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export function SubscriptionView() {
  const { data, isLoading } = useAdminSubscription()
  if (isLoading || !data) return <p className="text-sm text-muted-foreground">Loading…</p>

  return (
    <div className="max-w-2xl space-y-8">
      <div className="flex items-center gap-3">
        <div>
          <h1>Subscription</h1>
          <p className="mt-1 text-sm text-muted-foreground">Your plan, limits and usage.</p>
        </div>
        {data.readOnly && <Badge variant="destructive">Read-only</Badge>}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{data.planName}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground">
            {date(data.startsAt)} → {date(data.endsAt)}
          </div>
          <Usage label="Branches" used={data.usedBranches} max={data.maxBranches} />
          <Usage label="Users" used={data.usedUsers} max={data.maxUsers} />
          <div>
            <div className="mb-2 text-sm font-medium">Enabled modules</div>
            <div className="flex flex-wrap gap-2">
              {data.modules.map((m) => (
                <Badge key={m} variant="secondary">
                  {labelOf(m)}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
