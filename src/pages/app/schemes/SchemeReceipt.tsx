import { FileDown, MessageCircle, Printer } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useBusinessProfile } from '@/lib/appQueries'
import { useAuth } from '@/lib/auth'
import { downloadPdf, shareOnWhatsApp } from '@/lib/share'
import type { EnrollmentDetailDto } from '@/shared'

const inr = (s: string | number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(s))
const date = (s: string) => new Date(s).toLocaleDateString('en-IN')

/**
 * Receipt for one scheme payment: print (.print-area), PDF (browser print) or WhatsApp.
 * Non-modal on purpose: it pops up after a save and must not block the page behind it (a click outside just closes it).
 * The opener drops any other .print-area on the page while this is open, so only the receipt prints.
 */
export function SchemeReceiptDialog({ enrollment: e, paymentId, onClose }: { enrollment: EnrollmentDetailDto; paymentId: number; onClose: () => void }) {
  const { me } = useAuth()
  const { data: business } = useBusinessProfile()
  const p = e.payments.find((x) => x.id === paymentId)
  if (!p) return null
  const shopName = business?.name ?? me?.business?.name ?? 'Shop'
  // running total up to and including this payment (reversed ones excluded)
  const paidTotal = e.payments.filter((x) => !x.isReversed && x.id <= p.id).reduce((a, x) => a + Number(x.amount), 0)
  const mode = p.bankAccount ? `${p.medium} · ${p.bankAccount.name}` : p.medium
  const emi = p.emiNo != null ? `#${p.emiNo} of ${e.scheme.tenureMonths}` : p.medium === 'TOKEN' ? 'Joining token' : '—'
  const summary = `${shopName}\nScheme receipt · ${e.assignId} ${e.displayName}\n${e.scheme.name} · EMI ${emi}\n${inr(p.amount)} by ${mode} on ${date(p.txnDate)}\nPaid total ${inr(paidTotal)}`
  const line = (label: string, value: string) => <div className="flex justify-between gap-4"><span className="text-muted-foreground">{label}</span><span className="text-right font-medium">{value}</span></div>

  return (
    <Dialog open modal={false} onOpenChange={(o) => !o && onClose()}>
      {/* docked bottom-right (not centred) so the page's header actions stay clickable while it is open */}
      <DialogContent className="top-auto right-4 bottom-4 left-auto translate-x-0 translate-y-0 gap-3 p-4 sm:max-w-sm print:inset-0 print:max-w-none print:border-0 print:shadow-none">
        <DialogHeader><DialogTitle>Payment receipt</DialogTitle></DialogHeader>
        <div className="print-area space-y-2 rounded-2xl border bg-card p-4 text-sm tabular-nums print:rounded-none print:border-0">
          <header className="text-center">
            <div className="text-base font-bold">{shopName}</div>
            {business?.address && <div className="text-xs">{business.address}</div>}
            <div className="mt-1 text-xs font-medium tracking-wide">SCHEME PAYMENT RECEIPT</div>
          </header>
          <div className="space-y-1 border-t pt-2">
            {line('Member', `${e.assignId} · ${e.displayName}`)}
            {e.party?.mobile && line('Mobile', e.party.mobile)}
            {line('Scheme', e.group ? `${e.scheme.name} · ${e.group.name}` : e.scheme.name)}
            {line('EMI', emi)}
            {line('Date', date(p.txnDate))}
            {line('Mode', mode)}
            {p.fine && line('Gold', `${p.fine} g @ ${inr(p.rate ?? 0)}/10g`)}
          </div>
          <div className="flex justify-between border-t-2 border-brand pt-2 text-base font-bold"><span>Amount</span><span>{inr(p.amount)}</span></div>
          {line('Paid total', inr(paidTotal))}
          {p.isReversed && <p className="text-center font-semibold text-destructive">REVERSED</p>}
        </div>
        <DialogFooter className="print:hidden">
          <Button variant="outline" size="sm" onClick={() => shareOnWhatsApp(e.party?.mobile ?? '', summary)}><MessageCircle aria-hidden />Share on WhatsApp</Button>
          <Button variant="outline" size="sm" onClick={downloadPdf}><FileDown aria-hidden />PDF</Button>
          <Button size="sm" onClick={() => window.print()}><Printer aria-hidden />Print</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
