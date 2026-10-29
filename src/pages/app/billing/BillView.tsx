import { businessDayISO, INVOICE_FORMATS, type InvoiceFormat } from '@/shared'
import { useEffect, useState } from 'react'
import { FileDown, Printer } from 'lucide-react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'

import { WhatsAppShareDialog } from '@/components/WhatsAppShareDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useBusinessProfile, useSettings } from '@/lib/appQueries'
import { useBill } from '@/lib/billingQueries'
import { useStates } from '@/lib/queries'
import { useAuth } from '@/lib/auth'
import { useT } from '@/lib/i18n'
import { downloadPdf } from '@/lib/share'
import { InvoicePrint } from '@/pages/app/billing/InvoicePrint'
import { defaultInvoiceFormat, FORMAT_LABEL_KEY } from '@/pages/app/billing/invoice/format'

const todayISO = businessDayISO
const inr = (s: string) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(s))

export function BillView() {
  const t = useT()
  const { id } = useParams()
  const navigate = useNavigate()
  const { me, can } = useAuth()
  const { data: bill, isLoading } = useBill(Number(id))
  const { data: settings } = useSettings()
  const { data: business } = useBusinessProfile() // any tenant user; branch gstin/state override applied server-side
  const { data: states } = useStates()
  const [override, setOverride] = useState<InvoiceFormat | null>(null)
  // BillForm "Send on WhatsApp" → opens the share dialog once; state cleared so a refresh doesn't reopen it
  const location = useLocation()
  const [sharing, setSharing] = useState(() => !!(location.state as { share?: boolean } | null)?.share)
  useEffect(() => {
    if ((location.state as { share?: boolean } | null)?.share) navigate(location.pathname, { replace: true, state: null })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (isLoading || !bill) return <p className="text-sm text-muted-foreground">{t('common.loading')}</p>

  const layout = override ?? defaultInvoiceFormat(settings)
  const shopName = business?.name ?? me?.business?.name ?? 'Shop'
  const stateName = states?.find((s) => s.id === business?.stateId)?.name
  const canEdit = can(bill.kind === 'SELL' ? 'billing.sell_bill' : 'billing.purchase_bill', 'edit')
  const editable = bill.status === 'ACTIVE' && bill.billDate.slice(0, 10) === todayISO() && canEdit
  const summary = `${shopName}\n${bill.kind === 'SELL' ? 'Bill' : 'Purchase'} ${bill.billNo} · ${new Date(bill.billDate).toLocaleDateString('en-IN')}\nTotal ${inr(bill.final)} · Paid ${inr(bill.paid)} · Balance ${inr(bill.balance)}`

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 print:hidden">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <Link to="/app/billing/list" className="text-sm font-medium text-brand-strong hover:underline">{t('bill.back_bills')}</Link>
            {bill.status === 'DELETED' && <Badge variant="secondary">{t('bill.deleted')}</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">{t('bill.view_subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {editable && <Button variant="outline" onClick={() => navigate(`/app/billing/edit/${bill.id}`)}>{t('common.edit')}</Button>}
          <Button variant="outline" onClick={() => setSharing(true)}>{t('bill.share')}</Button>
          <Select value={layout} onValueChange={(v) => setOverride(v as InvoiceFormat)}>
            <SelectTrigger className="w-44" aria-label="Print layout"><SelectValue /></SelectTrigger>
            <SelectContent>
              {INVOICE_FORMATS.map((f) => <SelectItem key={f} value={f}>{t(FORMAT_LABEL_KEY[f])}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={downloadPdf}><FileDown aria-hidden />{t('bill.download_pdf')}</Button>
          <Button onClick={() => window.print()}><Printer aria-hidden />{t('bill.print')}</Button>
        </div>
      </div>

      <InvoicePrint bill={bill} format={layout} settings={settings} shopName={shopName} business={business} stateName={stateName} />
      <WhatsAppShareDialog open={sharing} onClose={() => setSharing(false)} name={bill.party.name} mobile={bill.party.mobile} buildText={() => summary} />
    </div>
  )
}
