import { useQuery } from '@tanstack/react-query'
import { History } from 'lucide-react'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { qs } from '@/lib/queries'
import type { ActivityDto, Paged } from '@/shared'

/** "Edit history" for one record: activity rows logged for entity + entityId (exactly as logActivity writes them, e.g. 'UdharTxn', 'GIRVI').
 *  GET /app/activity is gated on dashboard.home view, so the button only shows for users who can read it. */
export function EditHistoryButton({ entity, entityId, className }: { entity: string; entityId: number | string; className?: string }) {
  const { can } = useAuth()
  const [open, setOpen] = useState(false)
  const params = { entity, entityId: String(entityId), pageSize: 50 }
  const { data, isLoading, isError } = useQuery({
    queryKey: ['activity', params],
    queryFn: () => api.get<Paged<ActivityDto>>(`/app/activity${qs(params)}`),
    enabled: open,
  })
  if (!can('dashboard.home', 'view')) return null
  return (
    <>
      <Button type="button" size="sm" variant="outline" className={className} onClick={() => setOpen(true)}>
        <History aria-hidden />Edit history
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit history</DialogTitle>
            <DialogDescription>Every change recorded for this entry, newest first.</DialogDescription>
          </DialogHeader>
          {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {isError && <p className="text-sm text-destructive">Could not load the history.</p>}
          {data && data.items.length === 0 && <p className="text-sm text-muted-foreground">No changes recorded yet.</p>}
          {data && data.items.length > 0 && (
            <ol className="divide-y text-sm">
              {data.items.map((a) => (
                <li key={a.id} className="space-y-0.5 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{a.action}</Badge>
                    <span className="font-medium">{a.summary}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(a.createdAt).toLocaleString('en-IN')} · {a.user ?? '—'}{a.branch ? ` · ${a.branch.name}` : ''}
                  </div>
                </li>
              ))}
            </ol>
          )}
          {data && data.total > data.items.length && <p className="text-xs text-muted-foreground">Showing the latest {data.items.length} of {data.total}</p>}
        </DialogContent>
      </Dialog>
    </>
  )
}
