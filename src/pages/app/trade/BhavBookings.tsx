import type { ColumnDef } from '@tanstack/react-table'
import { BadgeCheck, Hourglass, Lock, MoreHorizontal, Plus, Printer, Scale, Truck, Wallet, X, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { CsvExportButton } from '@/components/CsvExportButton'
import { DataTable } from '@/components/DataTable'
import { MpinDialog } from '@/components/MpinDialog'
import { PartyPicker } from '@/components/PartyPicker'
import { SelectBranchForTxn } from '@/components/SelectBranchForTxn'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useBankAccounts, useSettings } from '@/lib/appQueries'
import { useAuth } from '@/lib/auth'
import { metalRateUnitGrams } from '@/lib/billingQueries'
import { useT } from '@/lib/i18n'
import { useBhavBookings, useBulkDeleteBhav, useCancelBhav, useCreateBhav, useDeleteBhav, useUndeliverBhav, useUpdateBhav, useVerifyBhav } from '@/lib/tradeQueries'
import { BHAV_STATUSES, businessDayISO, METALS, TRADE_SIDES, metalToMoney, type BhavBookingDto, type PartyRefDto } from '@/shared'

import { moneyFlow, sideFigures } from './bhavSplit'
import { blankPay, payBody, payRowsFrom, payTotal, payValid, type PayRow } from './splitPay'
import { DateRangeFilter, HistoryDialog, PartyBalanceChip, SplitPaymentTable, SplitToggle } from './TradeExtras'
import { bhavExportRows } from './tradeExport'

const inr = (s: string) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(s))
const date = (s: string) => new Date(s).toLocaleDateString('en-IN')
const n = (s: string) => Number(s) || 0
const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline'> = { PENDING: 'default', PARTIAL: 'secondary', DELIVERED: 'outline', CANCELLED: 'outline' }

let uid = 0
interface WRow { key: string; weight: string; rate: string }
const blankW = (weight = '', rate = ''): WRow => ({ key: `w${uid++}`, weight, rate })

