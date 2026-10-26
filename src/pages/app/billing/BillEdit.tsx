import { useParams } from 'react-router-dom'

import { useBill } from '@/lib/billingQueries'
import { useT } from '@/lib/i18n'
import { BillForm } from '@/pages/app/billing/BillForm'

export function BillEdit() {
  const t = useT()
  const { id } = useParams()
  const { data: bill, isLoading } = useBill(Number(id))
  if (isLoading || !bill) return <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
  return <BillForm kind={bill.kind} editBill={bill} />
}
