import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useAuth } from '@/lib/auth'
import { useT } from '@/lib/i18n'

/** Top-bar shortcut → pick a bill kind/mode and deep-link to the billing screen (BillForm reads ?type=ROUGH for either kind). */
export function QuickBilling() {
  const t = useT()
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const { can } = useAuth()
  const go = (to: string) => { setOpen(false); navigate(to) }
  const sell = can('billing.sell_bill', 'view')
  const purchase = can('billing.purchase_bill', 'view')
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>{t('comp.quick_billing')}</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('comp.new_bill')}</DialogTitle></DialogHeader>
          <div className="grid gap-2">
            {sell && <Button variant="outline" onClick={() => go('/app/billing')}>{t('comp.sell_gst')}</Button>}
            {sell && <Button variant="outline" onClick={() => go('/app/billing?type=ROUGH')}>{t('comp.sell_rough')}</Button>}
            {purchase && <Button variant="outline" onClick={() => go('/app/billing/purchase')}>{t('billing.tab_purchase')}</Button>}
            {purchase && <Button variant="outline" onClick={() => go('/app/billing/purchase?type=ROUGH')}>{t('comp.purchase_rough')}</Button>}
            {can('billing.just_bill', 'view') && <Button variant="outline" onClick={() => go('/app/billing/just')}>{t('billing.tab_just')}</Button>}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
