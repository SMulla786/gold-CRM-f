import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useDraftDecision, useDrafts } from '@/lib/draftsQueries'
import { DISCOUNT_UNITS, type SalesDraftDto } from '@/shared'

const inr = (s: string) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(s))
const dt = (s: string) => new Date(s).toLocaleString('en-IN')

function ApproveDialog({ draft, onClose }: { draft: SalesDraftDto; onClose: () => void }) {
  const decide = useDraftDecision()
  const [disc, setDisc] = useState(draft.requestedDiscount)
  const [unit, setUnit] = useState(draft.requestedDiscountUnit as string)
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Approve draft #{draft.draftNo}</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">Requested {draft.requestedDiscountUnit === 'PERCENT' ? `${draft.requestedDiscount}%` : inr(draft.requestedDiscount)} on est. {inr(draft.estTotal)}.</p>
        <div className="flex items-end gap-2">
          <div className="space-y-1.5"><Label htmlFor="ap-disc">Approved discount</Label><Input id="ap-disc" type="number" value={disc} onChange={(e) => setDisc(e.target.value)} /></div>
          <Select value={unit} onValueChange={setUnit}>
            <SelectTrigger className="w-20" aria-label="Discount unit"><SelectValue /></SelectTrigger>
            <SelectContent>{DISCOUNT_UNITS.map((u) => <SelectItem key={u} value={u}>{u === 'FIXED' ? '₹' : '%'}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button disabled={decide.isPending} onClick={async () => { await decide.mutateAsync({ id: draft.id, body: { decision: 'APPROVE', approvedDiscount: Number(disc) || 0, approvedDiscountUnit: unit } }); onClose() }}>Approve</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function RejectDialog({ draft, onClose }: { draft: SalesDraftDto; onClose: () => void }) {
  const decide = useDraftDecision()
  const [reason, setReason] = useState('')
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Reject draft #{draft.draftNo}</DialogTitle></DialogHeader>
        <div className="space-y-1.5"><Label htmlFor="rj-reason">Reason</Label><Input id="rj-reason" value={reason} onChange={(e) => setReason(e.target.value)} /></div>
        <DialogFooter>
          <Button variant="destructive" disabled={reason.trim().length < 2 || decide.isPending} onClick={async () => { await decide.mutateAsync({ id: draft.id, body: { decision: 'REJECT', rejectionReason: reason.trim() } }); onClose() }}>Reject</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function DraftApprovals() {
  const { data, isLoading } = useDrafts({ status: 'PENDING', page: 1, pageSize: 50 })
  const [approving, setApproving] = useState<SalesDraftDto | null>(null)
  const [rejecting, setRejecting] = useState<SalesDraftDto | null>(null)

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-medium text-muted-foreground">Pending discount requests</h2>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : data?.items.length ? (
        <div className="grid gap-3">
          {data.items.map((d) => (
            <Card key={d.id}>
              <CardHeader className="flex-row items-start justify-between gap-3 pb-2">
                <CardTitle className="text-sm">Draft #{d.draftNo} · {d.party?.name ?? d.customerName}</CardTitle>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => setApproving(d)}>Approve</Button>
                  <Button size="sm" variant="outline" onClick={() => setRejecting(d)}>Reject</Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-1 text-sm text-muted-foreground">
                <div>{dt(d.createdAt)} · by {d.salesman.name} · {d.items.length} items · est. {inr(d.estTotal)}</div>
                <div>Requested discount: {d.requestedDiscountUnit === 'PERCENT' ? `${d.requestedDiscount}%` : inr(d.requestedDiscount)}</div>
                {d.note && <div>Note: {d.note}</div>}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No pending approvals.</p>
      )}

      {approving && <ApproveDialog draft={approving} onClose={() => setApproving(null)} />}
      {rejecting && <RejectDialog draft={rejecting} onClose={() => setRejecting(null)} />}
    </div>
  )
}
