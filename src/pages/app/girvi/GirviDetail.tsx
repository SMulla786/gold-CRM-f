import { FileDown, FileText, FileUp, History as HistoryIcon, MessageCircle, Printer } from 'lucide-react'
import { useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { AuthedImage } from '@/components/AuthedImage'
import { MpinDialog } from '@/components/MpinDialog'
import { QrImage } from '@/components/QrImage'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { api } from '@/lib/api'
import { useBankAccounts, useBusinessProfile, useParty, useSettings } from '@/lib/appQueries'
import { useAuth } from '@/lib/auth'
import { useDeleteGirvi, useGirvi, useGirviInterest, useGirviRelease, useGirviTopup, useUploadGirviDoc } from '@/lib/girviQueries'
import { useT } from '@/lib/i18n'
import { downloadPdf, shareOnWhatsApp } from '@/lib/share'
import { cn } from '@/lib/utils'
import type { GirviBatchDto, GirviItemDto, GirviTxnDto } from '@/shared'
import { GirviItemPhoto } from '@/pages/app/girvi/GirviItemPhoto'
import { ItemReplaceDialog } from '@/pages/app/girvi/ItemReplaceDialog'

const inr = (s: string) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(s))
const date = (s: string) => new Date(s).toLocaleDateString('en-IN')
const n = (s: string) => Number(s) || 0
const payMode = (tx: GirviTxnDto, t: ReturnType<typeof useT>) =>
  [n(tx.cash) > 0 && t('girvi.mode_cash', { amount: inr(tx.cash) }), n(tx.online) > 0 && `${t('girvi.mode_online', { amount: inr(tx.online) })}${tx.bankAccount ? ` (${tx.bankAccount.name})` : ''}`].filter(Boolean).join(' + ')

/** One history line: date · type · amounts · payment mode · remark · created by. */
function TxnLine({ tx }: { tx: GirviTxnDto }) {
  const t = useT()
  const mode = payMode(tx, t)
  return (
    <li className="py-3">
      {date(tx.txnDate)} · {tx.type}{Number(tx.principal) ? ` · ${t('girvi.txn_principal', { amount: inr(tx.principal) })}` : ''}{Number(tx.interest) ? ` · ${t('girvi.txn_interest', { amount: inr(tx.interest) })}` : ''}{Number(tx.discount) ? ` · ${t('girvi.txn_disc', { amount: inr(tx.discount) })}` : ''}
      {(mode || tx.remark || tx.createdBy) && (
        <span className="block text-xs">
          {[mode, tx.remark && t('girvi.txn_remark', { remark: tx.remark }), tx.createdBy && t('girvi.txn_by', { name: tx.createdBy })].filter(Boolean).join(' · ')}
        </span>
      )}
    </li>
  )
}

/** Per-item history: the txns whose itemIds include the item. GRANT txns carry no itemIds (every item is pledged at grant), so the grant is listed too. */
function ItemHistoryDialog({ batch, itemId, onClose }: { batch: GirviBatchDto; itemId: number; onClose: () => void }) {
  const t = useT()
  const item = batch.items.find((it) => it.id === itemId)
  const txns = batch.txns.filter((tx) => tx.type === 'GRANT' || tx.itemIds.includes(itemId))
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{t('girvi.item_history_title', { name: item?.name ?? '' })}</DialogTitle></DialogHeader>
        {item && <p className="text-sm text-muted-foreground">{item.category} · {item.net}g · {inr(item.valuation)} · {item.status}{item.releasedAt ? ` ${t('girvi.released_on', { date: date(item.releasedAt) })}` : ''}</p>}
        {txns.length ? <ul className="divide-y text-sm text-muted-foreground">{txns.map((tx) => <TxnLine key={tx.id} tx={tx} />)}</ul> : <p className="text-sm text-muted-foreground">{t('girvi.no_item_txns')}</p>}
      </DialogContent>
    </Dialog>
  )
}

