import { CalendarClock, Inbox, PackageCheck, Wrench, Zap, type LucideIcon } from 'lucide-react'
import { useState } from 'react'

import { PartyPicker } from '@/components/PartyPicker'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useBankAccounts } from '@/lib/appQueries'
import { useAuth } from '@/lib/auth'
import { useCreateRepair, useRepairDeliver, useRepairs, useRepairStatus } from '@/lib/repairQueries'
import { businessDayISO, METALS, type PartyRefDto, type RepairTicketDto } from '@/shared'

const inr = (s: string) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(s))
const date = (s: string) => new Date(s).toLocaleDateString('en-IN')
const today = businessDayISO
const n = (s: string) => Number(s) || 0
const COLUMNS = ['RECEIVED', 'IN_PROGRESS', 'IN_REVIEW', 'READY'] as const
const COL_LABEL: Record<string, string> = { RECEIVED: 'Received', IN_PROGRESS: 'In progress', IN_REVIEW: 'In review (QA)', READY: 'Ready' }
const NEXT: Record<string, 'IN_PROGRESS' | 'IN_REVIEW'> = { RECEIVED: 'IN_PROGRESS', IN_PROGRESS: 'IN_REVIEW' }

function NewTicketDialog({ onClose }: { onClose: () => void }) {
  const create = useCreateRepair()
  const { data: banks } = useBankAccounts()
  const [party, setParty] = useState<PartyRefDto | null>(null)
  const [f, setF] = useState({ metal: 'GOLD', category: '', description: '', pcs: '1', gross: '', karatCode: '', hallmark: '', expectedDate: today(), priority: 'NORMAL', labourCharge: '0', otherCharge: '0', advanceCash: '0', advanceOnline: '0', advanceBankId: '' })
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }))
  const ok = !!party && f.category.trim() && f.description.trim().length >= 2 && n(f.gross) > 0 && f.expectedDate && (n(f.advanceOnline) === 0 || f.advanceBankId)
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>New repair ticket</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5"><Label>Customer</Label><PartyPicker value={party} onChange={setParty} ariaLabel="Customer" placeholder="Search name / mobile" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5"><Label>Metal</Label>
              <Select value={f.metal} onValueChange={(v) => set('metal', v)}><SelectTrigger aria-label="Metal"><SelectValue /></SelectTrigger>
                <SelectContent>{METALS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}<SelectItem value="OTHER">Other</SelectItem></SelectContent></Select>
            </div>
            <div className="space-y-1.5"><Label htmlFor="rt-cat">Category</Label><Input id="rt-cat" value={f.category} onChange={(e) => set('category', e.target.value)} placeholder="Ring / Chain…" /></div>
          </div>
          <div className="space-y-1.5"><Label htmlFor="rt-desc">Description</Label><Input id="rt-desc" value={f.description} onChange={(e) => set('description', e.target.value)} /></div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5"><Label htmlFor="rt-pcs">Pcs</Label><Input id="rt-pcs" type="number" value={f.pcs} onChange={(e) => set('pcs', e.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="rt-gross">Gross (g)</Label><Input id="rt-gross" type="number" step="0.001" value={f.gross} onChange={(e) => set('gross', e.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="rt-karat">Karat</Label><Input id="rt-karat" value={f.karatCode} onChange={(e) => set('karatCode', e.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="rt-exp">Expected</Label><Input id="rt-exp" type="date" value={f.expectedDate} onChange={(e) => set('expectedDate', e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Priority</Label>
              <Select value={f.priority} onValueChange={(v) => set('priority', v)}><SelectTrigger aria-label="Priority"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="NORMAL">Normal</SelectItem><SelectItem value="URGENT">Urgent</SelectItem><SelectItem value="EXPRESS">Express</SelectItem></SelectContent></Select>
            </div>
            <div className="space-y-1.5"><Label htmlFor="rt-hall">Hallmark</Label><Input id="rt-hall" value={f.hallmark} onChange={(e) => set('hallmark', e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5"><Label htmlFor="rt-lab">Labour ₹</Label><Input id="rt-lab" type="number" value={f.labourCharge} onChange={(e) => set('labourCharge', e.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="rt-oth">Other ₹</Label><Input id="rt-oth" type="number" value={f.otherCharge} onChange={(e) => set('otherCharge', e.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="rt-acash">Advance cash ₹</Label><Input id="rt-acash" type="number" value={f.advanceCash} onChange={(e) => set('advanceCash', e.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="rt-aonline">Advance online ₹</Label><Input id="rt-aonline" type="number" value={f.advanceOnline} onChange={(e) => set('advanceOnline', e.target.value)} /></div>
            {n(f.advanceOnline) > 0 && (
              <div className="col-span-2 space-y-1.5"><Label>Advance bank</Label>
                <Select value={f.advanceBankId} onValueChange={(v) => set('advanceBankId', v)}><SelectTrigger aria-label="Advance bank"><SelectValue placeholder="Bank" /></SelectTrigger>
                  <SelectContent>{banks?.map((b) => <SelectItem key={b.id} value={String(b.id)}>{b.bankName} · {b.accountNo}</SelectItem>)}</SelectContent></Select>
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button disabled={!ok || create.isPending} onClick={async () => {
            await create.mutateAsync({ partyId: party!.id, metal: f.metal, category: f.category.trim(), description: f.description.trim(), pcs: Number(f.pcs) || 1, gross: n(f.gross), karatCode: f.karatCode || undefined, hallmark: f.hallmark || undefined, expectedDate: f.expectedDate, priority: f.priority, labourCharge: n(f.labourCharge), otherCharge: n(f.otherCharge), advanceCash: n(f.advanceCash), advanceOnline: n(f.advanceOnline), advanceBankId: n(f.advanceOnline) > 0 ? Number(f.advanceBankId) : undefined })
            onClose()
          }}>Create ticket</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function QADialog({ ticket, onClose }: { ticket: RepairTicketDto; onClose: () => void }) {
  const move = useRepairStatus()
  const [finalWeight, setFinalWeight] = useState(ticket.gross)
  const [remarks, setRemarks] = useState('')
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>QA pass · ticket #{ticket.ticketNo}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5"><Label htmlFor="qa-fw">Final weight (g)</Label><Input id="qa-fw" type="number" step="0.001" value={finalWeight} onChange={(e) => setFinalWeight(e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="qa-rem">Remarks</Label><Input id="qa-rem" value={remarks} onChange={(e) => setRemarks(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button disabled={n(finalWeight) <= 0 || remarks.trim().length < 1 || move.isPending} onClick={async () => { await move.mutateAsync({ id: ticket.id, body: { status: 'READY', finalWeight: n(finalWeight), remarks: remarks.trim() } }); onClose() }}>Mark ready</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DeliverDialog({ ticket, onClose }: { ticket: RepairTicketDto; onClose: () => void }) {
  const deliver = useRepairDeliver()
  const { data: banks } = useBankAccounts()
  const [f, setF] = useState({ addedMetal: '', addedFine: '0', addedRate: '0', cash: '0', online: '0', bankAccountId: '', remarks: '' })
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }))
  const ok = (n(f.online) === 0 || f.bankAccountId) && (n(f.addedFine) === 0 || f.addedMetal)
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Deliver ticket #{ticket.ticketNo}</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">Charges so far: labour {inr(ticket.labourCharge)} + other {inr(ticket.otherCharge)}; balance est. {inr(ticket.balance)}.</p>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5"><Label>Solder metal</Label>
            <Select value={f.addedMetal || 'none'} onValueChange={(v) => set('addedMetal', v === 'none' ? '' : v)}><SelectTrigger aria-label="Solder metal"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="none">None</SelectItem>{METALS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="space-y-1.5"><Label htmlFor="dl-fine">Added fine (g)</Label><Input id="dl-fine" type="number" step="0.001" value={f.addedFine} onChange={(e) => set('addedFine', e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="dl-rate">Added rate /g</Label><Input id="dl-rate" type="number" value={f.addedRate} onChange={(e) => set('addedRate', e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="dl-cash">Cash ₹</Label><Input id="dl-cash" type="number" value={f.cash} onChange={(e) => set('cash', e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="dl-online">Online ₹</Label><Input id="dl-online" type="number" value={f.online} onChange={(e) => set('online', e.target.value)} /></div>
          {n(f.online) > 0 && (
            <div className="space-y-1.5"><Label>Bank</Label>
              <Select value={f.bankAccountId} onValueChange={(v) => set('bankAccountId', v)}><SelectTrigger aria-label="Bank account"><SelectValue placeholder="Bank" /></SelectTrigger>
                <SelectContent>{banks?.map((b) => <SelectItem key={b.id} value={String(b.id)}>{b.bankName} · {b.accountNo}</SelectItem>)}</SelectContent></Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button disabled={!ok || deliver.isPending} onClick={async () => { await deliver.mutateAsync({ id: ticket.id, body: { addedMetal: f.addedMetal || undefined, addedFine: n(f.addedFine), addedRate: n(f.addedRate), cash: n(f.cash), online: n(f.online), bankAccountId: n(f.online) > 0 ? Number(f.bankAccountId) : undefined, remarks: f.remarks || undefined } }); onClose() }}>Deliver</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function RepairBoard() {
  const { can } = useAuth()
  const canEdit = can('repair.entry', 'edit')
  const { data, isLoading } = useRepairs({ page: 1, pageSize: 100 })
  const [creating, setCreating] = useState(false)
  const [qa, setQa] = useState<RepairTicketDto | null>(null)
  const [deliver, setDeliver] = useState<RepairTicketDto | null>(null)
  const move = useRepairStatus()

  const tickets = data?.items ?? []
  const byStatus = (s: string) => tickets.filter((t) => t.status === s)

  // Summary numbers derived from the tickets already fetched (no extra requests).
  const openRows = tickets.filter((t) => (COLUMNS as readonly string[]).includes(t.status))
  const readyRows = byStatus('READY')
  const readyBalance = readyRows.reduce((sum, t) => sum + n(t.balance), 0)
  const priorityOpen = openRows.filter((t) => t.priority !== 'NORMAL').length
  const overdueOpen = openRows.filter((t) => t.expectedDate.slice(0, 10) < today()).length

  const tile = (label: string, value: string, sub: string | undefined, Icon: LucideIcon) => (
    <Card className="gap-2 hover:-translate-y-1">
      <CardHeader className="flex flex-row items-center justify-between pb-1">
        <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</CardTitle>
        <span className="icon-chip"><Icon className="size-5" aria-hidden /></span>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-extrabold tracking-tight tabular-nums">{value}</div>
        {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1>Repairs</h1>
          <p className="mt-1 text-sm text-muted-foreground">Track job-work tickets from intake through QA to handover.</p>
        </div>
        {canEdit && <Button onClick={() => setCreating(true)}>New ticket</Button>}
      </header>

      <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tile('Open tickets', data ? String(openRows.length) : '—', data ? `${tickets.length} of ${data.total} tickets loaded` : undefined, Wrench)}
        {tile('Ready for pickup', data ? String(readyRows.length) : '—', data ? `${inr(String(readyBalance))} est. to collect` : undefined, PackageCheck)}
        {tile('Urgent / express', data ? String(priorityOpen) : '—', data ? 'Open tickets with high priority' : undefined, Zap)}
        {tile('Overdue', data ? String(overdueOpen) : '—', data ? 'Open tickets past expected date' : undefined, CalendarClock)}
      </div>

      <section className="space-y-3">
        <h2 className="text-xl">Board</h2>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="stagger grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {COLUMNS.map((col) => (
              <Card key={col} className="space-y-3 p-3">
                <div className="px-1 pt-1 text-sm font-semibold">{COL_LABEL[col]} <span className="font-medium tabular-nums text-muted-foreground">({byStatus(col).length})</span></div>
                {byStatus(col).map((t) => (
                  <div key={t.id} className="space-y-1.5 rounded-2xl border bg-background p-3 text-sm shadow-xs transition-shadow hover:shadow-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">#{t.ticketNo} {t.category}</span>
                      {t.priority !== 'NORMAL' && <Badge variant="destructive">{t.priority}</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground">{t.party.name} · {t.metal} · {t.gross}g · due {date(t.expectedDate)}</div>
                    <div className="text-xs text-muted-foreground">{t.description}</div>
                    {canEdit && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {NEXT[col] && <Button size="xs" variant="outline" onClick={() => move.mutate({ id: t.id, body: { status: NEXT[col] } })}>→ {COL_LABEL[NEXT[col]]}</Button>}
                        {col === 'IN_REVIEW' && <Button size="xs" onClick={() => setQa(t)}>Pass QA</Button>}
                        {col === 'READY' && <Button size="xs" onClick={() => setDeliver(t)}>Deliver</Button>}
                        <Button size="xs" variant="ghost" onClick={() => move.mutate({ id: t.id, body: { status: 'CANCELLED' } })}>Cancel</Button>
                      </div>
                    )}
                  </div>
                ))}
                {byStatus(col).length === 0 && (
                  <div className="flex flex-col items-center gap-2 px-1 py-6 text-center">
                    <span className="icon-chip"><Inbox className="size-5" aria-hidden /></span>
                    <p className="text-xs text-muted-foreground">—</p>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground">Delivered: {byStatus('DELIVERED').length} · Cancelled: {byStatus('CANCELLED').length}</p>
      </section>

      {creating && <NewTicketDialog onClose={() => setCreating(false)} />}
      {qa && <QADialog ticket={qa} onClose={() => setQa(null)} />}
      {deliver && <DeliverDialog ticket={deliver} onClose={() => setDeliver(null)} />}
    </div>
  )
}
