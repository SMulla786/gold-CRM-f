import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { MpinDialog } from '@/components/MpinDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useBankAccounts, useBusinessProfile } from '@/lib/appQueries'
import { useAuth } from '@/lib/auth'
import { useDeleteGirvi, useGirvi, useGirviInterest, useGirviRelease, useGirviTopup } from '@/lib/girviQueries'
import { downloadPdf } from '@/lib/share'
import type { GirviBatchDto } from '@/shared'

const inr = (s: string) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(s))
const date = (s: string) => new Date(s).toLocaleDateString('en-IN')
const n = (s: string) => Number(s) || 0

function BankPay({ cash, online, bankAccountId, set }: { cash: string; online: string; bankAccountId: string; set: (k: 'cash' | 'online' | 'bankAccountId', v: string) => void }) {
  const { data: banks } = useBankAccounts()
  return (
    <>
      <div className="space-y-1.5"><Label>Cash ₹</Label><Input type="number" aria-label="Cash" value={cash} onChange={(e) => set('cash', e.target.value)} /></div>
      <div className="space-y-1.5"><Label>Online ₹</Label><Input type="number" aria-label="Online" value={online} onChange={(e) => set('online', e.target.value)} /></div>
      {n(online) > 0 && (
        <div className="col-span-2 space-y-1.5"><Label>Bank</Label>
          <Select value={bankAccountId} onValueChange={(v) => set('bankAccountId', v)}><SelectTrigger aria-label="Bank account"><SelectValue placeholder="Bank" /></SelectTrigger>
            <SelectContent>{banks?.map((b) => <SelectItem key={b.id} value={String(b.id)}>{b.bankName} · {b.accountNo}</SelectItem>)}</SelectContent></Select>
        </div>
      )}
    </>
  )
}

