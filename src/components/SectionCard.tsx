import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

/** TASK-91 section card: header band (title, optional subtitle, right-side actions) over flush content. */
export function SectionCard({ title, subtitle, actions, children, className, bodyClassName }: {
  title: React.ReactNode
  subtitle?: React.ReactNode
  actions?: React.ReactNode
  children: React.ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <Card className={cn('overflow-hidden', className)}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/40 px-6 py-4">
        <div className="min-w-0">
          <div className="text-lg font-bold leading-tight">{title}</div>
          {subtitle && <div className="mt-0.5 text-xs text-muted-foreground">{subtitle}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      <div className={bodyClassName}>{children}</div>
    </Card>
  )
}
