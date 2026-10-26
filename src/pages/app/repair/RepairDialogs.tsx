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
import { useT } from '@/lib/i18n'
import { repairPhotoPath, useCreateRepair, useRepair, useRepairDeliver, useRepairReject, useRepairStatus, useUploadRepairPhoto } from '@/lib/repairQueries'
import { businessDayISO, METALS, type PartyRefDto, type RepairTicketDto } from '@/shared'

import { addedMetalLabel, addedValue, date, estCharge, inr, n, REPAIR_CATEGORIES, REPAIR_SUB_CATEGORIES, STATUS_KEY } from './repairUtils'

const today = businessDayISO
// Same look as <Input>, multi-line (no Textarea primitive in components/ui).
const TEXTAREA = 'flex min-h-16 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground hover:border-ring/50 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50'

export function NewTicketDialog({ onClose }: { onClose: () => void }) {
  const t = useT()
  const create = useCreateRepair()
  const uploadPhoto = useUploadRepairPhoto()
  const [photo, setPhoto] = useState<File | null>(null)
  const { data: banks } = useBankAccounts()
  const { data: karats } = useKarats()
  const [party, setParty] = useState<PartyRefDto | null>(null)
  const [karigar, setKarigar] = useState<PartyRefDto | null>(null)
  const [f, setF] = useState({ metal: 'GOLD', category: '', description: '', pcs: '1', gross: '', net: '', karatCode: '', hallmark: '', purity: '', subCategory: '', expectedDate: today(), priority: 'NORMAL', labourCharge: '0', otherCharge: '0', advanceCash: '0', advanceOnline: '0', advanceBankId: '', initialStatus: 'RECEIVED' })
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }))
  const karatOptions = (karats ?? []).filter((k) => f.metal === 'OTHER' || k.metal === f.metal)
  const netOk = f.net === '' || (n(f.net) > 0 && n(f.net) <= n(f.gross))
  const purityOk = f.purity === '' || (Number(f.purity) >= 0 && Number(f.purity) <= 100)
  // starting In progress (work begins at intake) needs a karigar — the server enforces the same
  const statusOk = f.initialStatus === 'RECEIVED' || !!karigar
  const ok = !!party && f.category.trim() && f.description.trim().length >= 2 && n(f.gross) > 0 && netOk && purityOk && statusOk && f.expectedDate && (n(f.advanceOnline) === 0 || f.advanceBankId)
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{t('repair.new_title')}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5"><Label>{t('bill.customer')}</Label><PartyPicker value={party} onChange={setParty} ariaLabel="Customer" placeholder={t('bill.search_party')} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5"><Label>{t('udhari.metal')}</Label>
              <Select value={f.metal} onValueChange={(v) => setF((s) => ({ ...s, metal: v, karatCode: '' }))}><SelectTrigger aria-label="Metal"><SelectValue /></SelectTrigger>
                <SelectContent>{METALS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}<SelectItem value="OTHER">{t('bill.col_other')}</SelectItem></SelectContent></Select>
            </div>
            {/* free text (contract field) with a pick-list of the usual categories */}
            <div className="space-y-1.5"><Label htmlFor="rt-cat">{t('girvi.col_category')}</Label><Input id="rt-cat" list="rt-cat-list" autoComplete="off" value={f.category} onChange={(e) => set('category', e.target.value)} placeholder={t('repair.category_ph')} />
              <datalist id="rt-cat-list">{REPAIR_CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5"><Label htmlFor="rt-subcat">{t('repair.sub_category')}</Label><Input id="rt-subcat" list="rt-subcat-list" autoComplete="off" maxLength={40} value={f.subCategory} onChange={(e) => set('subCategory', e.target.value)} placeholder={t('repair.optional')} />
              <datalist id="rt-subcat-list">{REPAIR_SUB_CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist>
            </div>
            <div className="space-y-1.5"><Label htmlFor="rt-purity">{t('girvi.purity_pct')}</Label><Input id="rt-purity" type="number" min={0} max={100} step="0.01" value={f.purity} aria-invalid={!purityOk || undefined} onChange={(e) => set('purity', e.target.value)} placeholder={t('repair.purity_ph')} /></div>
          </div>
          {!purityOk && <p className="text-xs text-destructive">{t('repair.purity_error')}</p>}
          <div className="space-y-1.5"><Label htmlFor="rt-desc">{t('bill.description')}</Label><Input id="rt-desc" value={f.description} onChange={(e) => set('description', e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="rt-karigar">{t('repair.karigar_optional')}</Label><PartyPicker id="rt-karigar" value={karigar} onChange={setKarigar} type="KARIGAR" ariaLabel="Karigar" placeholder={t('repair.search_karigar')} /></div>
          <div className="space-y-1.5"><Label htmlFor="rt-status">{t('repair.initial_status')}</Label>
            <Select value={f.initialStatus} onValueChange={(v) => set('initialStatus', v)}><SelectTrigger id="rt-status" className="w-full sm:w-56"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="RECEIVED">{t(STATUS_KEY.RECEIVED)}</SelectItem><SelectItem value="IN_PROGRESS">{t(STATUS_KEY.IN_PROGRESS)}</SelectItem></SelectContent></Select>
            {f.initialStatus === 'IN_PROGRESS' && <p className={statusOk ? 'text-xs text-muted-foreground' : 'text-xs text-destructive'}>{t('repair.initial_status_hint')}</p>}
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5"><Label htmlFor="rt-pcs">{t('stock.col_pcs')}</Label><Input id="rt-pcs" type="number" value={f.pcs} onChange={(e) => set('pcs', e.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="rt-gross">{t('girvi.gross_g')}</Label><Input id="rt-gross" type="number" step="0.001" value={f.gross} onChange={(e) => set('gross', e.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="rt-net">{t('girvi.net_g')}</Label><Input id="rt-net" type="number" step="0.001" value={f.net} aria-invalid={!netOk || undefined} onChange={(e) => set('net', e.target.value)} placeholder={t('repair.optional')} /></div>
            <div className="space-y-1.5"><Label htmlFor="rt-karat">{t('stock.col_karat')}</Label>
              <Select value={f.karatCode || 'none'} onValueChange={(v) => set('karatCode', v === 'none' ? '' : v)}><SelectTrigger id="rt-karat"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="none">—</SelectItem>{karatOptions.map((k) => <SelectItem key={k.id} value={k.code}>{k.title}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="space-y-1.5"><Label htmlFor="rt-exp">{t('repair.expected')}</Label><Input id="rt-exp" type="date" value={f.expectedDate} onChange={(e) => set('expectedDate', e.target.value)} /></div>
            <div className="space-y-1.5"><Label>{t('repair.priority')}</Label>
              <Select value={f.priority} onValueChange={(v) => set('priority', v)}><SelectTrigger aria-label="Priority"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="NORMAL">{t('repair.pri_normal')}</SelectItem><SelectItem value="URGENT">{t('repair.pri_urgent')}</SelectItem><SelectItem value="EXPRESS">{t('repair.pri_express')}</SelectItem></SelectContent></Select>
            </div>
            <div className="space-y-1.5"><Label htmlFor="rt-hall">{t('repair.hallmark')}</Label><Input id="rt-hall" value={f.hallmark} onChange={(e) => set('hallmark', e.target.value)} /></div>
          </div>
          {!netOk && <p className="text-xs text-destructive">{t('repair.net_error')}</p>}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5"><Label htmlFor="rt-lab">{t('repair.labour_inr')}</Label><Input id="rt-lab" type="number" value={f.labourCharge} onChange={(e) => set('labourCharge', e.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="rt-oth">{t('repair.other_inr')}</Label><Input id="rt-oth" type="number" value={f.otherCharge} onChange={(e) => set('otherCharge', e.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="rt-acash">{t('repair.adv_cash')}</Label><Input id="rt-acash" type="number" value={f.advanceCash} onChange={(e) => set('advanceCash', e.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="rt-aonline">{t('repair.adv_online')}</Label><Input id="rt-aonline" type="number" value={f.advanceOnline} onChange={(e) => set('advanceOnline', e.target.value)} /></div>
            {n(f.advanceOnline) > 0 && (
              <div className="col-span-2 space-y-1.5"><Label>{t('repair.adv_bank')}</Label>
                <Select value={f.advanceBankId} onValueChange={(v) => set('advanceBankId', v)}><SelectTrigger aria-label="Advance bank"><SelectValue placeholder={t('bill.bank')} /></SelectTrigger>
                  <SelectContent>{banks?.map((b) => <SelectItem key={b.id} value={String(b.id)}>{b.bankName} · {b.accountNo}</SelectItem>)}</SelectContent></Select>
              </div>
            )}
          </div>
          <PartyImagePicker label={t('repair.ornament_photo')} kind="photo" value={photo} onChange={setPhoto} camera />
        </div>
        <DialogFooter>
          <Button disabled={!ok || create.isPending || uploadPhoto.isPending} onClick={async () => {
            const created = await create.mutateAsync({ partyId: party!.id, metal: f.metal, category: f.category.trim(), description: f.description.trim(), purity: f.purity === '' ? undefined : Number(f.purity), subCategory: f.subCategory.trim() || undefined, pcs: Number(f.pcs) || 1, gross: n(f.gross), net: n(f.net) > 0 ? n(f.net) : undefined, karatCode: f.karatCode || undefined, hallmark: f.hallmark || undefined, expectedDate: f.expectedDate, priority: f.priority, karigarId: karigar?.id, labourCharge: n(f.labourCharge), otherCharge: n(f.otherCharge), advanceCash: n(f.advanceCash), advanceOnline: n(f.advanceOnline), advanceBankId: n(f.advanceOnline) > 0 ? Number(f.advanceBankId) : undefined, initialStatus: f.initialStatus })
            // the ticket exists now: a failed photo upload (toast shown) must not leave the form open for a duplicate create
            if (photo) await uploadPhoto.mutateAsync({ id: created.id, file: photo }).catch(() => {})
            onClose()
          }}>{t('repair.create_ticket')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// i18n keys; the translated text is what gets appended to the remarks.
const QA_QUICK_REMARKS = ['repair.qa_polish_ok', 'repair.qa_stone_checked', 'repair.qa_solder_ok', 'repair.qa_weight_verified', 'repair.qa_clasp_working', 'repair.qa_rework']
/** Appends a quick remark to the free-text remarks (comma separated), skipping duplicates and keeping the 300-character limit. */
const appendRemark = (current: string, add: string) => {
  const base = current.trim().replace(/[,.;]\s*$/, '')
  if (base.toLowerCase().split(/,\s*/).includes(add.toLowerCase())) return current
  return (base ? `${base}, ${add}` : add).slice(0, 300)
}

export function QADialog({ ticket, onClose }: { ticket: RepairTicketDto; onClose: () => void }) {
  const t = useT()
  const move = useRepairStatus()
  const reject = useRepairReject()
  const [finalWeight, setFinalWeight] = useState(ticket.gross)
  const [remarks, setRemarks] = useState('')
  // "Return to bench": the one backward move (IN_REVIEW → IN_PROGRESS), needs a reason
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{t('repair.qa_title', { no: ticket.ticketNo })}</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">{t('repair.qa_received', { gross: ticket.gross, rest: `${ticket.net ? t('repair.qa_net', { net: ticket.net }) : ''}${ticket.karatCode ? ` · ${ticket.karatCode}` : ''}${ticket.karigar ? t('repair.qa_karigar', { name: ticket.karigar.name }) : ''}` })}</p>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5"><Label htmlFor="qa-fw">{t('repair.final_weight_g')}</Label><Input id="qa-fw" type="number" step="0.001" value={finalWeight} onChange={(e) => setFinalWeight(e.target.value)} /></div>
          <div className="col-span-2 space-y-1.5"><Label htmlFor="qa-rem">{t('oldmetal.col_remarks')}</Label><textarea id="qa-rem" rows={3} maxLength={300} className={TEXTAREA} value={remarks} onChange={(e) => setRemarks(e.target.value)} /></div>
          <div className="col-span-2 space-y-1.5">
            <p className="text-xs text-muted-foreground">{t('repair.quick_remarks')}</p>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Quick remarks">
              {QA_QUICK_REMARKS.map((r) => (
                <Button key={r} type="button" size="sm" variant="outline" className="h-7 rounded-full px-3 text-xs" onClick={() => setRemarks((s) => appendRemark(s, t(r)))}>{t(r)}</Button>
              ))}
            </div>
          </div>
        </div>
        {rejecting && (
          <div className="space-y-1.5 rounded-xl border border-destructive/40 bg-destructive/5 p-3">
            <Label htmlFor="qa-reject-reason">{t('repair.return_reason')}</Label>
            <textarea id="qa-reject-reason" rows={2} maxLength={300} className={TEXTAREA} value={reason} placeholder={t('repair.return_reason_ph')} onChange={(e) => setReason(e.target.value)} />
            <p className="text-xs text-muted-foreground">{t('repair.return_note')}</p>
          </div>
        )}
        <DialogFooter>
          {rejecting ? (
            <>
              <Button variant="outline" onClick={() => setRejecting(false)}>{t('common.cancel')}</Button>
              <Button variant="destructive" disabled={reason.trim().length < 1 || reject.isPending} onClick={async () => { await reject.mutateAsync({ id: ticket.id, remarks: reason.trim() }); onClose() }}>{t('repair.return_bench')}</Button>
            </>
          ) : (
            <>
              <Button variant="outline" disabled={move.isPending} onClick={() => setRejecting(true)}>{t('repair.return_bench')}</Button>
              <Button disabled={n(finalWeight) <= 0 || remarks.trim().length < 1 || move.isPending} onClick={async () => { await move.mutateAsync({ id: ticket.id, body: { status: 'READY', finalWeight: n(finalWeight), remarks: remarks.trim() } }); onClose() }}>{t('repair.mark_ready')}</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function DeliverDialog({ ticket, onClose }: { ticket: RepairTicketDto; onClose: () => void }) {
  const t = useT()
  const deliver = useRepairDeliver()
  const { data: banks } = useBankAccounts()
  const { data: karats } = useKarats()
  const [f, setF] = useState({ addedMetal: '', addedKaratCode: '', addedFine: '0', addedRate: '0', cash: '0', online: '0', bankAccountId: '', remarks: '' })
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }))
  const ok = (n(f.online) === 0 || f.bankAccountId) && (n(f.addedFine) === 0 || f.addedMetal)
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{t('repair.deliver_title', { no: ticket.ticketNo })}</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">{t('repair.charges_so_far', { labour: inr(ticket.labourCharge), other: inr(ticket.otherCharge), balance: inr(ticket.balance) })}</p>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5"><Label>{t('repair.solder_metal')}</Label>
            <Select value={f.addedMetal || 'none'} onValueChange={(v) => setF((s) => ({ ...s, addedMetal: v === 'none' ? '' : v, addedKaratCode: '' }))}><SelectTrigger aria-label="Solder metal"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="none">{t('udhari.none')}</SelectItem>{METALS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}<SelectItem value="OTHER">{t('bill.col_other')}</SelectItem></SelectContent></Select>
          </div>
          {(f.addedMetal === 'GOLD' || f.addedMetal === 'SILVER') && (
            <div className="space-y-1.5"><Label>{t('repair.solder_karat')}</Label>
              <Select value={f.addedKaratCode || 'none'} onValueChange={(v) => set('addedKaratCode', v === 'none' ? '' : v)}><SelectTrigger aria-label="Solder karat"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="none">—</SelectItem>{(karats ?? []).filter((k) => k.metal === f.addedMetal).map((k) => <SelectItem key={k.id} value={k.code}>{k.title}</SelectItem>)}</SelectContent></Select>
            </div>
          )}
          {f.addedMetal === 'OTHER' && <p className="col-span-2 text-xs text-muted-foreground">{t('repair.other_metal_note')}</p>}
          <div className="space-y-1.5"><Label htmlFor="dl-fine">{t('repair.added_fine')}</Label><Input id="dl-fine" type="number" step="0.001" value={f.addedFine} onChange={(e) => set('addedFine', e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="dl-rate">{t('repair.added_rate')}</Label><Input id="dl-rate" type="number" value={f.addedRate} onChange={(e) => set('addedRate', e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="dl-cash">{t('udhari.cash')}</Label><Input id="dl-cash" type="number" value={f.cash} onChange={(e) => set('cash', e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="dl-online">{t('udhari.online')}</Label><Input id="dl-online" type="number" value={f.online} onChange={(e) => set('online', e.target.value)} /></div>
          {n(f.online) > 0 && (
            <div className="space-y-1.5"><Label>{t('bill.bank')}</Label>
              <Select value={f.bankAccountId} onValueChange={(v) => set('bankAccountId', v)}><SelectTrigger aria-label="Bank account"><SelectValue placeholder={t('bill.bank')} /></SelectTrigger>
                <SelectContent>{banks?.map((b) => <SelectItem key={b.id} value={String(b.id)}>{b.bankName} · {b.accountNo}</SelectItem>)}</SelectContent></Select>
            </div>
          )}
          <div className="col-span-2 space-y-1.5"><Label htmlFor="dl-rem">{t('oldmetal.col_remarks')}</Label><Input id="dl-rem" maxLength={300} value={f.remarks} onChange={(e) => set('remarks', e.target.value)} placeholder={t('repair.deliver_remarks_ph')} /></div>
        </div>
        <DialogFooter>
          <Button disabled={!ok || deliver.isPending} onClick={async () => { await deliver.mutateAsync({ id: ticket.id, body: { addedMetal: f.addedMetal || undefined, addedKaratCode: f.addedKaratCode || undefined, addedFine: n(f.addedFine), addedRate: n(f.addedRate), cash: n(f.cash), online: n(f.online), bankAccountId: n(f.online) > 0 ? Number(f.bankAccountId) : undefined, remarks: f.remarks.trim() || undefined } }); onClose() }}>{t('repair.deliver')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** RECEIVED → assigns and moves to In progress; IN_PROGRESS / IN_REVIEW → reassigns in place. */
export function AssignKarigarDialog({ ticket, onClose }: { ticket: RepairTicketDto; onClose: () => void }) {
  const t = useT()
  const move = useRepairStatus()
  const [karigar, setKarigar] = useState<PartyRefDto | null>(null)
  const starts = ticket.status === 'RECEIVED'
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{t('repair.assign_title', { no: ticket.ticketNo })}</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">
          {ticket.karigar ? t('repair.now_with', { name: ticket.karigar.name }) : t('repair.no_karigar')}
          {starts ? t('repair.assign_starts') : t('repair.assign_stays')}
        </p>
        <div className="space-y-1.5"><Label htmlFor="ak-karigar">{t('party.type.KARIGAR')}</Label><PartyPicker id="ak-karigar" value={karigar} onChange={setKarigar} type="KARIGAR" ariaLabel="Karigar" placeholder={t('repair.search_karigar')} /></div>
        <DialogFooter>
          <Button disabled={!karigar || move.isPending} onClick={async () => {
            await move.mutateAsync({ id: ticket.id, body: { status: starts ? 'IN_PROGRESS' : ticket.status, karigarId: karigar!.id } })
            onClose()
          }}>{starts ? t('repair.assign_start') : t('repair.assign')}</Button>
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
  const t = useT()
  const { data: tk, isLoading } = useRepair(id)
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{t('repair.ticket_title')}{tk ? ` #${tk.ticketNo}` : ''}</DialogTitle></DialogHeader>
        {isLoading || !tk ? (
          <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={tk.status === 'CANCELLED' ? 'secondary' : tk.status === 'DELIVERED' ? 'outline' : 'default'}>{t(STATUS_KEY[tk.status])}</Badge>
              {tk.priority !== 'NORMAL' && <Badge variant="destructive">{tk.priority}</Badge>}
            </div>
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">{t('bill.customer')}</h3>
              <dl className="grid grid-cols-2 gap-3">
                <Field label={t('girvi.col_name')}>{tk.party.name}</Field>
                <Field label={t('party.mobile')}>{tk.party.mobile}</Field>
                {tk.party.shopName && <Field label={t('girvi.shop')} wide>{tk.party.shopName}</Field>}
              </dl>
            </section>
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">{t('repair.ornament')}</h3>
              <dl className="grid grid-cols-2 gap-3">
                <Field label={t('girvi.col_category')}>{tk.category}{tk.subCategory ? ` · ${tk.subCategory}` : ''}</Field>
                <Field label={t('udhari.metal')}>{tk.metal}{tk.karatCode ? ` · ${tk.karatCode}` : ''}{tk.purity ? ` · ${tk.purity}%` : ''}</Field>
                <Field label={t('inv.newstock.pieces')}>{tk.pcs}</Field>
                <Field label={t('repair.hallmark')}>{tk.hallmark ?? '—'}</Field>
                <Field label={t('inv.newstock.gross_weight')}>{tk.gross} g</Field>
                <Field label={t('repair.net_weight')}>{tk.net ? `${tk.net} g` : '—'}</Field>
                <Field label={t('repair.final_weight')}>{tk.finalWeight ? `${tk.finalWeight} g` : '—'}</Field>
                <Field label={t('party.type.KARIGAR')}>{tk.karigar?.name ?? '—'}</Field>
                <Field label={t('repair.job')} wide>{tk.description}</Field>
                <Field label={t('oldmetal.col_remarks')} wide>{tk.remarks ?? '—'}</Field>
                <Field label={t('repair.photo')} wide><RepairPhoto ticket={tk} /></Field>
              </dl>
            </section>
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">{t('repair.charges_dates')}</h3>
              <dl className="grid grid-cols-2 gap-3 tabular-nums">
                <Field label={t('bill.col_labour')}>{inr(tk.labourCharge)}</Field>
                <Field label={t('bill.col_other')}>{inr(tk.otherCharge)}</Field>
                <Field label={t('repair.est_charge')}>{inr(estCharge(tk))}</Field>
                <Field label={t('repair.advance_paid')}>{inr(tk.advance)}</Field>
                <Field label={tk.status === 'DELIVERED' ? t('repair.balance_party') : t('repair.balance_est')}>{inr(tk.balance)}</Field>
                <Field label={t('repair.received_on')}>{date(tk.createdAt)}</Field>
                <Field label={t('repair.expected')}>{date(tk.expectedDate)}</Field>
                <Field label={t('repair.delivered_on')}>{tk.deliveredAt ? date(tk.deliveredAt) : '—'}</Field>
              </dl>
            </section>
            {tk.status === 'DELIVERED' && (
              <section className="space-y-2">
                <h3 className="text-sm font-semibold">{t('repair.settlement')}</h3>
                <dl className="grid grid-cols-2 gap-3 tabular-nums">
                  <Field label={t('repair.metal_added')}>{n(tk.addedFine ?? '0') > 0 ? `${addedMetalLabel(tk, t('repair.other_metal'))} · ${tk.addedFine} g @ ${inr(tk.addedRate ?? '0')}/g` : '—'}</Field>
                  <Field label={t('repair.metal_value')}>{inr(addedValue(tk))}</Field>
                  <Field label={t('repair.paid_cash')}>{inr(tk.deliveryCash ?? '0')}</Field>
                  <Field label={t('repair.paid_online')}>{inr(tk.deliveryOnline ?? '0')}{tk.deliveryBank ? ` · ${tk.deliveryBank.name}` : ''}</Field>
                </dl>
              </section>
            )}
          </div>
        )}
        <DialogFooter>
          <Button asChild variant="outline"><Link to={`/app/repair/slip/${id}`}><Printer aria-hidden />{t('repair.print_slip')}</Link></Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Ticket photo: thumbnail + upload / capture for repair.entry editors (uploads immediately). Re-upload changes photoUrl, which remounts the image. */
export function RepairPhoto({ ticket }: { ticket: RepairTicketDto }) {
  const t = useT()
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
          <Button type="button" variant="outline" size="sm" disabled={upload.isPending} onClick={() => input.current?.click()}><ImagePlus className="size-4" aria-hidden />{ticket.photoUrl ? t('repair.replace_photo') : t('repair.upload_photo')}</Button>
          <Button type="button" variant="outline" size="sm" disabled={upload.isPending} onClick={() => setCapturing(true)}><Camera className="size-4" aria-hidden />{t('comp.capture')}</Button>
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
