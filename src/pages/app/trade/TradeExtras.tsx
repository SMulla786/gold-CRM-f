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
import { useTradeHistory } from '@/lib/tradeQueries'
import type { TradePaymentDto } from '@/shared'

import { blankPay, payTotal, type PayRow } from './splitPay'

const inr = (s: string | number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(s))

/** "Split payment" switch: when on, the SN / MODE / BANK / AMOUNT table replaces the cash + online fields. */
export function SplitToggle({ id, checked, onChange }: { id: string; checked: boolean; onChange: (on: boolean) => void }) {
  return (
    <div className="flex items-center gap-2">
      <Checkbox id={id} checked={checked} onCheckedChange={(c) => onChange(c === true)} />
      <Label htmlFor={id} className="font-normal">Split payment (several cash / bank rows)</Label>
    </div>
  )
}

export function SplitPaymentTable({ rows, onChange }: { rows: PayRow[]; onChange: (rows: PayRow[]) => void }) {
  const { data: banks } = useBankAccounts()
  const setRow = (i: number, patch: Partial<PayRow>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-xl border">
        <Table>
          <TableHeader><TableRow><TableHead>SN</TableHead><TableHead>Mode</TableHead><TableHead>Bank</TableHead><TableHead>Amount ₹</TableHead><TableHead>Reference</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={r.key}>
                <TableCell className="tabular-nums">{i + 1}</TableCell>
                <TableCell>
                  <Select value={r.mode} onValueChange={(v) => setRow(i, { mode: v === 'ONLINE' ? 'ONLINE' : 'CASH', bankAccountId: v === 'ONLINE' ? r.bankAccountId : '' })}>
                    <SelectTrigger className="w-28" aria-label={`Payment ${i + 1} mode`}><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="CASH">Cash</SelectItem><SelectItem value="ONLINE">Online</SelectItem></SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  {r.mode === 'ONLINE' ? (
                    <Select value={r.bankAccountId} onValueChange={(v) => setRow(i, { bankAccountId: v })}>
                      <SelectTrigger className="w-44" aria-label={`Payment ${i + 1} bank`}><SelectValue placeholder="Choose bank" /></SelectTrigger>
                      <SelectContent>{banks?.map((b) => <SelectItem key={b.id} value={String(b.id)}>{b.bankName} · {b.accountNo}</SelectItem>)}</SelectContent>
                    </Select>
                  ) : <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell><Input className="w-32" type="number" aria-label={`Payment ${i + 1} amount`} value={r.amount} onChange={(e) => setRow(i, { amount: e.target.value })} /></TableCell>
                <TableCell><Input className="w-32" aria-label={`Payment ${i + 1} reference`} placeholder="UTR / note" value={r.reference} onChange={(e) => setRow(i, { reference: e.target.value })} /></TableCell>
                <TableCell><Button variant="ghost" size="sm" aria-label={`Remove payment ${i + 1}`} disabled={rows.length === 1} onClick={() => onChange(rows.filter((_, j) => j !== i))}><X className="size-4" aria-hidden /></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between gap-3 text-sm">
        <Button variant="outline" size="sm" onClick={() => onChange([...rows, blankPay()])}><Plus className="size-4" aria-hidden />Add payment row</Button>
        <span className="tabular-nums text-muted-foreground">Total {inr(payTotal(rows))}</span>
      </div>
    </div>
  )
}

/** From / To txn-date inputs for a list filter bar. */
export function DateRangeFilter({ from, to, onChange }: { from: string; to: string; onChange: (from: string, to: string) => void }) {
  return (
    <div className="flex items-end gap-2">
      <div className="space-y-1"><Label className="text-xs text-muted-foreground">From</Label><Input type="date" className="w-38" aria-label="From date" value={from} onChange={(e) => onChange(e.target.value, to)} /></div>
      <div className="space-y-1"><Label className="text-xs text-muted-foreground">To</Label><Input type="date" className="w-38" aria-label="To date" value={to} onChange={(e) => onChange(from, e.target.value)} /></div>
    </div>
  )
}

/** Payment rows for the print slips (only for split-paid documents). */
export function PaymentLines({ payments }: { payments?: TradePaymentDto[] }) {
  if (!payments?.length) return null
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Payments</div>
      {payments.map((p, i) => (
        <div key={p.id} className="flex justify-between gap-4">
          <span className="text-muted-foreground">{i + 1}. {p.mode === 'ONLINE' ? `Online${p.bankAccount ? ` (${p.bankAccount.name})` : ''}` : 'Cash'}{p.reference ? ` · ${p.reference}` : ''}</span>
          <span>{inr(p.amount)}</span>
        </div>
      ))}
    </div>
  )
}

const SKIP = new Set(['id', 'businessId', 'branchId', 'createdAt', 'updatedAt', 'createdById', 'lines', 'payments'])
const show = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v))

/** Which top-level fields an EDITED log row changed (before → after). */
function changes(meta: unknown): string[] {
  const m = meta as { before?: Record<string, unknown>; after?: Record<string, unknown> } | null
  if (!m?.before || !m.after) return []
  const out = Object.keys(m.after).filter((k) => !SKIP.has(k) && show(m.before![k]) !== show(m.after![k])).map((k) => `${k}: ${show(m.before![k])} → ${show(m.after![k])}`)
  const rows = (x: unknown) => JSON.stringify((x as Array<Record<string, unknown>> | undefined)?.map(({ id: _id, ...r }) => r) ?? [])
  if (rows(m.before.lines) !== rows(m.after.lines)) out.push('lines changed')
  if (rows(m.before.payments) !== rows(m.after.payments)) out.push('payments changed')
  return out
}

/** Who did what to one trade document, oldest first. */
export function HistoryDialog({ kind, id, title, onClose }: { kind: 'exchange' | 'buy-sell' | 'bhav-booking'; id?: number; title: string; onClose: () => void }) {
  const { data, isLoading } = useTradeHistory(kind, id)
  return (
    <Dialog open={!!id} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : !data?.length ? <p className="text-sm text-muted-foreground">No history yet.</p> : (
          <ol className="max-h-[60vh] space-y-3 overflow-y-auto text-sm">
            {data.map((h) => (
              <li key={h.id} className="rounded-xl border px-3 py-2">
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="font-medium">{h.summary}</span>
                  <span className="text-xs text-muted-foreground">{new Date(h.createdAt).toLocaleString('en-IN')}</span>
                </div>
                <div className="text-xs text-muted-foreground">{h.action.toLowerCase()} by {h.user ?? 'unknown user'}</div>
                {changes(h.meta).map((c) => <div key={c} className="text-xs tabular-nums">{c}</div>)}
              </li>
            ))}
          </ol>
        )}
      </DialogContent>
    </Dialog>
  )
}
