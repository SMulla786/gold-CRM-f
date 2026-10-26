import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

/** Edge padding so a flush table lines up with the card's rounded corners (same as DataTable). */
export const TABLE_EDGES = '[&_td:first-child]:pl-6 [&_td:last-child]:pr-6 [&_th:first-child]:pl-6 [&_th:last-child]:pr-6'

/** TASK-91 bare table card: a Card wrapping a flush <Table>. */
export function TableCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return <Card className={cn('overflow-hidden', TABLE_EDGES, className)}>{children}</Card>
}

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
      <div className={cn(TABLE_EDGES, bodyClassName)}>{children}</div>
    </Card>
  )
}
