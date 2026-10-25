import { useState } from 'react'

import { PartyPicker } from '@/components/PartyPicker'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useCreateDraft } from '@/lib/draftsQueries'
import { DISCOUNT_UNITS, type PartyRefDto } from '@/shared'

/** Salesperson checks out selected stock → a showroom draft for a manager to approve the discount. */
export function CheckoutDraftDialog({ stockItemIds, onClose, onDone }: { stockItemIds: number[]; onClose: () => void; onDone: () => void }) {
  const create = useCreateDraft()
  const [party, setParty] = useState<PartyRefDto | null>(null)
  const [custName, setCustName] = useState('')
  const [custMobile, setCustMobile] = useState('')
  const [disc, setDisc] = useState('0')
  const [unit, setUnit] = useState('FIXED')
  const [note, setNote] = useState('')
  const ok = !!party || !!custName.trim()

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Checkout {stockItemIds.length} item{stockItemIds.length === 1 ? '' : 's'}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Customer</Label>
            <PartyPicker value={party} onChange={setParty} ariaLabel="Customer" placeholder="Search name / mobile" />
            {!party && (
              <div className="flex gap-2 pt-1">
                <Input placeholder="Walk-in name" aria-label="Walk-in name" value={custName} onChange={(e) => setCustName(e.target.value)} />
                <Input placeholder="Mobile" aria-label="Walk-in mobile" value={custMobile} onChange={(e) => setCustMobile(e.target.value)} />
              </div>
            )}
          </div>
          <div className="flex items-end gap-2">
            <div className="space-y-1.5"><Label htmlFor="cd-disc">Requested discount</Label><Input id="cd-disc" type="number" value={disc} onChange={(e) => setDisc(e.target.value)} /></div>
            <Select value={unit} onValueChange={setUnit}>
              <SelectTrigger className="w-20" aria-label="Discount unit"><SelectValue /></SelectTrigger>
              <SelectContent>{DISCOUNT_UNITS.map((u) => <SelectItem key={u} value={u}>{u === 'FIXED' ? '₹' : '%'}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label htmlFor="cd-note">Internal note</Label><Input id="cd-note" value={note} onChange={(e) => setNote(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button
            disabled={!ok || create.isPending}
            onClick={async () => {
              await create.mutateAsync({
                stockItemIds, partyId: party?.id, customerName: party ? undefined : custName.trim() || undefined, mobile: party ? undefined : custMobile || undefined,
                requestedDiscount: Number(disc) || 0, requestedDiscountUnit: unit, note: note || undefined,
              })
              onDone()
            }}
          >
            Send for approval
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
