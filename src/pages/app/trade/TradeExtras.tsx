// TASK-97 shared trade UI: split payment table, date range filter, per-document history dialog.
import { Plus, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useBankAccounts } from '@/lib/appQueries'
import { usePartyBalance } from '@/lib/billingQueries'
import { useT } from '@/lib/i18n'
import { useTradeHistory } from '@/lib/tradeQueries'
import type { TradePaymentDto } from '@/shared'

import { blankPay, payTotal, type PayRow } from './splitPay'

const inr = (s: string | number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(s))

/** "Split payment" switch: when on, the SN / MODE / BANK / AMOUNT table replaces the cash + online fields. */
export function SplitToggle({ id, checked, onChange }: { id: string; checked: boolean; onChange: (on: boolean) => void }) {
  const t = useT()
  return (
    <div className="flex items-center gap-2">
      <Checkbox id={id} checked={checked} onCheckedChange={(c) => onChange(c === true)} />
      <Label htmlFor={id} className="font-normal">{t('trade.split_toggle')}</Label>
    </div>
  )
}

export function SplitPaymentTable({ rows, onChange }: { rows: PayRow[]; onChange: (rows: PayRow[]) => void }) {
  const t = useT()
  const { data: banks } = useBankAccounts()
  const setRow = (i: number, patch: Partial<PayRow>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-xl border">
        <Table>
          <TableHeader><TableRow><TableHead>{t('girvi.col_sn')}</TableHead><TableHead>{t('bill.mode')}</TableHead><TableHead>{t('bill.bank')}</TableHead><TableHead>{t('udhari.amount')}</TableHead><TableHead>{t('trade.reference')}</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={r.key}>
                <TableCell className="tabular-nums">{i + 1}</TableCell>
                <TableCell>
                  <Select value={r.mode} onValueChange={(v) => setRow(i, { mode: v === 'ONLINE' ? 'ONLINE' : 'CASH', bankAccountId: v === 'ONLINE' ? r.bankAccountId : '' })}>
                    <SelectTrigger className="w-28" aria-label={`Payment ${i + 1} mode`}><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="CASH">{t('bill.cash')}</SelectItem><SelectItem value="ONLINE">{t('bill.online')}</SelectItem></SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  {r.mode === 'ONLINE' ? (
                    <Select value={r.bankAccountId} onValueChange={(v) => setRow(i, { bankAccountId: v })}>
                      <SelectTrigger className="w-44" aria-label={`Payment ${i + 1} bank`}><SelectValue placeholder={t('trade.choose_bank')} /></SelectTrigger>
                      <SelectContent>{banks?.map((b) => <SelectItem key={b.id} value={String(b.id)}>{b.bankName} · {b.accountNo}</SelectItem>)}</SelectContent>
                    </Select>
                  ) : <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell><Input className="w-32" type="number" aria-label={`Payment ${i + 1} amount`} value={r.amount} onChange={(e) => setRow(i, { amount: e.target.value })} /></TableCell>
                <TableCell><Input className="w-32" aria-label={`Payment ${i + 1} reference`} placeholder={t('trade.utr_note')} value={r.reference} onChange={(e) => setRow(i, { reference: e.target.value })} /></TableCell>
                <TableCell><Button variant="ghost" size="sm" aria-label={`Remove payment ${i + 1}`} disabled={rows.length === 1} onClick={() => onChange(rows.filter((_, j) => j !== i))}><X className="size-4" aria-hidden /></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between gap-3 text-sm">
        <Button variant="outline" size="sm" onClick={() => onChange([...rows, blankPay()])}><Plus className="size-4" aria-hidden />{t('trade.add_payment_row')}</Button>
        <span className="tabular-nums text-muted-foreground">{t('trade.total_amt', { amount: inr(payTotal(rows)) })}</span>
      </div>
    </div>
  )
}

/** Read-only "existing udhar" chip for the picked party (money + gold + silver; + = party owes the shop). Display only. */
export function PartyBalanceChip({ partyId }: { partyId?: number }) {
  const t = useT()
  const { data } = usePartyBalance(partyId)
  if (!partyId) return null
  return (
    <p className="w-fit rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground tabular-nums">
      {data
        ? t('trade.party_bal', { amount: `${inr(data.amount)}${Number(data.amount) < 0 ? ` ${t('trade.party_bal_adv')}` : ''}`, gold: data.gold, silver: data.silver })
        : t('trade.party_bal_none')}
    </p>
  )
}

/** From / To txn-date inputs for a list filter bar. */
export function DateRangeFilter({ from, to, onChange }: { from: string; to: string; onChange: (from: string, to: string) => void }) {
  const t = useT()
  return (
    <div className="flex items-end gap-2">
      <div className="space-y-1"><Label className="text-xs text-muted-foreground">{t('common.from')}</Label><Input type="date" className="w-38" aria-label="From date" value={from} onChange={(e) => onChange(e.target.value, to)} /></div>
      <div className="space-y-1"><Label className="text-xs text-muted-foreground">{t('common.to')}</Label><Input type="date" className="w-38" aria-label="To date" value={to} onChange={(e) => onChange(from, e.target.value)} /></div>
    </div>
  )
}

/** Payment rows for the print slips (only for split-paid documents). */
export function PaymentLines({ payments }: { payments?: TradePaymentDto[] }) {
  const t = useT()
  if (!payments?.length) return null
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('bill.payments')}</div>
      {payments.map((p, i) => (
        <div key={p.id} className="flex justify-between gap-4">
          <span className="text-muted-foreground">{i + 1}. {p.mode === 'ONLINE' ? `${t('bill.online')}${p.bankAccount ? ` (${p.bankAccount.name})` : ''}` : t('bill.cash')}{p.reference ? ` · ${p.reference}` : ''}</span>
          <span>{inr(p.amount)}</span>
        </div>
      ))}
    </div>
  )
}

