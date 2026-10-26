import { useState } from 'react'

import { PartyPicker } from '@/components/PartyPicker'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useBankAccounts } from '@/lib/appQueries'
import { usePartyBalance } from '@/lib/billingQueries'
import { useCreateKarigarIssue } from '@/lib/ordersQueries'
import type { OrderItemDto, PartyRefDto } from '@/shared'

const n = (s: string) => Number(s) || 0

/** Issue PENDING order items to a karigar. Shared by Order Detail (ticked items) and the All Orders row action. */
export function IssueDialog({ items, onClose }: { items: OrderItemDto[]; onClose: () => void }) {
  const itemIds = items.map((it) => it.id)
  const issue = useCreateKarigarIssue()
  const { data: banks } = useBankAccounts()
  const [karigar, setKarigar] = useState<PartyRefDto | null>(null)
  const { data: karigarBal } = usePartyBalance(karigar?.id)
  const tot = (pick: (it: OrderItemDto) => string) => items.reduce((a, it) => a + n(pick(it)), 0).toFixed(3)
  const fineBy = (metal: 'GOLD' | 'SILVER') => items.filter((it) => it.metal === metal).reduce((a, it) => a + n(it.fine), 0)
  const [dueDate, setDueDate] = useState('')
  const [f, setF] = useState({ goldFine: '0', silverFine: '0', cash: '0', online: '0', bankAccountId: '', remark: '' })
  const set = (key: keyof typeof f, v: string) => setF((s) => ({ ...s, [key]: v }))
  const ok = !!karigar && (n(f.online) === 0 || f.bankAccountId)
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Issue {itemIds.length} item{itemIds.length === 1 ? '' : 's'} to karigar</DialogTitle></DialogHeader>
        <div className="grid gap-4">
          <div className="space-y-1.5"><Label>Karigar</Label><PartyPicker value={karigar} onChange={setKarigar} type="KARIGAR" ariaLabel="Karigar" placeholder="Search karigar" /></div>
          {karigar && (
            <p className="rounded-2xl bg-muted/50 px-3 py-2 text-xs text-muted-foreground tabular-nums">
              Existing udhar: {karigarBal ? `₹${karigarBal.amount} · ${karigarBal.gold}g gold · ${karigarBal.silver}g silver (+ = karigar owes the shop)` : '—'}
            </p>
          )}
          <div className="grid grid-cols-2 gap-2 rounded-2xl border bg-muted/40 p-3 text-xs tabular-nums sm:grid-cols-4">
            <div><div className="text-muted-foreground">Total gross</div><div className="font-semibold">{tot((it) => it.gross)} g</div></div>
            <div><div className="text-muted-foreground">Total less</div><div className="font-semibold">{tot((it) => it.less)} g</div></div>
            <div><div className="text-muted-foreground">Total net</div><div className="font-semibold">{tot((it) => it.net)} g</div></div>
            <div><div className="text-muted-foreground">Total fine</div><div className="font-semibold">{tot((it) => it.fine)} g</div></div>
            {fineBy('GOLD') > 0 && fineBy('SILVER') > 0 && <div className="col-span-full text-muted-foreground">Gold fine {fineBy('GOLD').toFixed(3)} g · Silver fine {fineBy('SILVER').toFixed(3)} g</div>}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="ki-due">Due date</Label><Input id="ki-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="ki-gold">Gold fine (g)</Label><Input id="ki-gold" type="number" step="0.001" value={f.goldFine} onChange={(e) => set('goldFine', e.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="ki-silver">Silver fine (g)</Label><Input id="ki-silver" type="number" step="0.001" value={f.silverFine} onChange={(e) => set('silverFine', e.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="ki-cash">Cash ₹</Label><Input id="ki-cash" type="number" value={f.cash} onChange={(e) => set('cash', e.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="ki-online">Online ₹</Label><Input id="ki-online" type="number" value={f.online} onChange={(e) => set('online', e.target.value)} /></div>
            {n(f.online) > 0 && (
              <div className="space-y-1.5"><Label>Bank</Label>
                <Select value={f.bankAccountId} onValueChange={(v) => set('bankAccountId', v)}>
                  <SelectTrigger aria-label="Bank account"><SelectValue placeholder="Bank" /></SelectTrigger>
                  <SelectContent>{banks?.map((b) => <SelectItem key={b.id} value={String(b.id)}>{b.bankName} · {b.accountNo}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div className="space-y-1.5"><Label htmlFor="ki-remark">Remark</Label><Input id="ki-remark" value={f.remark} onChange={(e) => set('remark', e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button disabled={!ok || issue.isPending} onClick={async () => {
            await issue.mutateAsync({ karigarId: karigar!.id, orderItemIds: itemIds, dueDate: dueDate || undefined, goldFine: n(f.goldFine), silverFine: n(f.silverFine), cash: n(f.cash), online: n(f.online), bankAccountId: n(f.online) > 0 ? Number(f.bankAccountId) : undefined, remark: f.remark || undefined })
            onClose()
          }}>Issue</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
