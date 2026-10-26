import { Printer } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'

import { QrImage } from '@/components/QrImage'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useBusinessProfile } from '@/lib/appQueries'
import { useAuth } from '@/lib/auth'
import { useDraft } from '@/lib/draftsQueries'
import { useT } from '@/lib/i18n'

const inr = (s: string) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(s))

/** TASK-97: thermal (80 mm) showroom-draft slip the customer carries to the cashier, who types the big draft no. into "Retrieve draft".
 *  TASK-98: also carries a QR of the bare draft no., so a scanner typing into "Retrieve draft" + Enter fetches it. */
export function DraftSlip() {
  const t = useT()
  const { id } = useParams()
  const { me } = useAuth()
  const { data: d, isLoading } = useDraft(Number(id))
  const { data: business } = useBusinessProfile()

  if (isLoading || !d) return <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
  const disc = (v: string, u: string | null) => (u === 'PERCENT' ? `${v}%` : inr(v))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 print:hidden">
        <div className="space-y-1">
          <Link to="/app/billing/drafts" className="text-sm font-medium text-brand-strong hover:underline">{t('draft.back_drafts')}</Link>
          <p className="text-sm text-muted-foreground">{t('draft.slip_intro')}</p>
        </div>
        <Button onClick={() => window.print()}><Printer aria-hidden />{t('udhari.print')}</Button>
      </div>

      <div className="print-area print-thermal mx-auto max-w-sm space-y-3 rounded-3xl border border-white/80 bg-card p-6 text-sm shadow-sm dark:border-border print:rounded-none print:border-0 print:bg-transparent print:shadow-none">
        <div className="text-center">
          <div className="font-bold">{business?.name ?? me?.business?.name ?? 'Shop'}</div>
          <div className="text-xs text-muted-foreground">{t('draft.slip_title')}</div>
          <div className="mt-2 text-4xl font-extrabold tracking-wider tabular-nums">#{d.draftNo}</div>
          <Badge variant="secondary" className="mt-1">{d.status}</Badge>
          <QrImage text={String(d.draftNo)} size={96} className="mx-auto mt-2 block" />
        </div>
        <div className="border-y py-2">
          <div className="font-semibold">{d.party?.name ?? d.customerName}</div>
          {(d.party?.mobile ?? d.mobile) && <div className="text-xs text-muted-foreground">{d.party?.mobile ?? d.mobile}</div>}
          <div className="text-xs text-muted-foreground">{new Date(d.createdAt).toLocaleString('en-IN')} · {d.salesman.name}</div>
        </div>
        <ul className="space-y-1 tabular-nums">
          {d.items.map((it) => (
            <li key={it.stockItemId} className="flex justify-between gap-2"><span>{it.tagNo ?? it.label}</span><span className="text-muted-foreground">{it.gross} g</span></li>
          ))}
        </ul>
        <div className="space-y-1 border-t pt-2 tabular-nums">
          <div className="flex justify-between"><span>{t('draft.col_est')}</span><span className="font-semibold">{inr(d.estTotal)}</span></div>
          <div className="flex justify-between"><span>{t('draft.col_req_disc')}</span><span>{disc(d.requestedDiscount, d.requestedDiscountUnit)}</span></div>
          {d.approvedDiscount != null && <div className="flex justify-between font-semibold"><span>{t('draft.col_approved_disc')}</span><span>{disc(d.approvedDiscount, d.approvedDiscountUnit)}</span></div>}
        </div>
        {d.note && <p className="text-xs text-muted-foreground">{d.note}</p>}
        <p className="text-center text-xs text-muted-foreground">{t('draft.slip_valid', { date: new Date(d.expiresAt).toLocaleString('en-IN') })}</p>
      </div>
    </div>
  )
}
