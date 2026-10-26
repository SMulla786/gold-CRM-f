import { FileDown, Printer } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useBusinessProfile } from '@/lib/appQueries'
import { useAuth } from '@/lib/auth'
import { useT } from '@/lib/i18n'
import { useRepair } from '@/lib/repairQueries'
import { downloadPdf, shareOnWhatsApp } from '@/lib/share'

import { addedMetalLabel, addedValue, date, estCharge, inr, n, STATUS_KEY } from './repairUtils'

/** Printable repair slip (customer copy) — same .print-area pattern as the bill / statement views. */
export function RepairSlip() {
  const t = useT()
  const { id } = useParams()
  const { me } = useAuth()
  const { data: tk, isLoading } = useRepair(Number(id))
  const { data: business } = useBusinessProfile()

  if (isLoading || !tk) return <p className="text-sm text-muted-foreground">{t('common.loading')}</p>

  const shopName = business?.name ?? me?.business?.name ?? 'Shop'
  // WhatsApp text stays English, like the bill share text.
  const summary = `${shopName}\nRepair ticket #${tk.ticketNo} · ${tk.category}\nExpected ${date(tk.expectedDate)} · Advance ${inr(tk.advance)} · Balance ${inr(tk.balance)}`

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 print:hidden">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <Link to="/app/repair/ledger" className="text-sm font-medium text-brand-strong hover:underline">{t('repair.back_ledger')}</Link>
            <Badge variant="secondary">{t(STATUS_KEY[tk.status])}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{t('repair.slip_intro')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => shareOnWhatsApp(tk.party.mobile, summary)}>{t('bill.share')}</Button>
          <Button variant="outline" onClick={downloadPdf}><FileDown aria-hidden />{t('bill.download_pdf')}</Button>
          <Button onClick={() => window.print()}><Printer aria-hidden />{t('bill.print')}</Button>
        </div>
      </div>

      <div className="print-area space-y-4 text-sm rounded-3xl border border-white/80 bg-card p-6 shadow-sm sm:p-10 dark:border-border print:rounded-none print:border-0 print:bg-transparent print:shadow-none">
        <header className="text-center">
          <div className="text-lg font-bold">{shopName}</div>
          {business?.address && <div>{business.address}</div>}
          {business?.gstin && <div>GSTIN: {business.gstin}</div>}
          <div className="mt-1 font-medium">{t('repair.slip_title')}</div>
        </header>

        <div className="flex justify-between gap-4 rounded-2xl bg-muted/50 px-4 py-3 print:rounded-none print:border-y print:bg-transparent print:px-0">
          <div>
            <span className="text-muted-foreground">{t('repair.slip_ticket')}</span> #{tk.ticketNo}<br />
            <span className="text-muted-foreground">{t('repair.slip_received')}</span> {date(tk.createdAt)}<br />
            <span className="text-muted-foreground">{t('repair.slip_expected')}</span> {date(tk.expectedDate)}{tk.priority !== 'NORMAL' ? ` · ${tk.priority}` : ''}
          </div>
          <div className="text-right">
            <div className="font-medium">{tk.party.name}</div>
            <div>{tk.party.mobile}</div>
            {tk.party.shopName && <div>{tk.party.shopName}</div>}
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
          <Item label={t('bill.col_item')}>{tk.category}{tk.subCategory ? ` · ${tk.subCategory}` : ''}</Item>
          <Item label={t('udhari.metal')}>{tk.metal}{tk.karatCode ? ` · ${tk.karatCode}` : ''}{tk.purity ? ` · ${tk.purity}%` : ''}</Item>
          <Item label={t('inv.newstock.pieces')}>{tk.pcs}</Item>
          <Item label={t('inv.newstock.gross_weight')}>{tk.gross} g</Item>
          <Item label={t('repair.net_weight')}>{tk.net ? `${tk.net} g` : '—'}</Item>
          <Item label={t('repair.hallmark')}>{tk.hallmark ?? '—'}</Item>
          {tk.finalWeight && <Item label={t('repair.final_weight')}>{tk.finalWeight} g</Item>}
          {tk.deliveredAt && <Item label={t('repair.delivered_on')}>{date(tk.deliveredAt)}</Item>}
        </dl>
        <p><span className="text-muted-foreground">{t('repair.slip_work')}</span> {tk.description}</p>
        {tk.remarks && <p><span className="text-muted-foreground">{t('repair.slip_remarks')}</span> {tk.remarks}</p>}

        <div className="ml-auto max-w-xs space-y-1 tabular-nums">
          <Line label={t('bill.col_labour')} value={inr(tk.labourCharge)} />
          <Line label={t('bill.col_other')} value={inr(tk.otherCharge)} />
          {n(tk.addedFine ?? '0') > 0 && <Line label={t('repair.slip_metal_added', { metal: addedMetalLabel(tk, t('repair.other_metal')), fine: tk.addedFine ?? '' })} value={inr(addedValue(tk))} />}
          <div className="flex justify-between border-t-2 border-brand pt-1 text-base font-bold"><span>{t('repair.est_charge')}</span><span>{inr((Number(estCharge(tk)) + Number(addedValue(tk))).toFixed(2))}</span></div>
          <Line label={t('repair.advance_paid')} value={inr(tk.advance)} />
          {tk.status === 'DELIVERED' && <Line label={t('repair.slip_paid_cash')} value={inr(tk.deliveryCash ?? '0')} />}
          {tk.status === 'DELIVERED' && <Line label={`${t('repair.slip_paid_online')}${tk.deliveryBank ? ` (${tk.deliveryBank.name})` : ''}`} value={inr(tk.deliveryOnline ?? '0')} />}
          <div className="flex justify-between font-medium"><span>{t('bill.balance')}</span><span>{inr(tk.balance)}</span></div>
        </div>

        <div className="flex justify-between gap-6 pt-10">
          <div className="w-40 border-t pt-1 text-center text-xs text-muted-foreground">{t('repair.slip_customer_sign')}</div>
          <div className="w-40 border-t pt-1 text-center text-xs text-muted-foreground">{t('repair.slip_for', { shop: shopName })}</div>
        </div>
        <p className="text-xs text-muted-foreground">{t('repair.slip_note')}</p>
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