function InterestDialog({ batch, onClose }: { batch: GirviBatchDto; onClose: () => void }) {
  const pay = useGirviInterest()
  const [f, setF] = useState({ interest: batch.interestDue, discount: '0', cash: batch.interestDue, online: '0', bankAccountId: '' })
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }))
  const ok = n(f.interest) > 0 && (n(f.online) === 0 || f.bankAccountId)
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Pay interest · #{batch.girviNo}</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">Interest due as of today: {inr(batch.interestDue)}. Full payment moves the interest start date forward.</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>Interest ₹</Label><Input type="number" aria-label="Interest" value={f.interest} onChange={(e) => set('interest', e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Discount ₹</Label><Input type="number" aria-label="Discount" value={f.discount} onChange={(e) => set('discount', e.target.value)} /></div>
          <BankPay cash={f.cash} online={f.online} bankAccountId={f.bankAccountId} set={(k, v) => set(k, v)} />
        </div>
        <DialogFooter>
          <Button disabled={!ok || pay.isPending} onClick={async () => { await pay.mutateAsync({ id: batch.id, body: { interest: n(f.interest), discount: n(f.discount), cash: n(f.cash), online: n(f.online), bankAccountId: n(f.online) > 0 ? Number(f.bankAccountId) : undefined } }); onClose() }}>Pay interest</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function TopupDialog({ batch, onClose }: { batch: GirviBatchDto; onClose: () => void }) {
  const top = useGirviTopup()
  const [f, setF] = useState({ principal: '', cash: '', online: '0', bankAccountId: '' })
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }))
  const ok = n(f.principal) > 0 && Math.abs(n(f.cash) + n(f.online) - n(f.principal)) < 0.005 && (n(f.online) === 0 || f.bankAccountId)
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Top-up loan · #{batch.girviNo}</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">Interest must be paid up to date first, or the server will ask for it.</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>Extra principal ₹</Label><Input type="number" aria-label="Principal" value={f.principal} onChange={(e) => set('principal', e.target.value)} /></div>
          <div />
          <BankPay cash={f.cash} online={f.online} bankAccountId={f.bankAccountId} set={(k, v) => set(k, v)} />
        </div>
        <DialogFooter>
          <Button disabled={!ok || top.isPending} onClick={async () => { await top.mutateAsync({ id: batch.id, body: { principal: n(f.principal), cash: n(f.cash), online: n(f.online), bankAccountId: n(f.online) > 0 ? Number(f.bankAccountId) : undefined } }); onClose() }}>Add top-up</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ReleaseDialog({ batch, onClose }: { batch: GirviBatchDto; onClose: () => void }) {
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
        <DialogHeader><DialogTitle>Release items · #{batch.girviNo}</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">Interest due {inr(batch.interestDue)}; interest paid + discount must equal it. Releasing the last items requires full principal ({inr(batch.principal)}).</p>
        <div className="space-y-1 rounded-md border p-2 text-sm">
          {pledged.map((it) => (
            <label key={it.id} className="flex items-center gap-2"><Checkbox aria-label={`Release ${it.name}`} checked={ids.has(it.id)} onCheckedChange={() => toggle(it.id)} /> {it.name} · {it.net}g · {inr(it.valuation)}</label>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>Principal paid ₹</Label><Input type="number" aria-label="Principal paid" value={f.principalPaid} onChange={(e) => set('principalPaid', e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Interest paid ₹</Label><Input type="number" aria-label="Interest paid" value={f.interestPaid} onChange={(e) => set('interestPaid', e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Discount ₹</Label><Input type="number" aria-label="Discount" value={f.discount} onChange={(e) => set('discount', e.target.value)} /></div>
          <div />
          <BankPay cash={f.cash} online={f.online} bankAccountId={f.bankAccountId} set={(k, v) => set(k, v)} />
        </div>
        <DialogFooter>
          <Button disabled={!ok || rel.isPending} onClick={async () => { await rel.mutateAsync({ id: batch.id, body: { itemIds: [...ids], principalPaid: n(f.principalPaid), interestPaid: n(f.interestPaid), discount: n(f.discount), cash: n(f.cash), online: n(f.online), bankAccountId: n(f.online) > 0 ? Number(f.bankAccountId) : undefined } }); onClose() }}>Release {ids.size} item{ids.size === 1 ? '' : 's'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function GirviDetail() {
  const { id } = useParams()
  const { can, me } = useAuth()
  const [asOf, setAsOf] = useState('')
  const { data: batch, isLoading } = useGirvi(Number(id), asOf || undefined)
  const { data: business } = useBusinessProfile()
  const del = useDeleteGirvi()
  const [dialog, setDialog] = useState<'interest' | 'topup' | 'release' | null>(null)
  const [deleting, setDeleting] = useState(false)

  if (isLoading || !batch) return <p className="text-sm text-muted-foreground">Loading…</p>
  const canEdit = can('girvi.entry', 'edit')
  const canDelete = can('girvi.entry', 'delete')
  const grantOnly = batch.txns.length === 1 && batch.txns[0]?.type === 'GRANT'

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <Link to="/app/girvi" className="text-sm text-primary hover:underline">← Loans</Link>
        <h2 className="text-lg font-semibold">Girvi #{batch.girviNo}</h2>
        <Badge variant={batch.status === 'ACTIVE' ? (batch.overdue ? 'destructive' : 'secondary') : 'default'}>{batch.status}{batch.overdue && batch.status === 'ACTIVE' ? ' · OVERDUE' : ''}</Badge>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1"><Label htmlFor="g-asof" className="text-xs text-muted-foreground">As of</Label><Input id="g-asof" type="date" className="w-36" value={asOf} onChange={(e) => setAsOf(e.target.value)} /></div>
          {canEdit && batch.status === 'ACTIVE' && <>
            <Button size="sm" variant="outline" onClick={() => setDialog('interest')}>Pay interest</Button>
            <Button size="sm" variant="outline" onClick={() => setDialog('topup')}>Top-up</Button>
            <Button size="sm" onClick={() => setDialog('release')}>Release</Button>
          </>}
          <Button size="sm" variant="outline" onClick={() => window.print()}>Print</Button>
          <Button size="sm" variant="outline" onClick={downloadPdf}>PDF</Button>
          {canDelete && grantOnly && <Button size="sm" variant="ghost" onClick={() => setDeleting(true)}>Delete</Button>}
        </div>
      </div>

      <div className="print-area space-y-3 rounded-md border p-6 text-sm">
        <div className="text-center"><div className="text-lg font-bold">{business?.name ?? me?.business?.name ?? 'Shop'}</div><div className="font-medium">Girvi / Pledge Receipt</div></div>
        <div className="flex flex-wrap justify-between gap-2">
          <div>{batch.party.name} · {batch.party.mobile}</div>
          <div>#{batch.girviNo} · {date(batch.issueDate)} → due {date(batch.returnDate)}</div>
        </div>
        <Table>
          <TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Gross</TableHead><TableHead>Net</TableHead><TableHead>Purity</TableHead><TableHead>Fine</TableHead><TableHead>Valuation</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
          <TableBody>
            {batch.items.map((it) => (
              <TableRow key={it.id}><TableCell>{it.category} · {it.name}</TableCell><TableCell className="tabular-nums">{it.gross}</TableCell><TableCell className="tabular-nums">{it.net}</TableCell><TableCell className="tabular-nums">{it.purity}%</TableCell><TableCell className="tabular-nums">{it.fine}</TableCell><TableCell className="tabular-nums">{inr(it.valuation)}</TableCell><TableCell>{it.status}</TableCell></TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="ml-auto max-w-xs space-y-1 tabular-nums">
          <div className="flex justify-between"><span className="text-muted-foreground">Valuation</span><span>{inr(batch.valuation)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Principal</span><span>{inr(batch.principal)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Interest due (to {asOf ? date(asOf) : 'today'})</span><span>{inr(batch.interestDue)}</span></div>
          <div className="flex justify-between border-t pt-1 font-semibold"><span>Payable</span><span>{inr(batch.payable)}</span></div>
        </div>
        <div className="text-xs text-muted-foreground">{batch.ratePercent}% / {batch.ratePeriod === 'MONTHLY' ? 'month' : 'year'} · {batch.interestType === 'SI' ? 'simple' : `compound (${batch.ciPeriod?.toLowerCase()})`} · {batch.method === 'FULL_MONTH' ? 'full-month' : 'day-wise'} · interest from {date(batch.interestFrom)}</div>
      </div>

      {batch.txns.length > 0 && (
        <div className="text-sm print:hidden"><h3 className="mb-1 font-medium">History</h3>
          <ul className="space-y-0.5 text-muted-foreground">
            {batch.txns.map((t) => <li key={t.id}>{date(t.txnDate)} · {t.type}{Number(t.principal) ? ` · principal ${inr(t.principal)}` : ''}{Number(t.interest) ? ` · interest ${inr(t.interest)}` : ''}{Number(t.discount) ? ` · disc ${inr(t.discount)}` : ''}</li>)}
          </ul>
        </div>
      )}

      {dialog === 'interest' && <InterestDialog batch={batch} onClose={() => setDialog(null)} />}
      {dialog === 'topup' && <TopupDialog batch={batch} onClose={() => setDialog(null)} />}
      {dialog === 'release' && <ReleaseDialog batch={batch} onClose={() => setDialog(null)} />}
      <MpinDialog open={deleting} title={`Delete girvi #${batch.girviNo}`} onConfirm={(mpin) => del.mutateAsync({ id: batch.id, mpin })} onClose={() => setDeleting(false)} />
    </div>
  )
}
