import { FileDown, Printer } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { MpinDialog } from '@/components/MpinDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useBankAccounts, useBusinessProfile } from '@/lib/appQueries'
import { useAuth } from '@/lib/auth'
import { useDeleteGirvi, useGirvi, useGirviInterest, useGirviRelease, useGirviTopup } from '@/lib/girviQueries'
import { useT } from '@/lib/i18n'
import { downloadPdf } from '@/lib/share'
import type { GirviBatchDto } from '@/shared'

const inr = (s: string) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(s))
const date = (s: string) => new Date(s).toLocaleDateString('en-IN')
const n = (s: string) => Number(s) || 0

function BankPay({ cash, online, bankAccountId, set }: { cash: string; online: string; bankAccountId: string; set: (k: 'cash' | 'online' | 'bankAccountId', v: string) => void }) {
  const t = useT()
  const { data: banks } = useBankAccounts()
  return (
    <>
      <div className="space-y-1.5"><Label>{t('udhari.cash')}</Label><Input type="number" aria-label="Cash" value={cash} onChange={(e) => set('cash', e.target.value)} /></div>
      <div className="space-y-1.5"><Label>{t('udhari.online')}</Label><Input type="number" aria-label="Online" value={online} onChange={(e) => set('online', e.target.value)} /></div>
      {n(online) > 0 && (
        <div className="col-span-2 space-y-1.5"><Label>{t('udhari.bank')}</Label>
          <Select value={bankAccountId} onValueChange={(v) => set('bankAccountId', v)}><SelectTrigger aria-label="Bank account"><SelectValue placeholder={t('udhari.bank')} /></SelectTrigger>
            <SelectContent>{banks?.map((b) => <SelectItem key={b.id} value={String(b.id)}>{b.bankName} · {b.accountNo}</SelectItem>)}</SelectContent></Select>
        </div>
      )}
    </>
  )
}

