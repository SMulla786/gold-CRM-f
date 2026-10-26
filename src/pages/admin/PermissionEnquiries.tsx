import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useApproveEnquiry, useEnquiries, useRejectEnquiry } from '@/lib/queries'
import { ENQUIRY_STATUS, type PermissionEnquiryDto } from '@/shared'

const date = (s: string) => new Date(s).toLocaleDateString('en-IN')
const acts = (e: PermissionEnquiryDto) => [e.view && 'View', e.edit && 'Edit', e.delete && 'Delete'].filter(Boolean).join(' · ') || '—'
const statusVariant = (s: string) => (s === 'APPROVED' ? 'default' : s === 'REJECTED' ? 'destructive' : 'secondary')

function RejectDialog({ enquiry, onClose }: { enquiry: PermissionEnquiryDto; onClose: () => void }) {
  const reject = useRejectEnquiry()
  const [note, setNote] = useState('')
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Reject {enquiry.user.name}'s request</DialogTitle></DialogHeader>
        <Input placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} aria-label="Rejection note" />
        <DialogFooter>
          <Button variant="destructive" disabled={reject.isPending} onClick={async () => { await reject.mutateAsync({ id: enquiry.id, note: note.trim() || undefined }); onClose() }}>Reject</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function PermissionEnquiries() {
  const [status, setStatus] = useState('PENDING')
  const [page, setPage] = useState(1)
  const { data, isLoading } = useEnquiries({ page, status: status || undefined })
  const approve = useApproveEnquiry()
  const [rejecting, setRejecting] = useState<PermissionEnquiryDto | null>(null)

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1>Permission requests</h1>
          <p className="mt-1 text-sm text-muted-foreground">Access requests from staff, waiting for your decision.</p>
        </div>
        <Select value={status || 'all'} onValueChange={(v) => { setStatus(v === 'all' ? '' : v); setPage(1) }}>
          <SelectTrigger className="w-40" aria-label="Status"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {ENQUIRY_STATUS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow><TableHead>Staff</TableHead><TableHead>Page</TableHead><TableHead>Requested</TableHead><TableHead>Reason</TableHead><TableHead>Status</TableHead><TableHead>Date</TableHead><TableHead /></TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={7} className="h-16 text-center text-muted-foreground">Loading…</TableCell></TableRow>
              : data?.items.length ? data.items.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{e.user.name}</TableCell>
                  <TableCell>{e.permissionLabel}</TableCell>
                  <TableCell>{acts(e)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{e.reason ?? '—'}</TableCell>
                  <TableCell><Badge variant={statusVariant(e.status)}>{e.status}</Badge></TableCell>
                  <TableCell>{date(e.createdAt)}</TableCell>
                  <TableCell>
                    {e.status === 'PENDING' ? (
                      <div className="flex gap-2">
                        <Button size="sm" disabled={approve.isPending} onClick={() => approve.mutate(e.id)}>Approve</Button>
                        <Button size="sm" variant="ghost" onClick={() => setRejecting(e)}>Reject</Button>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">{e.decidedBy ?? ''}{e.decisionNote ? ` — ${e.decisionNote}` : ''}</span>
                    )}
                  </TableCell>
                </TableRow>
              )) : <TableRow><TableCell colSpan={7} className="h-16 text-center text-muted-foreground">No requests.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>

      {data && data.total > data.pageSize && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <span>Page {data.page}</span>
          <Button variant="outline" size="sm" disabled={page * data.pageSize >= data.total} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      )}

      {rejecting && <RejectDialog enquiry={rejecting} onClose={() => setRejecting(null)} />}
    </div>
  )
}