/** Create / edit form. Unmounts with the dialog, so it starts fresh (or from `editing`) every time it opens. */
function BookingForm({ editing, onDone }: { editing?: BhavBookingDto; onDone: () => void }) {
  const t = useT()
  const { activeBranch } = useAuth()
  const branchReady = !!editing || (activeBranch !== '' && activeBranch !== 'all')
  const { data: banks } = useBankAccounts()
  const { data: settings } = useSettings()
  const create = useCreateBhav()
  const update = useUpdateBhav()
  const [party, setParty] = useState<PartyRefDto | null>(editing?.party ?? null)
  const [f, setF] = useState(() => editing
    ? { side: editing.side as string, metal: editing.metal as string, txnDate: editing.txnDate, weight: editing.weight, rate: editing.rate, cash: editing.cash ?? editing.advance, online: editing.online ?? '0', bankAccountId: editing.bankAccount ? String(editing.bankAccount.id) : '', narration: editing.narration ?? '', entryType: editing.entryType ?? 'LEDGER' }
    : { side: 'BUY', metal: 'GOLD', txnDate: businessDayISO(), weight: '', rate: '', cash: '0', online: '0', bankAccountId: '', narration: '', entryType: 'LEDGER' })
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }))
  const [multi, setMulti] = useState(!!editing?.lines?.length)
  const [lines, setLines] = useState<WRow[]>(() => editing?.lines?.length ? editing.lines.map((l) => blankW(l.weight, l.rate)) : [blankW(), blankW()])
  const [split, setSplit] = useState(!!editing?.payments?.length)
  const [pays, setPays] = useState<PayRow[]>(() => (editing?.payments?.length ? payRowsFrom(editing.payments) : [blankPay()]))
  const [askMpin, setAskMpin] = useState(false)

  // Read-only preview (the server computes and posts the real figures).
  const unit = metalRateUnitGrams(f.metal, settings)
  const rowAmount = (r: WRow) => Number(metalToMoney(n(r.weight), n(r.rate), unit))
  const multiWeight = lines.reduce((a, r) => a + n(r.weight), 0)
  const avgRate = multiWeight > 0 ? Math.round((lines.reduce((a, r) => a + n(r.weight) * n(r.rate), 0) / multiWeight) * 100) / 100 : 0
  const finalAmount = multi ? lines.reduce((a, r) => a + rowAmount(r), 0) : Number(metalToMoney(n(f.weight), n(f.rate), unit))
  const totalPaid = split ? payTotal(pays) : n(f.cash) + n(f.online)
  const remaining = finalAmount - totalPaid

  const figuresOk = multi ? lines.every((r) => n(r.weight) > 0 && n(r.rate) > 0) : n(f.weight) > 0 && n(f.rate) > 0
  const valid = branchReady && !!party && figuresOk && (split ? payValid(pays) : n(f.online) === 0 || f.bankAccountId)
  const body = () => ({
    side: f.side, partyId: party!.id, metal: f.metal, txnDate: f.txnDate || undefined,
    ...(multi ? { lines: lines.map((r) => ({ weight: n(r.weight), rate: n(r.rate) })) } : { weight: n(f.weight), rate: n(f.rate) }),
    entryType: f.entryType,
    ...(split ? payBody(pays) : { cash: n(f.cash), online: n(f.online), bankAccountId: n(f.online) > 0 ? Number(f.bankAccountId) : undefined }),
    narration: f.narration || undefined,
  })
  const submit = async () => {
    if (editing) { setAskMpin(true); return }
    await create.mutateAsync(body())
    onDone()
  }
  const pending = create.isPending || update.isPending
  const setLine = (i: number, k: 'weight' | 'rate', v: string) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, [k]: v } : l)))

  return (
    <>
      {!branchReady && <SelectBranchForTxn note={t('trade.bhav.branch_note')} />}
      <div className="grid max-h-[65vh] grid-cols-2 gap-4 overflow-y-auto pr-1">
        <div className="space-y-1.5"><Label>{t('trade.side')}</Label>
          <Select value={f.side} onValueChange={(v) => set('side', v)}><SelectTrigger aria-label="Side"><SelectValue /></SelectTrigger>
            <SelectContent>{TRADE_SIDES.map((s) => <SelectItem key={s} value={s}>{s === 'BUY' ? t('trade.bhav.side_buy') : t('trade.bhav.side_sell')}</SelectItem>)}</SelectContent></Select>
        </div>
        <div className="space-y-1.5"><Label>{t('udhari.metal')}</Label>
          <Select value={f.metal} onValueChange={(v) => set('metal', v)}><SelectTrigger aria-label="Metal"><SelectValue /></SelectTrigger>
            <SelectContent>{METALS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select>
        </div>
        <div className="space-y-1.5"><Label htmlFor="bk-party">{t('udhari.party')}</Label><PartyPicker value={party} onChange={setParty} placeholder={t('bill.search_party')} id="bk-party" ariaLabel="Party" /><PartyBalanceChip partyId={party?.id} /></div>
        <div className="space-y-1.5"><Label htmlFor="bk-date">{t('udhari.date')}</Label><Input id="bk-date" type="date" value={f.txnDate} onChange={(e) => set('txnDate', e.target.value)} /></div>
        <div className="col-span-2 flex items-center gap-2">
          <Checkbox id="bk-multi" checked={multi} onCheckedChange={(c) => setMulti(c === true)} />
          <Label htmlFor="bk-multi" className="font-normal">{t('trade.bhav.multi')}</Label>
        </div>
        {multi ? (
          <div className="col-span-2 space-y-2">
            {lines.map((l, i) => (
              <div key={l.key} className="flex items-center gap-2">
                <span className="w-5 text-sm tabular-nums text-muted-foreground">{i + 1}</span>
                <Input type="number" step="0.001" aria-label={`Row ${i + 1} weight`} placeholder={t('udhari.weight_g')} value={l.weight} onChange={(e) => setLine(i, 'weight', e.target.value)} />
                <Input type="number" aria-label={`Row ${i + 1} rate`} placeholder={t('trade.rate_unit', { unit: f.metal === 'GOLD' ? '/10g' : '/kg' })} value={l.rate} onChange={(e) => setLine(i, 'rate', e.target.value)} />
                <span className="w-28 shrink-0 text-right text-sm tabular-nums text-muted-foreground">{inr(String(rowAmount(l)))}</span>
                <Button variant="ghost" size="sm" aria-label={`Remove row ${i + 1}`} disabled={lines.length === 1} onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}><X className="size-4" aria-hidden /></Button>
              </div>
            ))}
            <div className="flex items-center justify-between text-sm">
              <Button variant="outline" size="sm" onClick={() => setLines((ls) => [...ls, blankW()])}><Plus className="size-4" aria-hidden />{t('trade.bhav.add_row')}</Button>
              <span className="tabular-nums text-muted-foreground">{t('trade.bhav.avg', { wt: multiWeight.toFixed(3), rate: avgRate.toFixed(2) })}</span>
            </div>
          </div>
        ) : <>
          <div className="space-y-1.5"><Label htmlFor="bk-wt">{t('udhari.weight_g')}</Label><Input id="bk-wt" type="number" step="0.001" value={f.weight} onChange={(e) => set('weight', e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="bk-rate">{t('trade.rate_unit', { unit: f.metal === 'GOLD' ? '/10g' : '/kg' })}</Label><Input id="bk-rate" type="number" value={f.rate} onChange={(e) => set('rate', e.target.value)} /></div>
        </>}
        <div className="col-span-2 space-y-1.5"><Label>{t('trade.bhav.entry_type')}</Label>
          <Select value={f.entryType} onValueChange={(v) => set('entryType', v)}><SelectTrigger aria-label="Entry type"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="LEDGER">{t('trade.bhav.entry_ledger')}</SelectItem>
              <SelectItem value="ONLY_ENTRY">{t('trade.bhav.entry_only')}</SelectItem>
            </SelectContent></Select>
        </div>
        <div className="col-span-2"><SplitToggle id="bk-split" checked={split} onChange={setSplit} /></div>
        {split ? (
          <div className="col-span-2"><SplitPaymentTable rows={pays} onChange={setPays} /></div>
        ) : <>
          <div className="space-y-1.5"><Label htmlFor="bk-cash">{t('trade.bhav.adv_cash')}</Label><Input id="bk-cash" type="number" value={f.cash} onChange={(e) => set('cash', e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="bk-online">{t('trade.bhav.adv_online')}</Label><Input id="bk-online" type="number" value={f.online} onChange={(e) => set('online', e.target.value)} /></div>
          {n(f.online) > 0 && (
            <div className="col-span-2 space-y-1.5"><Label>{t('bill.bank')}</Label>
              <Select value={f.bankAccountId} onValueChange={(v) => set('bankAccountId', v)}><SelectTrigger aria-label="Bank account"><SelectValue placeholder={t('bill.bank')} /></SelectTrigger>
                <SelectContent>{banks?.map((b) => <SelectItem key={b.id} value={String(b.id)}>{b.bankName} · {b.accountNo}</SelectItem>)}</SelectContent></Select>
            </div>
          )}
        </>}
        <div className="col-span-2 space-y-1.5"><Label htmlFor="bk-narr">{t('udhari.col_narration')}</Label><Input id="bk-narr" value={f.narration} onChange={(e) => set('narration', e.target.value)} /></div>
      </div>
      <div className="space-y-1 rounded-xl bg-muted px-3 py-2 text-sm tabular-nums">
        <div className="flex justify-between"><span className="text-muted-foreground">{t('trade.final_amount')}</span><span className="font-medium">{inr(String(finalAmount))}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">{t('trade.bhav.adv_paid')}</span><span>{inr(String(totalPaid))}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">{t('trade.bhav.remaining')}</span><span className="font-medium">{inr(String(remaining))}</span></div>
      </div>
      <DialogFooter><Button disabled={!valid || pending} onClick={() => void submit().catch(() => {})}>{pending ? t('bill.saving') : editing ? t('party.save_changes') : t('trade.bhav.book')}</Button></DialogFooter>
      {editing && (
        <MpinDialog open={askMpin} title={t('trade.save_changes_to', { no: editing.bookingNo })} onClose={() => setAskMpin(false)}
          onConfirm={async (mpin) => { await update.mutateAsync({ id: editing.id, mpin, body: body() }); onDone() }} />
      )}
    </>
  )
}

function NewBookingDialog() {
  const t = useT()
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button>{t('trade.bhav.new')}</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{t('trade.bhav.new_title')}</DialogTitle></DialogHeader>
        <BookingForm onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}

/** Verified stamp shown next to the status. */
export function VerifiedBadge({ b }: { b: BhavBookingDto }) {
  const t = useT()
  if (!b.verifiedAt) return null
  const by = b.verifiedBy ? t('trade.bhav.verified_by', { user: b.verifiedBy }) : ''
  return <Badge variant="outline" title={t('trade.bhav.verified_title', { by, date: new Date(b.verifiedAt).toLocaleString('en-IN') })}><BadgeCheck className="size-3.5" aria-hidden />{t('trade.bhav.verified')}</Badge>
}

/** Given / Received cell (TRD-04): the advance and the payments made on delivery, each on its own line. */
export function MoneyFlowCell({ b }: { b: BhavBookingDto }) {
  const t = useT()
  const f = moneyFlow(b)
  if (f.advance == null && f.settlement == null) return <>—</>
  return (
    <div className="tabular-nums">
      <div className="text-xs text-muted-foreground">{t(f.kind === 'GIVEN' ? 'udhari.col_given' : 'udhari.col_received')}</div>
      {f.advance != null && <div>{t('trade.col_advance')}: {inr(f.advance)}{f.recordOnly && <span className="text-xs text-muted-foreground"> ({t('trade.bhav.record_only_lc')})</span>}</div>}
      {f.settlement != null && <div>{t('trade.ex.settlement')}: {inr(f.settlement)}</div>}
    </div>
  )
}

/** Secondary row actions: Edit (pending only), History, Verify / Remove verification, Undeliver (MPIN). */
export function BhavRowMenu({ b }: { b: BhavBookingDto }) {
  const t = useT()
  const { can } = useAuth()
  const canEdit = can('buy_sell.bhav_booking', 'edit')
  const verify = useVerifyBhav()
  const undeliver = useUndeliverBhav()
  const [editOpen, setEditOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [undelivering, setUndelivering] = useState(false)
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild><Button variant="ghost" size="sm" aria-label={`More actions for #${b.bookingNo}`}><MoreHorizontal className="size-4" aria-hidden /></Button></DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canEdit && b.status === 'PENDING' && <DropdownMenuItem onSelect={() => setEditOpen(true)}>{t('common.edit')}</DropdownMenuItem>}
          <DropdownMenuItem onSelect={() => setHistoryOpen(true)}>{t('girvi.history')}</DropdownMenuItem>
          {canEdit && <DropdownMenuItem onSelect={() => verify.mutate({ id: b.id, verified: !b.verifiedAt })}>{b.verifiedAt ? t('trade.bhav.remove_verification') : t('trade.bhav.verify')}</DropdownMenuItem>}
          {canEdit && (b.status === 'DELIVERED' || b.status === 'PARTIAL') && <DropdownMenuItem onSelect={() => setUndelivering(true)}>{t('trade.bhav.undeliver')}</DropdownMenuItem>}
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('trade.bhav.edit_title', { no: b.bookingNo })}</DialogTitle></DialogHeader>
          <BookingForm editing={b} onDone={() => setEditOpen(false)} />
        </DialogContent>
      </Dialog>
      <HistoryDialog kind="bhav-booking" id={historyOpen ? b.id : undefined} title={t('trade.history_of', { no: b.bookingNo })} onClose={() => setHistoryOpen(false)} />
      <MpinDialog open={undelivering} title={t('trade.bhav.mark_undelivered', { no: b.bookingNo })} onConfirm={(mpin) => undeliver.mutateAsync({ id: b.id, mpin })} onClose={() => setUndelivering(false)} />
    </>
  )
}

export function BhavBookings() {
  const t = useT()
  const { can, activeBranch } = useAuth()
  const canEdit = can('buy_sell.bhav_booking', 'edit')
  const canDelete = can('buy_sell.bhav_booking', 'delete')
  const canDeliver = can('buy_sell.entry', 'edit')
  const [side, setSide] = useState('')
  const [metal, setMetal] = useState('')
  // 'open' = PENDING + PARTIAL (the default view: bookings still to be delivered); 'all' = no status filter.
  const [status, setStatus] = useState('open')
  const [q, setQ] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const statusParams = status === 'open' ? { open: 'true' } : status === 'all' ? {} : { status }
  const filters = { side: side || undefined, metal: metal || undefined, q: q || undefined, from: from || undefined, to: to || undefined, ...statusParams }
  const { data, isLoading } = useBhavBookings({ ...filters, page, pageSize })
  const cancel = useCancelBhav()
  const del = useDeleteBhav()
  const [cancelling, setCancelling] = useState<BhavBookingDto | null>(null)
  const [deleting, setDeleting] = useState<BhavBookingDto | null>(null)
  const bulkDelete = useBulkDeleteBhav()
  const [sel, setSel] = useState<Set<number>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const clearSel = () => setSel(new Set())

  // Only an untouched PENDING booking can be deleted, so only those rows are selectable.
  const selectable = (data?.items ?? []).filter((b) => b.status === 'PENDING')
  const selected = selectable.filter((b) => sel.has(b.id))
  const allSelected = selectable.length > 0 && selected.length === selectable.length
  const toggle = (id: number) => setSel((s) => { const x = new Set(s); if (x.has(id)) x.delete(id); else x.add(id); return x })

  const columns: ColumnDef<BhavBookingDto, unknown>[] = [
    ...(canDelete ? [{
      id: 'select',
      header: () => <Checkbox aria-label="Choose all pending bookings on this page" checked={allSelected} disabled={selectable.length === 0} onCheckedChange={(c) => setSel(c ? new Set(selectable.map((b) => b.id)) : new Set())} />,
      cell: ({ row }) => row.original.status === 'PENDING' ? <Checkbox aria-label={`Choose booking ${row.original.bookingNo}`} checked={sel.has(row.original.id)} onCheckedChange={() => toggle(row.original.id)} /> : null,
    } satisfies ColumnDef<BhavBookingDto, unknown>] : []),
    { header: t('trade.col_no'), cell: ({ row }) => <span className="font-medium">#{row.original.bookingNo}</span> },
    { header: t('udhari.date'), cell: ({ row }) => date(row.original.txnDate) },
    { header: t('udhari.party'), cell: ({ row }) => row.original.party.name },
    { header: t('udhari.metal'), cell: ({ row }) => row.original.metal },
    // parity: BUY (WT | RATE | AMT) and SELL (WT | RATE | AMT) groups; a booking fills only its own side
    ...TRADE_SIDES.flatMap((side): ColumnDef<BhavBookingDto, unknown>[] => [
      { id: `${side}-wt`, header: `${side} · ${t('bill.col_weight')}`, cell: ({ row }) => { const f = sideFigures(row.original, side); return f ? `${f.weight} g` : '—' } },
      { id: `${side}-rate`, header: `${side} · ${t('udhari.rate')}`, cell: ({ row }) => sideFigures(row.original, side)?.rate ?? '—' },
      { id: `${side}-amt`, header: `${side} · ${t('bill.amount')}`, cell: ({ row }) => { const f = sideFigures(row.original, side); return f ? inr(f.amount) : '—' } },
    ]),
    { header: t('trade.col_pending'), cell: ({ row }) => `${row.original.pendingWeight} g` },
    { id: 'given-received', header: `${t('udhari.col_given')} / ${t('udhari.col_received')}`, cell: ({ row }) => <MoneyFlowCell b={row.original} /> },
    { header: t('stock.col_status'), cell: ({ row }) => <div className="flex flex-wrap gap-1"><Badge variant={STATUS_VARIANT[row.original.status]}>{row.original.status}</Badge><VerifiedBadge b={row.original} /></div> },
    { id: 'actions', header: '', cell: ({ row }) => {
      const b = row.original
      const isOpen = b.status === 'PENDING' || b.status === 'PARTIAL'
      return (
        <div className="flex justify-end gap-1">
          {/* deliver = a new Buy/Sell prefilled with this booking (same flow as picking it there); posts at the booking's branch */}
          {canDeliver && isOpen && (activeBranch === String(b.branch.id)
            ? <Button asChild variant="ghost" size="sm"><Link to={`/app/buy_sell/new?booking=${b.id}`}><Truck className="size-4" aria-hidden />{t('trade.bhav.deliver')}</Link></Button>
            : <Button variant="ghost" size="sm" disabled title={t('trade.switch_branch_deliver', { name: b.branch.name })}><Truck className="size-4" aria-hidden />{t('trade.bhav.deliver')}</Button>)}
          <Button asChild variant="ghost" size="sm"><Link to={`/app/buy_sell/bhav/${b.id}/print`}><Printer className="size-4" aria-hidden />{t('bill.print')}</Link></Button>
          {canEdit && isOpen && <Button variant="ghost" size="sm" onClick={() => setCancelling(b)}>{t('common.cancel')}</Button>}
          {/* only an untouched PENDING booking can be deleted (the server reverses its advance) */}
          {canDelete && b.status === 'PENDING' && <Button variant="ghost" size="sm" onClick={() => setDeleting(b)}>{t('common.delete')}</Button>}
          <BhavRowMenu b={b} />
        </div>
      )
    } },
  ]

  // Summary numbers derived from the page already fetched (no extra requests).
  const items = data?.items ?? []
  const openRows = items.filter((b) => b.status === 'PENDING' || b.status === 'PARTIAL')
  const goldDue = openRows.filter((b) => b.metal === 'GOLD').reduce((sum, b) => sum + n(b.pendingWeight), 0)
  const silverDue = openRows.filter((b) => b.metal === 'SILVER').reduce((sum, b) => sum + n(b.pendingWeight), 0)
  // TRD-04: received (SELL) and given (BUY) advances are never added together
  const advanceTotal = (side: 'BUY' | 'SELL') => items.filter((b) => b.side === side).reduce((sum, b) => sum + n(b.advance), 0)

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl">{t('trade.bhav.title')}</h2>
          <p className="text-sm text-muted-foreground">{t('trade.bhav.subtitle')}</p>
        </div>
        {canEdit && <NewBookingDialog />}
      </div>

      <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tile(t('trade.bhav.tile_locked'), data ? String(data.total) : '—', t('inv.shortage.rows_listed_sub'), Lock)}
        {tile(t('trade.bhav.tile_open'), data ? String(openRows.length) : '—', data ? t('payments.rejected_sub', { total: items.length }) : undefined, Hourglass)}
        {tile(t('trade.bhav.tile_gold_due'), data ? `${goldDue.toFixed(3)} g` : '—', data ? t('trade.silver_sub', { wt: silverDue.toFixed(3) }) : undefined, Scale)}
        {tile(t('trade.bhav.tile_adv'), data ? inr(String(advanceTotal('SELL'))) : '—', data ? t('trade.bhav.tile_adv_sub', { given: inr(String(advanceTotal('BUY'))) }) : undefined, Wallet)}
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 pt-6">
          <Input className="max-w-xs" placeholder={t('trade.search_ph')} value={q} onChange={(e) => { setQ(e.target.value); setPage(1); clearSel() }} />
          <Select value={side || 'all'} onValueChange={(v) => { setSide(v === 'all' ? '' : v); setPage(1); clearSel() }}>
            <SelectTrigger className="w-32" aria-label="Side"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">{t('trade.all_sides')}</SelectItem>{TRADE_SIDES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={metal || 'all'} onValueChange={(v) => { setMetal(v === 'all' ? '' : v); setPage(1); clearSel() }}>
            <SelectTrigger className="w-32" aria-label="Metal"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">{t('trade.all_metals')}</SelectItem>{METALS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); clearSel() }}>
            <SelectTrigger className="w-40" aria-label="Status"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="open">{t('trade.bhav.open_pending')}</SelectItem>
              <SelectItem value="all">{t('draft.all_statuses')}</SelectItem>
              {BHAV_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <DateRangeFilter from={from} to={to} onChange={(a, b) => { setFrom(a); setTo(b); setPage(1); clearSel() }} />
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {canDelete && selected.length > 0 && (
              <Button variant="outline" className="text-destructive hover:text-destructive" disabled={bulkDelete.isPending} onClick={() => setBulkDeleting(true)}>
                {t('trade.bhav.delete_selected', { n: selected.length })}
              </Button>
            )}
            <CsvExportButton filename={`bhav-bookings-${businessDayISO()}.csv`} rows={() => bhavExportRows(filters)} />
          </div>
        </CardContent>
      </Card>

      <Card className="p-4">
        <DataTable columns={columns} data={data?.items ?? []} isLoading={isLoading} emptyText={t('trade.bhav.empty')} pagination={data ? { page: data.page, pageSize: data.pageSize, total: data.total, onPage: (p) => { setPage(p); clearSel() }, onPageSize: (s) => { setPageSize(s); clearSel() } } : undefined} />
      </Card>
      <MpinDialog open={!!cancelling} title={t('trade.bhav.cancel_title', { no: cancelling?.bookingNo ?? '' })} onConfirm={(mpin) => cancel.mutateAsync({ id: cancelling!.id, mpin })} onClose={() => setCancelling(null)} />
      <MpinDialog open={!!deleting} title={t('trade.bhav.delete_title', { no: deleting?.bookingNo ?? '' })} onConfirm={(mpin) => del.mutateAsync({ id: deleting!.id, mpin })} onClose={() => setDeleting(null)} />
      <MpinDialog
        open={bulkDeleting}
        title={selected.length === 1 ? t('trade.bhav.bulk_delete_one', { n: selected.length }) : t('trade.bhav.bulk_delete_other', { n: selected.length })}
        onConfirm={async (mpin) => {
          await bulkDelete.mutateAsync({ bookings: selected.map((b) => ({ id: b.id, bookingNo: b.bookingNo })), mpin })
          clearSel()
        }}
        onClose={() => setBulkDeleting(false)}
      />
    </div>
  )
}