/** WhatsApp share (text only): edit the number and pick A4 (full) or Thermal (short) wording, then open wa.me. */
function WhatsAppDialog({ batch, shopName, defaultFormat, onClose }: { batch: GirviBatchDto; shopName: string; defaultFormat: 'A4' | 'THERMAL_80'; onClose: () => void }) {
  const [mobile, setMobile] = useState(batch.party.mobile ?? '')
  const [format, setFormat] = useState<string>(defaultFormat)
  const pledged = batch.items.filter((it) => it.status === 'PLEDGED')
  const text = format === 'THERMAL_80'
    ? [shopName, `Girvi #${batch.girviNo} · ${batch.party.name}`, `Principal ${inr(batch.principal)} · Due ${date(batch.returnDate)}`].join('\n')
    : [
        shopName,
        `Girvi #${batch.girviNo} · ${batch.party.name}`,
        `Issued ${date(batch.issueDate)} · Return by ${date(batch.returnDate)}`,
        `Items: ${pledged.map((it) => `${it.name} ${it.net}g`).join(', ') || '—'}`,
        `Principal ${inr(batch.principal)} @ ${batch.ratePercent}% / ${batch.ratePeriod === 'MONTHLY' ? 'month' : 'year'}`,
        `Interest due ${inr(batch.interestDue)} · Payable ${inr(batch.payable)}`,
      ].join('\n')
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Share on WhatsApp</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label htmlFor="g-wa-mobile">Mobile number</Label><Input id="g-wa-mobile" inputMode="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Message format</Label>
            <Select value={format} onValueChange={setFormat}><SelectTrigger aria-label="Message format"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="A4">A4 (full)</SelectItem><SelectItem value="THERMAL_80">Thermal (short)</SelectItem></SelectContent></Select>
          </div>
        </div>
        <pre className="whitespace-pre-wrap rounded-2xl border bg-muted/40 p-3 text-xs">{text}</pre>
        <DialogFooter>
          <Button disabled={mobile.replace(/\D/g, '').length < 10} onClick={() => { shareOnWhatsApp(mobile, text); onClose() }}><MessageCircle aria-hidden />Open WhatsApp</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Customer document on the loan: image preview (AuthedImage) or a PDF opened in a new tab. */
function DocPreviewDialog({ batch, ver, onClose }: { batch: GirviBatchDto; ver: number; onClose: () => void }) {
  const path = `/app/girvi/${batch.id}/doc`
  const isPdf = /\.pdf$/i.test(batch.docUrl ?? '')
  const openPdf = async () => {
    const blob = await api.blob(path)
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank', 'noopener')
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Customer document · Girvi #{batch.girviNo}</DialogTitle></DialogHeader>
        {isPdf
          ? <Button variant="outline" onClick={() => void openPdf().catch(() => {})}><FileText aria-hidden />Open PDF document</Button>
          : <AuthedImage path={path} ver={ver} alt={`Girvi #${batch.girviNo} document`} className="max-h-[70vh] w-full rounded-md border object-contain" />}
      </DialogContent>
    </Dialog>
  )
}

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
  const returned = batch.items.filter((it) => it.status === 'RELEASED')
  const [ids, setIds] = useState<Set<number>>(new Set(pledged.map((it) => it.id)))
  const [f, setF] = useState({ principalPaid: batch.principal, interestPaid: batch.interestDue, discount: '0', cash: '', online: '0', bankAccountId: '' })
  // UI-only acknowledgement (girviReleaseBody has no field for it) + a second "Confirm release" step before the POST
  const [ack, setAck] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }))
  const releasingAll = ids.size === pledged.length
  const toggle = (id: number) => setIds((s) => { const x = new Set(s); if (x.has(id)) x.delete(id); else x.add(id); return x })
  const ok = ids.size > 0 && (n(f.online) === 0 || f.bankAccountId) && (!releasingAll || Math.abs(n(f.principalPaid) - Number(batch.principal)) < 0.005)
  const selected = pledged.filter((it) => ids.has(it.id))
  const { data: banks } = useBankAccounts()
  const bank = banks?.find((b) => String(b.id) === f.bankAccountId)
  const submit = async () => {
    await rel.mutateAsync({ id: batch.id, body: { itemIds: [...ids], principalPaid: n(f.principalPaid), interestPaid: n(f.interestPaid), discount: n(f.discount), cash: n(f.cash), online: n(f.online), bankAccountId: n(f.online) > 0 ? Number(f.bankAccountId) : undefined } })
    onClose()
  }

  if (confirming) {
    const rows: [string, string][] = [
      [t('girvi.principal_paid'), inr(f.principalPaid || '0')],
      [t('girvi.interest_paid'), inr(f.interestPaid || '0')],
      [t('girvi.discount_inr'), inr(f.discount || '0')],
      [t('udhari.cash'), inr(f.cash || '0')],
      [t('udhari.online'), `${inr(f.online || '0')}${n(f.online) > 0 && bank ? ` · ${bank.bankName}` : ''}`],
    ]
    return (
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{t('girvi.confirm_release_title', { no: batch.girviNo })}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{t(selected.length === 1 ? 'girvi.confirm_return_one' : 'girvi.confirm_return_many', { n: selected.length, name: batch.party.name, closing: releasingAll ? t('girvi.and_loan_closed') : '' })}</p>
          <ul className="divide-y rounded-2xl border bg-muted/40 px-3 text-sm">
            {selected.map((it) => <li key={it.id} className="flex justify-between gap-2 py-2"><span>{it.category} · {it.name} · {it.net}g</span><span className="tabular-nums">{inr(it.valuation)}</span></li>)}
          </ul>
          <div className="space-y-1 text-sm tabular-nums">
            {rows.map(([k, v]) => <div key={k} className="flex justify-between"><span className="text-muted-foreground">{k}</span><span>{v}</span></div>)}
            <div className="flex justify-between border-t-2 border-brand pt-2 font-bold"><span>{t('girvi.total_received')}</span><span>{inr(String(n(f.cash) + n(f.online)))}</span></div>
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={rel.isPending} onClick={() => setConfirming(false)}>{t('girvi.back')}</Button>
            <Button disabled={rel.isPending} onClick={() => void submit().catch(() => {})}>{t('girvi.confirm_release')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{t('girvi.release_title', { no: batch.girviNo })}</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">{t('girvi.release_desc', { interest: inr(batch.interestDue), principal: inr(batch.principal) })}</p>
        <Tabs defaultValue="return">
          <TabsList>
            <TabsTrigger value="return">{t('girvi.items_to_return', { n: pledged.length })}</TabsTrigger>
            <TabsTrigger value="returned">{t('girvi.returned_items', { n: returned.length })}</TabsTrigger>
          </TabsList>
          <TabsContent value="return">
            <div className="space-y-2 rounded-2xl border bg-muted/40 p-3 text-sm">
              <label className="flex items-center gap-2 border-b pb-2 font-medium">
                <Checkbox aria-label="Select all" checked={ids.size === 0 ? false : releasingAll ? true : 'indeterminate'} onCheckedChange={() => setIds(releasingAll ? new Set() : new Set(pledged.map((it) => it.id)))} /> {t('girvi.select_all')}
              </label>
              {pledged.map((it) => (
                <label key={it.id} className="flex items-center gap-2"><Checkbox aria-label={`Release ${it.name}`} checked={ids.has(it.id)} onCheckedChange={() => toggle(it.id)} /> {it.name} · {it.net}g · {inr(it.valuation)}</label>
              ))}
            </div>
          </TabsContent>
          <TabsContent value="returned">
            <div className="space-y-2 rounded-2xl border bg-muted/40 p-3 text-sm">
              {returned.length ? returned.map((it) => (
                <div key={it.id} className="flex justify-between gap-2"><span>{it.name} · {it.net}g · {inr(it.valuation)}</span><span className="text-muted-foreground">{it.releasedAt ? date(it.releasedAt) : ''}</span></div>
              )) : <p className="text-muted-foreground">{t('girvi.none_returned')}</p>}
            </div>
          </TabsContent>
        </Tabs>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>{t('girvi.principal_paid')}</Label><Input type="number" aria-label="Principal paid" value={f.principalPaid} onChange={(e) => set('principalPaid', e.target.value)} /></div>
          <div className="space-y-1.5"><Label>{t('girvi.interest_paid')}</Label><Input type="number" aria-label="Interest paid" value={f.interestPaid} onChange={(e) => set('interestPaid', e.target.value)} /></div>
          <div className="space-y-1.5"><Label>{t('girvi.discount_inr')}</Label><Input type="number" aria-label="Discount" value={f.discount} onChange={(e) => set('discount', e.target.value)} /></div>
          <div />
          <BankPay cash={f.cash} online={f.online} bankAccountId={f.bankAccountId} set={(k, v) => set(k, v)} />
        </div>
        <label className="flex items-start gap-2 rounded-2xl border border-brand/30 bg-brand/10 p-3 text-sm">
          <Checkbox className="mt-0.5" aria-label="I confirm the customer has checked the items and there is no loss/damage" checked={ack} onCheckedChange={(v) => setAck(v === true)} />
          {t('girvi.ack_no_damage')}
        </label>
        <DialogFooter>
          <Button disabled={!ok || !ack || rel.isPending} onClick={() => setConfirming(true)}>{ids.size === 1 ? t('girvi.release_one') : t('girvi.release_many', { n: ids.size })}</Button>
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
  const { data: settings } = useSettings()
  // customer address needs the party-master view permission; without it the receipt just omits the address
  const { data: partyFull } = useParty(batch && can('settings.parties', 'view') ? batch.party.id : undefined)
  const del = useDeleteGirvi()
  const [dialog, setDialog] = useState<'interest' | 'topup' | 'release' | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [historyItem, setHistoryItem] = useState<number | null>(null)
  const [replacing, setReplacing] = useState<GirviItemDto | null>(null)
  const [layoutOverride, setLayoutOverride] = useState<string | null>(null)
  const [sharing, setSharing] = useState(false)
  const [docOpen, setDocOpen] = useState(false)
  const [docVer, setDocVer] = useState(0)
  const docInput = useRef<HTMLInputElement>(null)
  const uploadDoc = useUploadGirviDoc()

  if (isLoading || !batch) return <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
  const canEdit = can('girvi.entry', 'edit')
  const canDelete = can('girvi.entry', 'delete')
  const grantOnly = batch.txns.length === 1 && batch.txns[0]?.type === 'GRANT'
  // Settings > Girvi > Receipt customization (presentation only). Missing setting = show everything.
  const rc = settings?.['girvi.receipt']
  const show = (k: Exclude<keyof NonNullable<typeof rc>, 'format' | 'terms'>) => (rc ? rc[k] : true)
  const layout = layoutOverride ?? (rc ? (rc.format === 'THERMAL' ? 'THERMAL_80' : 'A4') : settings?.['print.defaults'].layout === 'THERMAL_80' ? 'THERMAL_80' : 'A4')
  const thermal = layout === 'THERMAL_80'
  const weights = !thermal && show('showItemWeights')
  // Server-computed split of interestDue (regular / first-month / penalty) + effective rate; shown only when extras apply.
  const ib = batch.interestBreakdown
  const breakdown = ib && (n(ib.firstMonth) > 0 || n(ib.penalty) > 0 || ib.effectiveRate !== batch.ratePercent)
    ? [t('girvi.bd_regular', { amount: inr(ib.regular) }), n(ib.firstMonth) > 0 && t('girvi.bd_first_month', { amount: inr(ib.firstMonth) }), n(ib.penalty) > 0 && t('girvi.bd_penalty', { amount: inr(ib.penalty) }), t('girvi.bd_effective', { rate: ib.effectiveRate })].filter(Boolean).join(' · ')
    : null
  const shopName = business?.name ?? me?.business?.name ?? t('girvi.shop')
  const customerAddress = partyFull?.address
  // Receipt extras (presentation only): monthly interest at the loan's effective rate (annual rate / 12), grant payout mode
  const rate = n(ib?.effectiveRate ?? batch.ratePercent)
  const monthlyInterest = (n(batch.principal) * rate) / 100 / (batch.ratePeriod === 'ANNUAL' ? 12 : 1)
  const grant = batch.txns.find((tx) => tx.type === 'GRANT')
  const grantMode = grant ? payMode(grant, t) : ''
  const saveDoc = async (file: File | undefined) => {
    if (!file) return
    await uploadDoc.mutateAsync({ id: batch.id, file })
    setDocVer((v) => v + 1) // same path after a re-upload: bust AuthedImage's fetch
    if (docInput.current) docInput.current.value = ''
  }

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
          <p className="text-sm">
            <Link to={`/app/girvi?partyId=${batch.party.id}`} className="font-medium text-brand-strong hover:underline">{t('girvi.all_loans_of', { name: batch.party.name })}</Link>
            {canEdit && <> · <Link to={`/app/girvi/new?partyId=${batch.party.id}`} className="font-medium text-brand-strong hover:underline">{t('girvi.new_loan_for_customer')}</Link></>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2"><Label htmlFor="g-asof" className="text-xs text-muted-foreground">{t('girvi.as_of')}</Label><Input id="g-asof" type="date" className="w-36" value={asOf} onChange={(e) => setAsOf(e.target.value)} /></div>
          <Button size="sm" variant="outline" onClick={() => setSharing(true)}><MessageCircle aria-hidden />{t('girvi.share_whatsapp')}</Button>
          {canEdit && <>
            <input ref={docInput} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" aria-label="Customer document file" onChange={(e) => void saveDoc(e.target.files?.[0]).catch(() => {})} />
            <Button size="sm" variant="outline" disabled={uploadDoc.isPending} onClick={() => docInput.current?.click()}><FileUp aria-hidden />{batch.docUrl ? 'Replace document' : 'Upload document'}</Button>
          </>}
          {batch.docUrl && <Button size="sm" variant="outline" onClick={() => setDocOpen(true)}><FileText aria-hidden />Preview document</Button>}
          <Select value={layout} onValueChange={setLayoutOverride}>
            <SelectTrigger size="sm" className="w-36" aria-label="Print layout"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="A4">A4</SelectItem>
              <SelectItem value="THERMAL_80">{t('bill.thermal_80')}</SelectItem>
            </SelectContent>
          </Select>
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
            {breakdown && (
              <div className="text-xs text-white/60 tabular-nums">{breakdown}</div>
            )}
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

      <div className={cn('print-area space-y-4 rounded-3xl border border-white/80 bg-card p-6 text-sm shadow-sm sm:p-10 dark:border-border print:rounded-none print:border-0 print:bg-transparent print:shadow-none', thermal && 'print-thermal mx-auto max-w-sm sm:p-6 print:max-w-none')}>
        <div className="relative min-h-13 px-14 text-center">
          {show('showGirviQr') && <QrImage text={String(batch.girviNo)} size={52} className="absolute right-0 top-0" />}
          {show('showShopName') && <div className="text-lg font-bold">{shopName}</div>}
          {show('showShopAddress') && business?.address && <div>{business.address}</div>}
          {((show('showShopMobile') && business?.mobile) || (show('showShopGst') && business?.gstin)) && (
            <div>{[show('showShopMobile') && business?.mobile && `Mobile: ${business.mobile}`, show('showShopGst') && business?.gstin && `GSTIN: ${business.gstin}`].filter(Boolean).join(' · ')}</div>
          )}
          <div className="mt-1 font-medium">{t('girvi.receipt_title')}</div>
        </div>
        <div className="flex flex-wrap justify-between gap-2">
          <div className="flex items-start gap-3">
          {show('showCustomerPhoto') && partyFull?.photoUrl && <AuthedImage path={`/app/files/parties/${batch.party.id}/photo`} alt={`${batch.party.name} photo`} className="size-14 rounded-md border object-cover" />}
          <div>
            {show('showCustomerName') && <Link to={`/app/girvi?partyId=${batch.party.id}`} className="font-medium hover:underline print:no-underline" title="Show all loans of this customer">{batch.party.name}</Link>}
            {show('showCustomerName') && show('showCustomerMobile') && ' · '}
            {show('showCustomerMobile') && batch.party.mobile}
            {show('showCustomerAddress') && customerAddress && <div className="text-muted-foreground">{customerAddress}</div>}
          </div>
          </div>
          <div>{t('girvi.receipt_dates', { no: batch.girviNo, issued: date(batch.issueDate), due: date(batch.returnDate) })}</div>
        </div>
        <div className="overflow-x-auto print:overflow-visible">
        <Table>
          <TableHeader><TableRow><TableHead>{t('girvi.col_item')}</TableHead>{weights && <TableHead>{t('stock.col_gross')}</TableHead>}<TableHead>{t('stock.col_net')}</TableHead>{weights && <><TableHead>{t('girvi.col_purity')}</TableHead><TableHead>{t('stock.col_fine')}</TableHead></>}{show('showItemValuation') && <TableHead>{t('girvi.valuation')}</TableHead>}<TableHead>{t('stock.col_status')}</TableHead><TableHead className="print:hidden" /></TableRow></TableHeader>
          <TableBody>
            {batch.items.map((it) => (
              <TableRow key={it.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <GirviItemPhoto item={it} printable={show('showItemPhoto')} />
                    <span>{it.category} · {it.name}</span>
                  </div>
                </TableCell>
                {weights && <TableCell className="tabular-nums">{it.gross}</TableCell>}
                <TableCell className="tabular-nums">{it.net}</TableCell>
                {weights && <><TableCell className="tabular-nums">{it.purity}%</TableCell><TableCell className="tabular-nums">{it.fine}</TableCell></>}
                {show('showItemValuation') && <TableCell className="tabular-nums">{inr(it.valuation)}</TableCell>}
                <TableCell>{it.status}{it.releasedAt ? <span className="block text-xs text-muted-foreground">{date(it.releasedAt)}</span> : null}</TableCell>
                <TableCell className="print:hidden">
                  <Button size="sm" variant="ghost" aria-label={`History ${it.name}`} onClick={() => setHistoryItem(it.id)}><HistoryIcon aria-hidden />{t('girvi.history')}</Button>
                  {it.status === 'PLEDGED' && batch.status === 'ACTIVE' && can('girvi.entry', 'edit') && (
                    <Button size="sm" variant="ghost" aria-label={`Replace or revalue ${it.name}`} onClick={() => setReplacing(it)}>{t('girvi.replace_revalue')}</Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
        <div className="ml-auto max-w-xs space-y-1 tabular-nums">
          <div className="flex justify-between"><span className="text-muted-foreground">{t('girvi.valuation')}</span><span>{inr(batch.valuation)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">{t('girvi.principal')}</span><span>{inr(batch.principal)}</span></div>
          {show('showMonthlyInterest') && <div className="flex justify-between"><span className="text-muted-foreground">Monthly interest</span><span>{inr(monthlyInterest.toFixed(2))}</span></div>}
          {show('showTotalInterest') && <div className="flex justify-between"><span className="text-muted-foreground">{t('girvi.interest_due_to', { date: asOf ? date(asOf) : t('girvi.today') })}</span><span>{inr(batch.interestDue)}</span></div>}
          {show('showTotalInterest') && breakdown && <div className="text-right text-xs text-muted-foreground">{breakdown}</div>}
          <div className="flex justify-between border-t-2 border-brand pt-2 text-base font-bold"><span>{t('girvi.payable')}</span><span>{inr(batch.payable)}</span></div>
        </div>
        {show('showCalculations') && <div className="text-xs text-muted-foreground">{batch.ratePercent}% / {batch.ratePeriod === 'MONTHLY' ? t('girvi.term_month') : t('girvi.term_year')} · {batch.interestType === 'SI' ? t('girvi.term_simple') : t('girvi.term_compound', { period: String(batch.ciPeriod?.toLowerCase()) })} · {batch.method === 'FULL_MONTH' ? t('girvi.term_full_month') : t('girvi.term_day_wise')} · {t('girvi.interest_from', { date: date(batch.interestFrom) })}</div>}
        {show('showPaymentMode') && grantMode && <div className="text-xs">Paid out: {grantMode}</div>}
        {show('showRemarks') && batch.remark && <div className="text-xs">{t('girvi.txn_remark', { remark: batch.remark })}</div>}
        {/* Print-only: on screen the History card below already lists these */}
        {show('showItemHistory') && batch.txns.length > 0 && (
          <div className="hidden border-t pt-2 text-xs print:block">
            <div className="font-medium">{t('girvi.history')}</div>
            <ul>{batch.txns.map((tx) => <TxnLine key={tx.id} tx={tx} />)}</ul>
          </div>
        )}
        {rc?.terms && <p className="whitespace-pre-wrap border-t pt-2 text-xs">{rc.terms}</p>}
        {show('showSignatures') && (
          <div className="hidden justify-between pt-10 text-xs print:flex">
            <span className="border-t px-6 pt-1">Customer signature</span>
            <span className="border-t px-6 pt-1">Authorised signatory</span>
          </div>
        )}
      </div>

      {batch.txns.length > 0 && (
        <Card className="overflow-hidden text-sm print:hidden">
          <div className="border-b bg-muted/40 px-6 py-4"><h3 className="text-lg font-bold">{t('girvi.history')}</h3></div>
          <ul className="divide-y px-6 text-muted-foreground">
            {batch.txns.map((tx) => <TxnLine key={tx.id} tx={tx} />)}
          </ul>
        </Card>
      )}

      {dialog === 'interest' && <InterestDialog batch={batch} onClose={() => setDialog(null)} />}
      {dialog === 'topup' && <TopupDialog batch={batch} onClose={() => setDialog(null)} />}
      {dialog === 'release' && <ReleaseDialog batch={batch} onClose={() => setDialog(null)} />}
      {historyItem != null && <ItemHistoryDialog batch={batch} itemId={historyItem} onClose={() => setHistoryItem(null)} />}
      {replacing && <ItemReplaceDialog batchId={batch.id} item={replacing} onClose={() => setReplacing(null)} />}
      {sharing && <WhatsAppDialog batch={batch} shopName={shopName} defaultFormat={thermal ? 'THERMAL_80' : 'A4'} onClose={() => setSharing(false)} />}
      {docOpen && batch.docUrl && <DocPreviewDialog batch={batch} ver={docVer} onClose={() => setDocOpen(false)} />}
      <MpinDialog open={deleting} title={t('girvi.delete_title', { no: batch.girviNo })} onConfirm={(mpin) => del.mutateAsync({ id: batch.id, mpin })} onClose={() => setDeleting(false)} />
    </div>
  )
}
