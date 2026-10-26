import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useAuth } from '@/lib/auth'

/** Top-bar shortcut → pick a bill kind/mode and deep-link to the billing screen (BillForm reads ?type=ROUGH for either kind). */
export function QuickBilling() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const { can } = useAuth()
  const go = (to: string) => { setOpen(false); navigate(to) }
  const sell = can('billing.sell_bill', 'view')
  const purchase = can('billing.purchase_bill', 'view')
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>Quick Billing</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New bill</DialogTitle></DialogHeader>
          <div className="grid gap-2">
            {sell && <Button variant="outline" onClick={() => go('/app/billing')}>Sell Bill — GST</Button>}
            {sell && <Button variant="outline" onClick={() => go('/app/billing?type=ROUGH')}>Sell Bill — Rough</Button>}
            {purchase && <Button variant="outline" onClick={() => go('/app/billing/purchase')}>Purchase Bill</Button>}
            {purchase && <Button variant="outline" onClick={() => go('/app/billing/purchase?type=ROUGH')}>Purchase Bill — Rough</Button>}
            {can('billing.just_bill', 'view') && <Button variant="outline" onClick={() => go('/app/billing/just')}>Just Bill</Button>}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
