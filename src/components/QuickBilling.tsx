import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

/** Top-bar shortcut → pick a bill kind/mode and deep-link to the billing screen. */
export function QuickBilling() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const go = (to: string) => { setOpen(false); navigate(to) }
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>Quick Billing</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New bill</DialogTitle></DialogHeader>
          <div className="grid gap-2">
            <Button variant="outline" onClick={() => go('/app/billing')}>Sell Bill — GST</Button>
            <Button variant="outline" onClick={() => go('/app/billing?type=ROUGH')}>Sell Bill — Rough</Button>
            <Button variant="outline" onClick={() => go('/app/billing/purchase')}>Purchase Bill</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