const SKIP = new Set(['id', 'businessId', 'branchId', 'createdAt', 'updatedAt', 'createdById', 'lines', 'payments'])
const show = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v))

/** Which top-level fields an EDITED log row changed (before → after). `tr` translates the summary lines. */
function changes(meta: unknown, tr: (key: string) => string): string[] {
  const m = meta as { before?: Record<string, unknown>; after?: Record<string, unknown> } | null
  if (!m?.before || !m.after) return []
  const out = Object.keys(m.after).filter((k) => !SKIP.has(k) && show(m.before![k]) !== show(m.after![k])).map((k) => `${k}: ${show(m.before![k])} → ${show(m.after![k])}`)
  const rows = (x: unknown) => JSON.stringify((x as Array<Record<string, unknown>> | undefined)?.map(({ id: _id, ...r }) => r) ?? [])
  if (rows(m.before.lines) !== rows(m.after.lines)) out.push(tr('trade.history.lines_changed'))
  if (rows(m.before.payments) !== rows(m.after.payments)) out.push(tr('trade.history.payments_changed'))
  return out
}

/** Who did what to one trade document, oldest first. */
export function HistoryDialog({ kind, id, title, onClose }: { kind: 'exchange' | 'buy-sell' | 'bhav-booking'; id?: number; title: string; onClose: () => void }) {
  const t = useT()
  const { data, isLoading } = useTradeHistory(kind, id)
  return (
    <Dialog open={!!id} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        {isLoading ? <p className="text-sm text-muted-foreground">{t('common.loading')}</p> : !data?.length ? <p className="text-sm text-muted-foreground">{t('trade.history.empty')}</p> : (
          <ol className="max-h-[60vh] space-y-3 overflow-y-auto text-sm">
            {data.map((h) => (
              <li key={h.id} className="rounded-xl border px-3 py-2">
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="font-medium">{h.summary}</span>
                  <span className="text-xs text-muted-foreground">{new Date(h.createdAt).toLocaleString('en-IN')}</span>
                </div>
                <div className="text-xs text-muted-foreground">{t('trade.history.by', { action: h.action.toLowerCase(), user: h.user ?? t('trade.history.unknown_user') })}</div>
                {changes(h.meta, t).map((c) => <div key={c} className="text-xs tabular-nums">{c}</div>)}
              </li>
            ))}
          </ol>
        )}
      </DialogContent>
    </Dialog>
  )
}
