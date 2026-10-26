import { Check, CheckCircle2, X } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useDraftDecision, useDrafts } from '@/lib/draftsQueries'
import { useT } from '@/lib/i18n'
import { DISCOUNT_UNITS, type SalesDraftDto } from '@/shared'

const inr = (s: string) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(s))
const dt = (s: string) => new Date(s).toLocaleString('en-IN')

function ApproveDialog({ draft, onClose }: { draft: SalesDraftDto; onClose: () => void }) {
  const t = useT()
  const decide = useDraftDecision()
  const [disc, setDisc] = useState(draft.requestedDiscount)
  const [unit, setUnit] = useState(draft.requestedDiscountUnit as string)
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{t('draft.approve_title', { no: draft.draftNo })}</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">{t('draft.requested_on', { disc: draft.requestedDiscountUnit === 'PERCENT' ? `${draft.requestedDiscount}%` : inr(draft.requestedDiscount), total: inr(draft.estTotal) })}</p>
        <div className="flex items-end gap-2">
          <div className="space-y-1.5"><Label htmlFor="ap-disc">{t('draft.approved_discount')}</Label><Input id="ap-disc" type="number" value={disc} onChange={(e) => setDisc(e.target.value)} /></div>
          <Select value={unit} onValueChange={setUnit}>
            <SelectTrigger className="w-20" aria-label="Discount unit"><SelectValue /></SelectTrigger>
            <SelectContent>{DISCOUNT_UNITS.map((u) => <SelectItem key={u} value={u}>{u === 'FIXED' ? '₹' : '%'}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button disabled={decide.isPending} onClick={async () => { await decide.mutateAsync({ id: draft.id, body: { decision: 'APPROVE', approvedDiscount: Number(disc) || 0, approvedDiscountUnit: unit } }); onClose() }}>{t('draft.approve')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function RejectDialog({ draft, onClose }: { draft: SalesDraftDto; onClose: () => void }) {
  const t = useT()
  const decide = useDraftDecision()
  const [reason, setReason] = useState('')
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{t('draft.reject_title', { no: draft.draftNo })}</DialogTitle></DialogHeader>
        <div className="space-y-1.5"><Label htmlFor="rj-reason">{t('draft.reason')}</Label><Input id="rj-reason" value={reason} onChange={(e) => setReason(e.target.value)} /></div>
        <DialogFooter>
          <Button variant="destructive" disabled={reason.trim().length < 2 || decide.isPending} onClick={async () => { await decide.mutateAsync({ id: draft.id, body: { decision: 'REJECT', rejectionReason: reason.trim() } }); onClose() }}>{t('draft.reject')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function DraftApprovals() {
  const t = useT()
  const { data, isLoading } = useDrafts({ status: 'PENDING', page: 1, pageSize: 50 })
  const [approving, setApproving] = useState<SalesDraftDto | null>(null)
  const [rejecting, setRejecting] = useState<SalesDraftDto | null>(null)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl">{t('draft.pending_title')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('draft.approvals_subtitle')}</p>
      </div>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
      ) : data?.items.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {data.items.map((d) => (
            <Card key={d.id} className="overflow-hidden">
              <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 border-b bg-muted/40 py-4">
                <CardTitle className="text-base font-bold">{t('draft.card_title', { no: d.draftNo, name: d.party?.name ?? d.customerName })}</CardTitle>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => setApproving(d)}><Check aria-hidden />{t('draft.approve')}</Button>
                  <Button size="sm" variant="outline" onClick={() => setRejecting(d)}><X aria-hidden />{t('draft.reject')}</Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-1.5 pt-4 text-sm text-muted-foreground">
                <div>{t('draft.card_meta', { when: dt(d.createdAt), by: d.salesman.name, n: d.items.length, total: inr(d.estTotal) })}</div>
                <div className="font-semibold text-foreground">{t('draft.requested_discount_x', { disc: d.requestedDiscountUnit === 'PERCENT' ? `${d.requestedDiscount}%` : inr(d.requestedDiscount) })}</div>
                {d.note && <div>{t('draft.note_x', { note: d.note })}</div>}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="flex items-center gap-4 border-dashed p-6 text-sm text-muted-foreground">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-muted"><CheckCircle2 className="size-5" aria-hidden /></span>
          {t('draft.no_pending')}
        </Card>
      )}

      {approving && <ApproveDialog draft={approving} onClose={() => setApproving(null)} />}
      {rejecting && <RejectDialog draft={rejecting} onClose={() => setRejecting(null)} />}
    </div>
  )
}
