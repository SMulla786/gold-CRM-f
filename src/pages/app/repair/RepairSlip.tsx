import { FileDown, Printer } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useBusinessProfile } from '@/lib/appQueries'
import { useAuth } from '@/lib/auth'
import { useRepair } from '@/lib/repairQueries'
import { downloadPdf, shareOnWhatsApp } from '@/lib/share'

import { date, estCharge, inr, STATUS_LABEL } from './repairUtils'

/** Printable repair slip (customer copy) — same .print-area pattern as the bill / statement views. */
export function RepairSlip() {
  const { id } = useParams()
  const { me } = useAuth()
  const { data: t, isLoading } = useRepair(Number(id))
  const { data: business } = useBusinessProfile()

  if (isLoading || !t) return <p className="text-sm text-muted-foreground">Loading…</p>

  const shopName = business?.name ?? me?.business?.name ?? 'Shop'
  const summary = `${shopName}\nRepair ticket #${t.ticketNo} · ${t.category}\nExpected ${date(t.expectedDate)} · Advance ${inr(t.advance)} · Balance ${inr(t.balance)}`

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 print:hidden">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <Link to="/app/repair/ledger" className="text-sm font-medium text-brand-strong hover:underline">← Repair ledger</Link>
            <Badge variant="secondary">{STATUS_LABEL[t.status]}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">Customer copy of this repair ticket. Share, print or save it as a PDF.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => shareOnWhatsApp(t.party.mobile, summary)}>Share</Button>
          <Button variant="outline" onClick={downloadPdf}><FileDown aria-hidden />Download PDF</Button>
          <Button onClick={() => window.print()}><Printer aria-hidden />Print</Button>
        </div>
      </div>

      <div className="print-area space-y-4 text-sm rounded-3xl border border-white/80 bg-card p-6 shadow-sm sm:p-10 dark:border-border print:rounded-none print:border-0 print:bg-transparent print:shadow-none">
        <header className="text-center">
          <div className="text-lg font-bold">{shopName}</div>
          {business?.address && <div>{business.address}</div>}
          {business?.gstin && <div>GSTIN: {business.gstin}</div>}
          <div className="mt-1 font-medium">REPAIR SLIP</div>
        </header>

        <div className="flex justify-between gap-4 rounded-2xl bg-muted/50 px-4 py-3 print:rounded-none print:border-y print:bg-transparent print:px-0">
          <div>
            <span className="text-muted-foreground">Ticket:</span> #{t.ticketNo}<br />
            <span className="text-muted-foreground">Received:</span> {date(t.createdAt)}<br />
            <span className="text-muted-foreground">Expected:</span> {date(t.expectedDate)}{t.priority !== 'NORMAL' ? ` · ${t.priority}` : ''}
          </div>
          <div className="text-right">
            <div className="font-medium">{t.party.name}</div>
            <div>{t.party.mobile}</div>
            {t.party.shopName && <div>{t.party.shopName}</div>}
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
          <Item label="Item">{t.category}</Item>
          <Item label="Metal">{t.metal}{t.karatCode ? ` · ${t.karatCode}` : ''}</Item>
          <Item label="Pieces">{t.pcs}</Item>
          <Item label="Gross weight">{t.gross} g</Item>
          <Item label="Net weight">{t.net ? `${t.net} g` : '—'}</Item>
          <Item label="Hallmark">{t.hallmark ?? '—'}</Item>
          {t.finalWeight && <Item label="Final weight">{t.finalWeight} g</Item>}
          {t.deliveredAt && <Item label="Delivered on">{date(t.deliveredAt)}</Item>}
        </dl>
        <p><span className="text-muted-foreground">Work to be done:</span> {t.description}</p>
        {t.remarks && <p><span className="text-muted-foreground">Remarks:</span> {t.remarks}</p>}

        <div className="ml-auto max-w-xs space-y-1 tabular-nums">
          <Line label="Labour" value={inr(t.labourCharge)} />
          <Line label="Other" value={inr(t.otherCharge)} />
          <div className="flex justify-between border-t-2 border-brand pt-1 text-base font-bold"><span>Est. charge</span><span>{inr(estCharge(t))}</span></div>
          <Line label="Advance paid" value={inr(t.advance)} />
          <div className="flex justify-between font-medium"><span>Balance</span><span>{inr(t.balance)}</span></div>
        </div>

        <div className="flex justify-between gap-6 pt-10">
          <div className="w-40 border-t pt-1 text-center text-xs text-muted-foreground">Customer signature</div>
          <div className="w-40 border-t pt-1 text-center text-xs text-muted-foreground">For {shopName}</div>
        </div>
        <p className="text-xs text-muted-foreground">Please bring this slip when collecting the ornament. Final charges may change if extra metal is added during repair.</p>
      </div>
    </div>
  )
}

function Item({ label, children }: { label: string; children: ReactNode }) {
  return <div><dt className="text-xs text-muted-foreground">{label}</dt><dd className="font-medium">{children}</dd></div>
}

function Line({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between"><span className="text-muted-foreground">{label}</span><span>{value}</span></div>
}
