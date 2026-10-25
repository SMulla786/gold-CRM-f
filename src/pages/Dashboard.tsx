import { Boxes, Building2, GitBranch, ShieldCheck, type LucideIcon } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { useAuth } from '@/lib/auth'

function InfoCard({ icon: Icon, label, value, foot }: { icon: LucideIcon; label: string; value: string; foot?: string }) {
  return (
    <Card className="relative overflow-hidden">
      <span aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand/70 to-transparent" />
      <CardContent className="flex items-start gap-3 p-5">
        <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand ring-1 ring-brand/20">
          <Icon className="size-5" />
        </span>
        <div className="min-w-0">
          <div className="text-sm text-muted-foreground">{label}</div>
          <div className="truncate text-lg font-semibold">{value}</div>
          {foot && <div className="text-xs text-muted-foreground">{foot}</div>}
        </div>
      </CardContent>
    </Card>
  )
}

// Landing for the admin console: the resolved auth context, shown as an overview.
export function Dashboard({ title }: { title: string }) {
  const { me, activeBranch } = useAuth()
  if (!me) return null
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="text-sm text-muted-foreground">
          Signed in as {me.name}{me.isOwner ? ' · Owner' : ''}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <InfoCard icon={ShieldCheck} label="Access level" value={me.level} foot={me.isOwner ? 'Business owner' : undefined} />
        <InfoCard icon={Building2} label="Business" value={me.business?.name ?? '— (platform)'} foot={me.subscription?.planName ? `${me.subscription.planName} plan` : undefined} />
        <InfoCard icon={Boxes} label="Modules enabled" value={String(me.modules.length)} foot="in this plan" />
        <InfoCard icon={GitBranch} label="Active branch" value={activeBranch} foot={me.branch?.name ? `Home: ${me.branch.name}` : undefined} />
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 p-5">
          <span className="mr-1 text-sm text-muted-foreground">Accessible branches</span>
          {me.accessibleBranches.length ? (
            me.accessibleBranches.map((b) => <Badge key={b.id} variant="secondary">{b.name}</Badge>)
          ) : (
            <span className="text-sm">—</span>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
