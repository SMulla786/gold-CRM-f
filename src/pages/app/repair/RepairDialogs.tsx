import { Camera, ImagePlus, Printer } from 'lucide-react'
import { useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { AuthedImage } from '@/components/AuthedImage'
import { CaptureDialog, PartyImagePicker } from '@/components/PartyImagePicker'
import { PartyPicker } from '@/components/PartyPicker'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useBankAccounts, useKarats } from '@/lib/appQueries'
import { useAuth } from '@/lib/auth'
import { repairPhotoPath, useCreateRepair, useRepair, useRepairDeliver, useRepairStatus, useUploadRepairPhoto } from '@/lib/repairQueries'
import { businessDayISO, METALS, type PartyRefDto, type RepairTicketDto } from '@/shared'

import { addedMetalLabel, addedValue, date, estCharge, inr, n, REPAIR_CATEGORIES, REPAIR_SUB_CATEGORIES, STATUS_LABEL } from './repairUtils'

const today = businessDayISO
// Same look as <Input>, multi-line (no Textarea primitive in components/ui).
const TEXTAREA = 'flex min-h-16 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground hover:border-ring/50 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50'

export function NewTicketDialog({ onClose }: { onClose: () => void }) {
  const create = useCreateRepair()
  const uploadPhoto = useUploadRepairPhoto()
  const [photo, setPhoto] = useState<File | null>(null)
  const { data: banks } = useBankAccounts()
  const { data: karats } = useKarats()
  const [party, setParty] = useState<PartyRefDto | null>(null)
  const [karigar, setKarigar] = useState<PartyRefDto | null>(null)
  const [f, setF] = useState({ metal: 'GOLD', category: '', description: '', pcs: '1', gross: '', net: '', karatCode: '', hallmark: '', purity: '', subCategory: '', expectedDate: today(), priority: 'NORMAL', labourCharge: '0', otherCharge: '0', advanceCash: '0', advanceOnline: '0', advanceBankId: '' })
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }))
  const karatOptions = (karats ?? []).filter((k) => f.metal === 'OTHER' || k.metal === f.metal)
  const netOk = f.net === '' || (n(f.net) > 0 && n(f.net) <= n(f.gross))
  const purityOk = f.purity === '' || (Number(f.purity) >= 0 && Number(f.purity) <= 100)
  const ok = !!party && f.category.trim() && f.description.trim().length >= 2 && n(f.gross) > 0 && netOk && purityOk && f.expectedDate && (n(f.advanceOnline) === 0 || f.advanceBankId)
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>New repair ticket</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5"><Label>Customer</Label><PartyPicker value={party} onChange={setParty} ariaLabel="Customer" placeholder="Search name / mobile" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5"><Label>Metal</Label>
              <Select value={f.metal} onValueChange={(v) => setF((s) => ({ ...s, metal: v, karatCode: '' }))}><SelectTrigger aria-label="Metal"><SelectValue /></SelectTrigger>
                <SelectContent>{METALS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}<SelectItem value="OTHER">Other</SelectItem></SelectContent></Select>
            </div>
            {/* free text (contract field) with a pick-list of the usual categories */}
            <div className="space-y-1.5"><Label htmlFor="rt-cat">Category</Label><Input id="rt-cat" list="rt-cat-list" autoComplete="off" value={f.category} onChange={(e) => set('category', e.target.value)} placeholder="Ring / Chain…" />
              <datalist id="rt-cat-list">{REPAIR_CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5"><Label htmlFor="rt-subcat">Sub-category</Label><Input id="rt-subcat" list="rt-subcat-list" autoComplete="off" maxLength={40} value={f.subCategory} onChange={(e) => set('subCategory', e.target.value)} placeholder="optional" />
              <datalist id="rt-subcat-list">{REPAIR_SUB_CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist>
            </div>
            <div className="space-y-1.5"><Label htmlFor="rt-purity">Purity %</Label><Input id="rt-purity" type="number" min={0} max={100} step="0.01" value={f.purity} aria-invalid={!purityOk || undefined} onChange={(e) => set('purity', e.target.value)} placeholder="optional, e.g. 91.6" /></div>
          </div>
          {!purityOk && <p className="text-xs text-destructive">Purity must be between 0 and 100.</p>}
          <div className="space-y-1.5"><Label htmlFor="rt-desc">Description</Label><Input id="rt-desc" value={f.description} onChange={(e) => set('description', e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="rt-karigar">Karigar (optional)</Label><PartyPicker id="rt-karigar" value={karigar} onChange={setKarigar} type="KARIGAR" ariaLabel="Karigar" placeholder="Search karigar" /></div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5"><Label htmlFor="rt-pcs">Pcs</Label><Input id="rt-pcs" type="number" value={f.pcs} onChange={(e) => set('pcs', e.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="rt-gross">Gross (g)</Label><Input id="rt-gross" type="number" step="0.001" value={f.gross} onChange={(e) => set('gross', e.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="rt-net">Net (g)</Label><Input id="rt-net" type="number" step="0.001" value={f.net} aria-invalid={!netOk || undefined} onChange={(e) => set('net', e.target.value)} placeholder="optional" /></div>
            <div className="space-y-1.5"><Label htmlFor="rt-karat">Karat</Label>
              <Select value={f.karatCode || 'none'} onValueChange={(v) => set('karatCode', v === 'none' ? '' : v)}><SelectTrigger id="rt-karat"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="none">—</SelectItem>{karatOptions.map((k) => <SelectItem key={k.id} value={k.code}>{k.title}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="space-y-1.5"><Label htmlFor="rt-exp">Expected</Label><Input id="rt-exp" type="date" value={f.expectedDate} onChange={(e) => set('expectedDate', e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Priority</Label>
              <Select value={f.priority} onValueChange={(v) => set('priority', v)}><SelectTrigger aria-label="Priority"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="NORMAL">Normal</SelectItem><SelectItem value="URGENT">Urgent</SelectItem><SelectItem value="EXPRESS">Express</SelectItem></SelectContent></Select>
            </div>
            <div className="space-y-1.5"><Label htmlFor="rt-hall">Hallmark</Label><Input id="rt-hall" value={f.hallmark} onChange={(e) => set('hallmark', e.target.value)} /></div>
          </div>
          {!netOk && <p className="text-xs text-destructive">Net weight must be more than 0 and not above gross.</p>}
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
          <PartyImagePicker label="Ornament photo" kind="photo" value={photo} onChange={setPhoto} camera />
        </div>
        <DialogFooter>
          <Button disabled={!ok || create.isPending || uploadPhoto.isPending} onClick={async () => {
            const t = await create.mutateAsync({ partyId: party!.id, metal: f.metal, category: f.category.trim(), description: f.description.trim(), purity: f.purity === '' ? undefined : Number(f.purity), subCategory: f.subCategory.trim() || undefined, pcs: Number(f.pcs) || 1, gross: n(f.gross), net: n(f.net) > 0 ? n(f.net) : undefined, karatCode: f.karatCode || undefined, hallmark: f.hallmark || undefined, expectedDate: f.expectedDate, priority: f.priority, karigarId: karigar?.id, labourCharge: n(f.labourCharge), otherCharge: n(f.otherCharge), advanceCash: n(f.advanceCash), advanceOnline: n(f.advanceOnline), advanceBankId: n(f.advanceOnline) > 0 ? Number(f.advanceBankId) : undefined })
            // the ticket exists now: a failed photo upload (toast shown) must not leave the form open for a duplicate create
            if (photo) await uploadPhoto.mutateAsync({ id: t.id, file: photo }).catch(() => {})
            onClose()
          }}>Create ticket</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const QA_QUICK_REMARKS = ['Polish OK', 'Stone set checked', 'Solder joint OK', 'Weight verified', 'Clasp working', 'Rework needed']
/** Appends a quick remark to the free-text remarks (comma separated), skipping duplicates and keeping the 300-character limit. */
const appendRemark = (current: string, add: string) => {
  const base = current.trim().replace(/[,.;]\s*$/, '')
  if (base.toLowerCase().split(/,\s*/).includes(add.toLowerCase())) return current
  return (base ? `${base}, ${add}` : add).slice(0, 300)
}

export function QADialog({ ticket, onClose }: { ticket: RepairTicketDto; onClose: () => void }) {
  const move = useRepairStatus()
  const [finalWeight, setFinalWeight] = useState(ticket.gross)
  const [remarks, setRemarks] = useState('')
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>QA pass · ticket #{ticket.ticketNo}</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">Received at {ticket.gross} g gross{ticket.net ? ` · ${ticket.net} g net` : ''}{ticket.karatCode ? ` · ${ticket.karatCode}` : ''}{ticket.karigar ? ` · karigar ${ticket.karigar.name}` : ''}.</p>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5"><Label htmlFor="qa-fw">Final weight (g)</Label><Input id="qa-fw" type="number" step="0.001" value={finalWeight} onChange={(e) => setFinalWeight(e.target.value)} /></div>
          <div className="col-span-2 space-y-1.5"><Label htmlFor="qa-rem">Remarks</Label><textarea id="qa-rem" rows={3} maxLength={300} className={TEXTAREA} value={remarks} onChange={(e) => setRemarks(e.target.value)} /></div>
          <div className="col-span-2 space-y-1.5">
            <p className="text-xs text-muted-foreground">Quick remarks (tap to add)</p>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Quick remarks">
              {QA_QUICK_REMARKS.map((r) => (
                <Button key={r} type="button" size="sm" variant="outline" className="h-7 rounded-full px-3 text-xs" onClick={() => setRemarks((s) => appendRemark(s, r))}>{r}</Button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button disabled={n(finalWeight) <= 0 || remarks.trim().length < 1 || move.isPending} onClick={async () => { await move.mutateAsync({ id: ticket.id, body: { status: 'READY', finalWeight: n(finalWeight), remarks: remarks.trim() } }); onClose() }}>Mark ready</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function DeliverDialog({ ticket, onClose }: { ticket: RepairTicketDto; onClose: () => void }) {
  const deliver = useRepairDeliver()
  const { data: banks } = useBankAccounts()
  const { data: karats } = useKarats()
  const [f, setF] = useState({ addedMetal: '', addedKaratCode: '', addedFine: '0', addedRate: '0', cash: '0', online: '0', bankAccountId: '', remarks: '' })
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }))
  const ok = (n(f.online) === 0 || f.bankAccountId) && (n(f.addedFine) === 0 || f.addedMetal)
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Deliver ticket #{ticket.ticketNo}</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">Charges so far: labour {inr(ticket.labourCharge)} + other {inr(ticket.otherCharge)}; balance est. {inr(ticket.balance)}.</p>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5"><Label>Solder metal</Label>
            <Select value={f.addedMetal || 'none'} onValueChange={(v) => setF((s) => ({ ...s, addedMetal: v === 'none' ? '' : v, addedKaratCode: '' }))}><SelectTrigger aria-label="Solder metal"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="none">None</SelectItem>{METALS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}<SelectItem value="OTHER">Other</SelectItem></SelectContent></Select>
          </div>
          {(f.addedMetal === 'GOLD' || f.addedMetal === 'SILVER') && (
            <div className="space-y-1.5"><Label>Solder karat</Label>
              <Select value={f.addedKaratCode || 'none'} onValueChange={(v) => set('addedKaratCode', v === 'none' ? '' : v)}><SelectTrigger aria-label="Solder karat"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="none">—</SelectItem>{(karats ?? []).filter((k) => k.metal === f.addedMetal).map((k) => <SelectItem key={k.id} value={k.code}>{k.title}</SelectItem>)}</SelectContent></Select>
            </div>
          )}
          {f.addedMetal === 'OTHER' && <p className="col-span-2 text-xs text-muted-foreground">Other metal is charged at the rate below but is not taken out of shop stock.</p>}
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
          <div className="col-span-2 space-y-1.5"><Label htmlFor="dl-rem">Remarks</Label><Input id="dl-rem" maxLength={300} value={f.remarks} onChange={(e) => set('remarks', e.target.value)} placeholder="Optional; replaces the QA remarks" /></div>
        </div>
        <DialogFooter>
          <Button disabled={!ok || deliver.isPending} onClick={async () => { await deliver.mutateAsync({ id: ticket.id, body: { addedMetal: f.addedMetal || undefined, addedKaratCode: f.addedKaratCode || undefined, addedFine: n(f.addedFine), addedRate: n(f.addedRate), cash: n(f.cash), online: n(f.online), bankAccountId: n(f.online) > 0 ? Number(f.bankAccountId) : undefined, remarks: f.remarks.trim() || undefined } }); onClose() }}>Deliver</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** RECEIVED → assigns and moves to In progress; IN_PROGRESS / IN_REVIEW → reassigns in place. */
export function AssignKarigarDialog({ ticket, onClose }: { ticket: RepairTicketDto; onClose: () => void }) {
  const move = useRepairStatus()
  const [karigar, setKarigar] = useState<PartyRefDto | null>(null)
  const starts = ticket.status === 'RECEIVED'
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Assign karigar · ticket #{ticket.ticketNo}</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">
          {ticket.karigar ? `Now with ${ticket.karigar.name}. ` : 'No karigar yet. '}
          {starts ? 'Assigning also moves the ticket to In progress.' : 'The ticket stays in its current column.'}
        </p>
        <div className="space-y-1.5"><Label htmlFor="ak-karigar">Karigar</Label><PartyPicker id="ak-karigar" value={karigar} onChange={setKarigar} type="KARIGAR" ariaLabel="Karigar" placeholder="Search karigar" /></div>
        <DialogFooter>
          <Button disabled={!karigar || move.isPending} onClick={async () => {
            await move.mutateAsync({ id: ticket.id, body: { status: starts ? 'IN_PROGRESS' : ticket.status, karigarId: karigar!.id } })
            onClose()
          }}>{starts ? 'Assign and start' : 'Assign'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Field({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? 'col-span-2 space-y-0.5' : 'space-y-0.5'}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="break-words text-sm font-medium">{children}</dd>
    </div>
  )
}

/** Read-only ticket view from GET /app/repairs/:id (always fresh, also for delivered/cancelled tickets). */
export function TicketDetailsDialog({ id, onClose }: { id: number; onClose: () => void }) {
  const { data: t, isLoading } = useRepair(id)
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Repair ticket{t ? ` #${t.ticketNo}` : ''}</DialogTitle></DialogHeader>
        {isLoading || !t ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={t.status === 'CANCELLED' ? 'secondary' : t.status === 'DELIVERED' ? 'outline' : 'default'}>{STATUS_LABEL[t.status]}</Badge>
              {t.priority !== 'NORMAL' && <Badge variant="destructive">{t.priority}</Badge>}
            </div>
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Customer</h3>
              <dl className="grid grid-cols-2 gap-3">
                <Field label="Name">{t.party.name}</Field>
                <Field label="Mobile">{t.party.mobile}</Field>
                {t.party.shopName && <Field label="Shop" wide>{t.party.shopName}</Field>}
              </dl>
            </section>
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Ornament</h3>
              <dl className="grid grid-cols-2 gap-3">
                <Field label="Category">{t.category}{t.subCategory ? ` · ${t.subCategory}` : ''}</Field>
                <Field label="Metal">{t.metal}{t.karatCode ? ` · ${t.karatCode}` : ''}{t.purity ? ` · ${t.purity}%` : ''}</Field>
                <Field label="Pieces">{t.pcs}</Field>
                <Field label="Hallmark">{t.hallmark ?? '—'}</Field>
                <Field label="Gross weight">{t.gross} g</Field>
                <Field label="Net weight">{t.net ? `${t.net} g` : '—'}</Field>
                <Field label="Final weight">{t.finalWeight ? `${t.finalWeight} g` : '—'}</Field>
                <Field label="Karigar">{t.karigar?.name ?? '—'}</Field>
                <Field label="Job" wide>{t.description}</Field>
                <Field label="Remarks" wide>{t.remarks ?? '—'}</Field>
                <Field label="Photo" wide><RepairPhoto ticket={t} /></Field>
              </dl>
            </section>
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Charges and dates</h3>
              <dl className="grid grid-cols-2 gap-3 tabular-nums">
                <Field label="Labour">{inr(t.labourCharge)}</Field>
                <Field label="Other">{inr(t.otherCharge)}</Field>
                <Field label="Est. charge">{inr(estCharge(t))}</Field>
                <Field label="Advance paid">{inr(t.advance)}</Field>
                <Field label={t.status === 'DELIVERED' ? 'Balance to party' : 'Balance (est.)'}>{inr(t.balance)}</Field>
                <Field label="Received on">{date(t.createdAt)}</Field>
                <Field label="Expected">{date(t.expectedDate)}</Field>
                <Field label="Delivered on">{t.deliveredAt ? date(t.deliveredAt) : '—'}</Field>
              </dl>
            </section>
            {t.status === 'DELIVERED' && (
              <section className="space-y-2">
                <h3 className="text-sm font-semibold">Settlement</h3>
                <dl className="grid grid-cols-2 gap-3 tabular-nums">
                  <Field label="Metal added">{n(t.addedFine ?? '0') > 0 ? `${addedMetalLabel(t)} · ${t.addedFine} g @ ${inr(t.addedRate ?? '0')}/g` : '—'}</Field>
                  <Field label="Metal value">{inr(addedValue(t))}</Field>
                  <Field label="Paid cash">{inr(t.deliveryCash ?? '0')}</Field>
                  <Field label="Paid online">{inr(t.deliveryOnline ?? '0')}{t.deliveryBank ? ` · ${t.deliveryBank.name}` : ''}</Field>
                </dl>
              </section>
            )}
          </div>
        )}
        <DialogFooter>
          <Button asChild variant="outline"><Link to={`/app/repair/slip/${id}`}><Printer aria-hidden />Print slip</Link></Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Ticket photo: thumbnail + upload / capture for repair.entry editors (uploads immediately). Re-upload changes photoUrl, which remounts the image. */
export function RepairPhoto({ ticket }: { ticket: RepairTicketDto }) {
  const { can } = useAuth()
  const upload = useUploadRepairPhoto()
  const [capturing, setCapturing] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const save = async (file: File | undefined) => {
    if (!file) return
    await upload.mutateAsync({ id: ticket.id, file }).catch(() => {})
    if (input.current) input.current.value = ''
  }
  return (
    <div className="flex items-center gap-3">
      <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl border bg-muted">
        {ticket.photoUrl ? <AuthedImage key={ticket.photoUrl} path={repairPhotoPath(ticket.id)} alt={`Ticket #${ticket.ticketNo} photo`} className="size-full object-cover" /> : <ImagePlus className="size-5 text-muted-foreground" aria-hidden />}
      </div>
      {can('repair.entry', 'edit') && (
        <div className="flex flex-wrap gap-2">
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" aria-label="Ticket photo file" onChange={(e) => void save(e.target.files?.[0])} />
          <Button type="button" variant="outline" size="sm" disabled={upload.isPending} onClick={() => input.current?.click()}><ImagePlus className="size-4" aria-hidden />{ticket.photoUrl ? 'Replace photo' : 'Upload photo'}</Button>
          <Button type="button" variant="outline" size="sm" disabled={upload.isPending} onClick={() => setCapturing(true)}><Camera className="size-4" aria-hidden />Capture</Button>
        </div>
      )}
      {capturing && <CaptureDialog onCapture={(f) => void save(f)} onClose={() => setCapturing(false)} />}
    </div>
  )
}

/** Small read-only thumbnail for board cards and ledger rows (nothing when the ticket has no photo). */
export function RepairThumb({ ticket }: { ticket: RepairTicketDto }) {
  return ticket.photoUrl ? <AuthedImage key={ticket.photoUrl} path={repairPhotoPath(ticket.id)} alt={`Ticket #${ticket.ticketNo} photo`} className="size-10 shrink-0 rounded-md border object-cover" /> : null
}
