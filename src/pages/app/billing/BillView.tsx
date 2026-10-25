import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useSettings } from '@/lib/appQueries'
import { useBill } from '@/lib/billingQueries'
import { useAdminBusiness, useStates } from '@/lib/queries'
import { useAuth } from '@/lib/auth'
import { cn } from '@/lib/utils'
import { BillInvoice } from '@/pages/app/billing/BillInvoice'

export function BillView() {
  const { id } = useParams()
  const { me } = useAuth()
  const { data: bill, isLoading } = useBill(Number(id))
  const { data: settings } = useSettings()
  const { data: business } = useAdminBusiness() // owner/admin only; branch users fall back to the business name on `me`
  const { data: states } = useStates()
  const [override, setOverride] = useState<string | null>(null)

  if (isLoading || !bill) return <p className="text-sm text-muted-foreground">Loading…</p>

  const layout = override ?? settings?.['print.defaults'].layout ?? 'A4'
  const thermal = layout === 'THERMAL_80'
  const shopName = business?.name ?? me?.business?.name ?? 'Shop'
  const stateName = states?.find((s) => s.id === business?.stateId)?.name

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <Link to="/app/billing/list" className="text-sm text-primary hover:underline">← Bills</Link>
        {bill.status === 'DELETED' && <Badge variant="secondary">Deleted</Badge>}
        <div className="ml-auto flex items-center gap-2">
          <Select value={layout} onValueChange={setOverride}>
            <SelectTrigger className="w-40" aria-label="Print layout"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="A4">A4</SelectItem>
              <SelectItem value="A5">A5</SelectItem>
              <SelectItem value="THERMAL_80">Thermal 80 mm</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => window.print()}>Print</Button>
        </div>
      </div>

      <div className={cn('print-area rounded-md border p-6', thermal && 'print-thermal')}>
        <BillInvoice bill={bill} shopName={shopName} business={business} stateName={stateName} terms={settings?.['invoice.content'].terms} thermal={thermal} />
      </div>
    </div>
  )
}
