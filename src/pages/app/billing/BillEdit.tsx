import { useParams } from 'react-router-dom'

import { useBill } from '@/lib/billingQueries'
import { BillForm } from '@/pages/app/billing/BillForm'

export function BillEdit() {
  const { id } = useParams()
  const { data: bill, isLoading } = useBill(Number(id))
  if (isLoading || !bill) return <p className="text-sm text-muted-foreground">Loading…</p>
  return <BillForm kind={bill.kind} editBill={bill} />
}