function InterestDialog({ batch, onClose }: { batch: GirviBatchDto; onClose: () => void }) {
  const t = useT()
  const pay = useGirviInterest()
  const [f, setF] = useState({ interest: batch.interestDue, discount: '0', cash: batch.interestDue, online: '0', bankAccountId: '' })
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }))
  const ok = n(f.interest) > 0 && (n(f.online) === 0 || f.bankAccountId)
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{t('girvi.pay_interest_title', { no: batch.girviNo })}</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">{t('girvi.interest_desc', { amount: inr(batch.interestDue) })}</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>{t('girvi.interest_inr')}</Label><Input type="number" aria-label="Interest" value={f.interest} onChange={(e) => set('interest', e.target.value)} /></div>
          <div className="space-y-1.5"><Label>{t('girvi.discount_inr')}</Label><Input type="number" aria-label="Discount" value={f.discount} onChange={(e) => set('discount', e.target.value)} /></div>
          <BankPay cash={f.cash} online={f.online} bankAccountId={f.bankAccountId} set={(k, v) => set(k, v)} />
        </div>
        <DialogFooter>
          <Button disabled={!ok || pay.isPending} onClick={async () => { await pay.mutateAsync({ id: batch.id, body: { interest: n(f.interest), discount: n(f.discount), cash: n(f.cash), online: n(f.online), bankAccountId: n(f.online) > 0 ? Number(f.bankAccountId) : undefined } }); onClose() }}>{t('girvi.pay_interest')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function TopupDialog({ batch, onClose }: { batch: GirviBatchDto; onClose: () => void }) {
  const t = useT()
  const top = useGirviTopup()
  const [f, setF] = useState({ principal: '', cash: '', online: '0', bankAccountId: '' })
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }))
  const ok = n(f.principal) > 0 && Math.abs(n(f.cash) + n(f.online) - n(f.principal)) < 0.005 && (n(f.online) === 0 || f.bankAccountId)
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{t('girvi.topup_title', { no: batch.girviNo })}</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">{t('girvi.topup_desc')}</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>{t('girvi.extra_principal')}</Label><Input type="number" aria-label="Principal" value={f.principal} onChange={(e) => set('principal', e.target.value)} /></div>
          <div />
          <BankPay cash={f.cash} online={f.online} bankAccountId={f.bankAccountId} set={(k, v) => set(k, v)} />
        </div>
        <DialogFooter>
          <Button disabled={!ok || top.isPending} onClick={async () => { await top.mutateAsync({ id: batch.id, body: { principal: n(f.principal), cash: n(f.cash), online: n(f.online), bankAccountId: n(f.online) > 0 ? Number(f.bankAccountId) : undefined } }); onClose() }}>{t('girvi.add_topup')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ReleaseDialog({ batch, onClose }: { batch: GirviBatchDto; onClose: () => void }) {
  const t = useT()
  const rel = useGirviRelease()
  const pledged = batch.items.filter((it) => it.status === 'PLEDGED')
  const [ids, setIds] = useState<Set<number>>(new Set(pledged.map((it) => it.id)))
  const [f, setF] = useState({ principalPaid: batch.principal, interestPaid: batch.interestDue, discount: '0', cash: '', online: '0', bankAccountId: '' })
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }))
  const releasingAll = ids.size === pledged.length
  const toggle = (id: number) => setIds((s) => { const x = new Set(s); if (x.has(id)) x.delete(id); else x.add(id); return x })
  const ok = ids.size > 0 && (n(f.online) === 0 || f.bankAccountId) && (!releasingAll || Math.abs(n(f.principalPaid) - Number(batch.principal)) < 0.005)
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{t('girvi.release_title', { no: batch.girviNo })}</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">{t('girvi.release_desc', { interest: inr(batch.interestDue), principal: inr(batch.principal) })}</p>
        <div className="space-y-2 rounded-2xl border bg-muted/40 p-3 text-sm">
          {pledged.map((it) => (
            <label key={it.id} className="flex items-center gap-2"><Checkbox aria-label={`Release ${it.name}`} checked={ids.has(it.id)} onCheckedChange={() => toggle(it.id)} /> {it.name} · {it.net}g · {inr(it.valuation)}</label>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>{t('girvi.principal_paid')}</Label><Input type="number" aria-label="Principal paid" value={f.principalPaid} onChange={(e) => set('principalPaid', e.target.value)} /></div>
          <div className="space-y-1.5"><Label>{t('girvi.interest_paid')}</Label><Input type="number" aria-label="Interest paid" value={f.interestPaid} onChange={(e) => set('interestPaid', e.target.value)} /></div>
          <div className="space-y-1.5"><Label>{t('girvi.discount_inr')}</Label><Input type="number" aria-label="Discount" value={f.discount} onChange={(e) => set('discount', e.target.value)} /></div>
          <div />
          <BankPay cash={f.cash} online={f.online} bankAccountId={f.bankAccountId} set={(k, v) => set(k, v)} />
        </div>
        <DialogFooter>
          <Button disabled={!ok || rel.isPending} onClick={async () => { await rel.mutateAsync({ id: batch.id, body: { itemIds: [...ids], principalPaid: n(f.principalPaid), interestPaid: n(f.interestPaid), discount: n(f.discount), cash: n(f.cash), online: n(f.online), bankAccountId: n(f.online) > 0 ? Number(f.bankAccountId) : undefined } }); onClose() }}>{ids.size === 1 ? t('girvi.release_one') : t('girvi.release_many', { n: ids.size })}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function GirviDetail() {
  const t = useT()
  const { id } = useParams()
  const { can, me } = useAuth()
  const [asOf, setAsOf] = useState('')
  const { data: batch, isLoading } = useGirvi(Number(id), asOf || undefined)
  const { data: business } = useBusinessProfile()
  const del = useDeleteGirvi()
  const [dialog, setDialog] = useState<'interest' | 'topup' | 'release' | null>(null)
  const [deleting, setDeleting] = useState(false)

  if (isLoading || !batch) return <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
  const canEdit = can('girvi.entry', 'edit')
  const canDelete = can('girvi.entry', 'delete')
  const grantOnly = batch.txns.length === 1 && batch.txns[0]?.type === 'GRANT'

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 print:hidden">
        <div className="space-y-1">
          <Link to="/app/girvi" className="text-sm font-medium text-brand-strong hover:underline">{t('girvi.back_loans')}</Link>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-bold">{t('girvi.heading', { no: batch.girviNo })}</h2>
            <Badge variant={batch.status === 'ACTIVE' ? (batch.overdue ? 'destructive' : 'secondary') : 'default'}>{batch.status}{batch.overdue && batch.status === 'ACTIVE' ? ' · OVERDUE' : ''}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{t('girvi.detail_intro')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2"><Label htmlFor="g-asof" className="text-xs text-muted-foreground">{t('girvi.as_of')}</Label><Input id="g-asof" type="date" className="w-36" value={asOf} onChange={(e) => setAsOf(e.target.value)} /></div>
          <Button size="sm" variant="outline" onClick={() => window.print()}><Printer aria-hidden />{t('udhari.print')}</Button>
          <Button size="sm" variant="outline" onClick={downloadPdf}><FileDown aria-hidden />PDF</Button>
          {canDelete && grantOnly && <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setDeleting(true)}>{t('common.delete')}</Button>}
          {canEdit && batch.status === 'ACTIVE' && <>
            <Button size="sm" variant="outline" onClick={() => setDialog('interest')}>{t('girvi.pay_interest')}</Button>
            <Button size="sm" variant="outline" onClick={() => setDialog('topup')}>{t('girvi.topup')}</Button>
            <Button size="sm" onClick={() => setDialog('release')}>{t('girvi.release')}</Button>
          </>}
        </div>
      </div>

      {/* Payable hero: screen only, a sibling of .print-area (never wrap the receipt). No action buttons here. */}
      {batch.status === 'ACTIVE' && (
        <div className="hero-card grid gap-6 p-6 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] print:hidden">
          <div className="pointer-events-none absolute -top-12 -right-12 size-40 rounded-full bg-brand/20 blur-3xl" aria-hidden />
          <div className="space-y-1">
            <div className="text-xs font-semibold uppercase tracking-widest text-white/60">{t('girvi.payable')}</div>
            <div className="text-4xl font-extrabold tabular-nums break-words">{inr(batch.payable)}</div>
            <div className="text-sm text-white/70 tabular-nums">{t('girvi.hero_breakdown', { principal: inr(batch.principal), interest: inr(batch.interestDue) })}</div>
          </div>
          <div className="space-y-2 self-end">
            <div className="flex justify-between text-xs text-white/60 tabular-nums"><span>{t('girvi.valuation')}</span><span>{inr(batch.valuation)}</span></div>
            <div className="h-3 rounded-full bg-white/10 shadow-[inset_0_2px_4px_rgb(0_0_0/0.3)]" aria-hidden>
              <div className="bar-grow h-3 rounded-full bg-gradient-to-r from-brand-strong to-brand shadow-[0_0_10px_rgb(212_175_55/0.5)]" style={{ width: `${Math.min(100, Math.max(4, (n(batch.principal) / (n(batch.valuation) || 1)) * 100))}%` }} />
            </div>
            <div className={`text-xs tabular-nums ${batch.overdue ? 'font-semibold text-red-300' : 'text-white/60'}`}>{t('girvi.due', { date: date(batch.returnDate) })}</div>
          </div>
        </div>
      )}

      <div className="print-area space-y-4 rounded-3xl border border-white/80 bg-card p-6 text-sm shadow-sm sm:p-10 dark:border-border print:rounded-none print:border-0 print:bg-transparent print:shadow-none">
        <div className="text-center"><div className="text-lg font-bold">{business?.name ?? me?.business?.name ?? t('girvi.shop')}</div><div className="font-medium">{t('girvi.receipt_title')}</div></div>
        <div className="flex flex-wrap justify-between gap-2">
          <div>{batch.party.name} · {batch.party.mobile}</div>
          <div>{t('girvi.receipt_dates', { no: batch.girviNo, issued: date(batch.issueDate), due: date(batch.returnDate) })}</div>
        </div>
        <div className="overflow-x-auto print:overflow-visible">
        <Table>
          <TableHeader><TableRow><TableHead>{t('girvi.col_item')}</TableHead><TableHead>{t('stock.col_gross')}</TableHead><TableHead>{t('stock.col_net')}</TableHead><TableHead>{t('girvi.col_purity')}</TableHead><TableHead>{t('stock.col_fine')}</TableHead><TableHead>{t('girvi.valuation')}</TableHead><TableHead>{t('stock.col_status')}</TableHead></TableRow></TableHeader>
          <TableBody>
            {batch.items.map((it) => (
              <TableRow key={it.id}><TableCell>{it.category} · {it.name}</TableCell><TableCell className="tabular-nums">{it.gross}</TableCell><TableCell className="tabular-nums">{it.net}</TableCell><TableCell className="tabular-nums">{it.purity}%</TableCell><TableCell className="tabular-nums">{it.fine}</TableCell><TableCell className="tabular-nums">{inr(it.valuation)}</TableCell><TableCell>{it.status}</TableCell></TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
        <div className="ml-auto max-w-xs space-y-1 tabular-nums">
          <div className="flex justify-between"><span className="text-muted-foreground">{t('girvi.valuation')}</span><span>{inr(batch.valuation)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">{t('girvi.principal')}</span><span>{inr(batch.principal)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">{t('girvi.interest_due_to', { date: asOf ? date(asOf) : t('girvi.today') })}</span><span>{inr(batch.interestDue)}</span></div>
          <div className="flex justify-between border-t-2 border-brand pt-2 text-base font-bold"><span>{t('girvi.payable')}</span><span>{inr(batch.payable)}</span></div>
        </div>
        <div className="text-xs text-muted-foreground">{batch.ratePercent}% / {batch.ratePeriod === 'MONTHLY' ? t('girvi.term_month') : t('girvi.term_year')} · {batch.interestType === 'SI' ? t('girvi.term_simple') : t('girvi.term_compound', { period: String(batch.ciPeriod?.toLowerCase()) })} · {batch.method === 'FULL_MONTH' ? t('girvi.term_full_month') : t('girvi.term_day_wise')} · {t('girvi.interest_from', { date: date(batch.interestFrom) })}</div>
      </div>

      {batch.txns.length > 0 && (
        <Card className="overflow-hidden text-sm print:hidden">
          <div className="border-b bg-muted/40 px-6 py-4"><h3 className="text-lg font-bold">{t('girvi.history')}</h3></div>
          <ul className="divide-y px-6 text-muted-foreground">
            {batch.txns.map((tx) => <li key={tx.id} className="py-3">{date(tx.txnDate)} · {tx.type}{Number(tx.principal) ? ` · ${t('girvi.txn_principal', { amount: inr(tx.principal) })}` : ''}{Number(tx.interest) ? ` · ${t('girvi.txn_interest', { amount: inr(tx.interest) })}` : ''}{Number(tx.discount) ? ` · ${t('girvi.txn_disc', { amount: inr(tx.discount) })}` : ''}</li>)}
          </ul>
        </Card>
      )}

      {dialog === 'interest' && <InterestDialog batch={batch} onClose={() => setDialog(null)} />}
      {dialog === 'topup' && <TopupDialog batch={batch} onClose={() => setDialog(null)} />}
      {dialog === 'release' && <ReleaseDialog batch={batch} onClose={() => setDialog(null)} />}
      <MpinDialog open={deleting} title={t('girvi.delete_title', { no: batch.girviNo })} onConfirm={(mpin) => del.mutateAsync({ id: batch.id, mpin })} onClose={() => setDeleting(false)} />
    </div>
  )
}
