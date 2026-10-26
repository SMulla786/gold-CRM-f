import { FileDown, Printer } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { MpinDialog } from '@/components/MpinDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useBusinessProfile } from '@/lib/appQueries'
import { useAuth } from '@/lib/auth'
import { useT } from '@/lib/i18n'
import { downloadPdf } from '@/lib/share'
import { useDeleteUdhar, useUdharTxn } from '@/lib/udhariQueries'
import { cn } from '@/lib/utils'
import type { BalanceDto } from '@/shared'

const date = (s: string) => new Date(s).toLocaleDateString('en-IN')
const triple = (b: BalanceDto) => `₹${b.amount}${Number(b.gold) ? ` · ${b.gold}g Au` : ''}${Number(b.silver) ? ` · ${b.silver}g Ag` : ''}`
const show = (v: string, unit = '') => (Number(v) ? `${unit === '₹' ? '₹' : ''}${v}${unit && unit !== '₹' ? ` ${unit}` : ''}` : '—')

/** TASK-97: one udhar transaction — printable receipt (A4 / 80 mm via the browser) + MPIN delete. */
export function UdharView() {
  const t = useT()
  const { id } = useParams()
  const navigate = useNavigate()
  const { can, me } = useAuth()
  const { data: txn, isLoading } = useUdharTxn(Number(id))
  const { data: business } = useBusinessProfile()
  const del = useDeleteUdhar()
  const [deleting, setDeleting] = useState(false)
  const [thermal, setThermal] = useState(false)

  if (isLoading || !txn) return <p className="text-sm text-muted-foreground">{t('common.loading')}</p>

  const rows: { label: string; given: string; received: string }[] = [
    { label: t('udhari.cash'), given: show(txn.cashOut, '₹'), received: show(txn.cashIn, '₹') },
    { label: t('udhari.online'), given: show(txn.onlineOut, '₹'), received: show(txn.onlineIn, '₹') },
    { label: t('udhari.gold_g'), given: show(txn.goldOut, 'g'), received: show(txn.goldIn, 'g') },
    { label: t('udhari.silver_g'), given: show(txn.silverOut, 'g'), received: show(txn.silverIn, 'g') },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 print:hidden">
        <div className="space-y-1">
          <Link to="/app/udhari/list" className="text-sm font-medium text-brand-strong hover:underline">{t('udhari.back_list')}</Link>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-bold">{t('udhari.txn_heading', { no: txn.txnNo })}</h2>
            {txn.isDeleted && <Badge variant="destructive">{t('udhari.deleted')}</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">{t('udhari.view_intro')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {can('udhari.entry', 'delete') && !txn.isDeleted && (
            <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setDeleting(true)}>{t('common.delete')}</Button>
          )}
          <Select value={thermal ? 'THERMAL_80' : 'A4'} onValueChange={(v) => setThermal(v === 'THERMAL_80')}>
            <SelectTrigger className="w-40" aria-label="Print layout"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="A4">A4</SelectItem>
              <SelectItem value="THERMAL_80">{t('bill.thermal_80')}</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={downloadPdf}><FileDown aria-hidden />{t('udhari.download_pdf')}</Button>
          <Button onClick={() => window.print()}><Printer aria-hidden />{t('udhari.print')}</Button>
        </div>
      </div>

      <div className={cn('print-area mx-auto space-y-4 rounded-3xl border border-white/80 bg-card p-6 text-sm shadow-sm sm:p-10 dark:border-border print:max-w-none print:rounded-none print:border-0 print:bg-transparent print:shadow-none', thermal ? 'print-thermal max-w-sm' : 'max-w-2xl')}>
        <div className="text-center">
          <div className="text-lg font-bold">{business?.name ?? me?.business?.name ?? 'Shop'}</div>
          <div className="font-medium">{t('udhari.receipt_title')}</div>
        </div>
        <div className="flex flex-wrap justify-between gap-2">
          <div><span className="font-semibold">{txn.party.name}</span>{txn.party.mobile ? ` · ${txn.party.mobile}` : ''}</div>
          <div className="tabular-nums">#{txn.txnNo} · {date(txn.txnDate)} · {txn.branch.name}</div>
        </div>

        <table className="w-full border-collapse tabular-nums">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="py-2 font-medium" />
              <th className="py-2 text-right font-medium">{t('udhari.col_given')}</th>
              <th className="py-2 text-right font-medium">{t('udhari.col_received')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-b last:border-0">
                <td className="py-2">{r.label}</td>
                <td className="py-2 text-right">{r.given}</td>
                <td className="py-2 text-right">{r.received}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {(txn.outBank || txn.inBank) && (
          <div className="text-xs text-muted-foreground">
            {txn.outBank && <div>{t('udhari.out_bank')}: {txn.outBank.name}</div>}
            {txn.inBank && <div>{t('udhari.in_bank')}: {txn.inBank.name}</div>}
          </div>
        )}

        {txn.bhav && (
          <div className="rounded-2xl bg-muted/50 px-4 py-3 print:rounded-none print:bg-transparent print:px-0">
            <div className="font-semibold">{t('udhari.bhav_cut')}</div>
            <div className="tabular-nums text-muted-foreground">
              {txn.bhav.direction === 'METAL_TO_MONEY' ? t('udhari.metal_to_money') : t('udhari.money_to_metal')} · {txn.bhav.metal} · ₹{txn.bhav.amount} @ ₹{txn.bhav.rate}/{txn.bhav.unitGrams === 1000 ? '1 kg' : `${txn.bhav.unitGrams} g`} ≈ {txn.bhav.weight} g
            </div>
          </div>
        )}
        {txn.settleBill && (
          <div>{t('udhari.settled_bill')}: <Link to={`/app/billing/view/${txn.settleBill.id}`} className="font-semibold text-brand-strong hover:underline print:text-foreground print:no-underline">{txn.settleBill.billNo}</Link></div>
        )}

        <div className="ml-auto max-w-sm space-y-1 tabular-nums">
          <div className="flex justify-between gap-4"><span className="text-muted-foreground">{t('udhari.old_balance')}</span><span>{triple(txn.old)}</span></div>
          <div className="flex justify-between gap-4 border-t-2 border-brand pt-2 text-base font-bold"><span>{t('udhari.new_balance')}</span><span>{triple(txn.final)}</span></div>
          <div className="text-xs text-muted-foreground">{t('udhari.sign_hint')}</div>
        </div>
        {txn.remark && <div className="text-muted-foreground">{t('udhari.remark')}: {txn.remark}</div>}
      </div>

      <MpinDialog
        open={deleting}
        title={t('udhari.delete_title', { no: txn.txnNo })}
        onConfirm={async (mpin) => { await del.mutateAsync({ id: txn.id, mpin }); navigate('/app/udhari/list') }}
        onClose={() => setDeleting(false)}
      />
    </div>
  )
}
