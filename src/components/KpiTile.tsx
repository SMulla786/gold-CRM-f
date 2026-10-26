import type { LucideIcon } from 'lucide-react'

import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

/** TASK-91 KPI tile: label + icon chip, then the value full width (gold chip = headline metric, slate = secondary). Put tiles in a `.stagger` grid. */
export function KpiTile({ label, value, sub, icon: Icon, tone = 'gold', size = 'lg', valueClassName }: {
  label: React.ReactNode
  value: React.ReactNode
  sub?: React.ReactNode
  icon: LucideIcon
  tone?: 'gold' | 'slate'
  size?: 'lg' | 'sm'
  valueClassName?: string
}) {
  const lg = size === 'lg'
  return (
    <Card className={cn('hover:-translate-y-1', lg ? 'space-y-3 p-6' : 'space-y-2 rounded-2xl p-4')}>
      <div className="flex items-start justify-between gap-3">
        <div className="pt-1 text-sm font-semibold text-muted-foreground">{label}</div>
        {/* .icon-chip is unlayered CSS, so the small size needs `!` to beat it */}
        <span className={cn('shrink-0', tone === 'gold' ? 'icon-chip' : 'grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground', !lg && 'size-10! rounded-full!')}>
          <Icon className={lg ? 'size-5' : 'size-4'} aria-hidden />
        </span>
      </div>
      <div className={cn('font-extrabold tracking-tight tabular-nums break-words', lg ? 'text-3xl' : 'text-xl', valueClassName)}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground break-words">{sub}</div>}
    </Card>
  )
}
