import type { ColumnDef } from '@tanstack/react-table'
import { Hourglass, Lock, Scale, Truck, Wallet, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { DataTable } from '@/components/DataTable'
import { MpinDialog } from '@/components/MpinDialog'
import { PartyPicker } from '@/components/PartyPicker'
import { SelectBranchForTxn } from '@/components/SelectBranchForTxn'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useBankAccounts, useSettings } from '@/lib/appQueries'
import { useAuth } from '@/lib/auth'
import { metalRateUnitGrams } from '@/lib/billingQueries'
import { useBhavBookings, useBulkDeleteBhav, useCancelBhav, useCreateBhav, useDeleteBhav } from '@/lib/tradeQueries'
import { BHAV_STATUSES, businessDayISO, METALS, TRADE_SIDES, metalToMoney, type BhavBookingDto, type PartyRefDto } from '@/shared'

const inr = (s: string) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(s))
const date = (s: string) => new Date(s).toLocaleDateString('en-IN')
const n = (s: string) => Number(s) || 0
const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline'> = { PENDING: 'default', PARTIAL: 'secondary', DELIVERED: 'outline', CANCELLED: 'outline' }

function NewBookingDialog() {
  const { activeBranch } = useAuth()
  const branchReady = activeBranch !== '' && activeBranch !== 'all'
  const { data: banks } = useBankAccounts()
  const { data: settings } = useSettings()
  const create = useCreateBhav()
  const [open, setOpen] = useState(false)
  const [party, setParty] = useState<PartyRefDto | null>(null)
  const blank = () => ({ side: 'BUY', metal: 'GOLD', txnDate: businessDayISO(), weight: '', rate: '', cash: '0', online: '0', bankAccountId: '', narration: '' })
  const [f, setF] = useState(blank)
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }))

  // Read-only preview (the server computes and posts the real figures).
  const finalAmount = Number(metalToMoney(n(f.weight), n(f.rate), metalRateUnitGrams(f.metal, settings)))
  const totalPaid = n(f.cash) + n(f.online)
  const remaining = finalAmount - totalPaid

  const valid = branchReady && !!party && n(f.weight) > 0 && n(f.rate) > 0 && (n(f.online) === 0 || f.bankAccountId)
  const submit = async () => {
    await create.mutateAsync({
      side: f.side, partyId: party!.id, metal: f.metal, txnDate: f.txnDate || undefined, weight: n(f.weight), rate: n(f.rate),
      cash: n(f.cash), online: n(f.online), bankAccountId: n(f.online) > 0 ? Number(f.bankAccountId) : undefined, narration: f.narration || undefined,
    })
    setOpen(false); setParty(null); setF(blank())
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button>New booking</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Book a rate (bhav)</DialogTitle></DialogHeader>
        {!branchReady && <SelectBranchForTxn note="A booking is held at one branch. Select a branch." />}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5"><Label>Side</Label>
            <Select value={f.side} onValueChange={(v) => set('side', v)}><SelectTrigger aria-label="Side"><SelectValue /></SelectTrigger>
              <SelectContent>{TRADE_SIDES.map((s) => <SelectItem key={s} value={s}>{s === 'BUY' ? 'Buy (we buy later)' : 'Sell (we sell later)'}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="space-y-1.5"><Label>Metal</Label>
            <Select value={f.metal} onValueChange={(v) => set('metal', v)}><SelectTrigger aria-label="Metal"><SelectValue /></SelectTrigger>
              <SelectContent>{METALS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="space-y-1.5"><Label htmlFor="bk-party">Party</Label><PartyPicker value={party} onChange={setParty} placeholder="Search name / mobile" id="bk-party" ariaLabel="Party" /></div>
          <div className="space-y-1.5"><Label htmlFor="bk-date">Date</Label><Input id="bk-date" type="date" value={f.txnDate} onChange={(e) => set('txnDate', e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="bk-wt">Weight (g)</Label><Input id="bk-wt" type="number" step="0.001" value={f.weight} onChange={(e) => set('weight', e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="bk-rate">Rate ({f.metal === 'GOLD' ? '/10g' : '/kg'})</Label><Input id="bk-rate" type="number" value={f.rate} onChange={(e) => set('rate', e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="bk-cash">Advance cash ₹</Label><Input id="bk-cash" type="number" value={f.cash} onChange={(e) => set('cash', e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="bk-online">Advance online ₹</Label><Input id="bk-online" type="number" value={f.online} onChange={(e) => set('online', e.target.value)} /></div>
          {n(f.online) > 0 && (
            <div className="col-span-2 space-y-1.5"><Label>Bank</Label>
              <Select value={f.bankAccountId} onValueChange={(v) => set('bankAccountId', v)}><SelectTrigger aria-label="Bank account"><SelectValue placeholder="Bank" /></SelectTrigger>
                <SelectContent>{banks?.map((b) => <SelectItem key={b.id} value={String(b.id)}>{b.bankName} · {b.accountNo}</SelectItem>)}</SelectContent></Select>
            </div>
          )}
          <div className="col-span-2 space-y-1.5"><Label htmlFor="bk-narr">Narration</Label><Input id="bk-narr" value={f.narration} onChange={(e) => set('narration', e.target.value)} /></div>
        </div>
        <div className="space-y-1 rounded-xl bg-muted px-3 py-2 text-sm tabular-nums">
          <div className="flex justify-between"><span className="text-muted-foreground">Final amount</span><span className="font-medium">{inr(String(finalAmount))}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Advance paid</span><span>{inr(String(totalPaid))}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Remaining</span><span className="font-medium">{inr(String(remaining))}</span></div>
        </div>
        <DialogFooter><Button disabled={!valid || create.isPending} onClick={() => void submit().catch(() => {})}>{create.isPending ? 'Saving…' : 'Book'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function BhavBookings() {
  const { can, activeBranch } = useAuth()
  const canEdit = can('buy_sell.bhav_booking', 'edit')
  const canDelete = can('buy_sell.bhav_booking', 'delete')
  const canDeliver = can('buy_sell.entry', 'edit')
  const [side, setSide] = useState('')
  const [metal, setMetal] = useState('')
  // 'open' = PENDING + PARTIAL (the default view: bookings still to be delivered); 'all' = no status filter.
  const [status, setStatus] = useState('open')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const statusParams = status === 'open' ? { open: 'true' } : status === 'all' ? {} : { status }
  const { data, isLoading } = useBhavBookings({ side: side || undefined, metal: metal || undefined, q: q || undefined, ...statusParams, page })
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
    { header: 'No', cell: ({ row }) => <span className="font-medium">#{row.original.bookingNo}</span> },
    { header: 'Date', cell: ({ row }) => date(row.original.txnDate) },
    { header: 'Side', cell: ({ row }) => <Badge variant="secondary">{row.original.side}</Badge> },
    { header: 'Party', cell: ({ row }) => row.original.party.name },
    { header: 'Metal', cell: ({ row }) => row.original.metal },
    { header: 'Weight', cell: ({ row }) => `${row.original.weight} g` },
    { header: 'Pending', cell: ({ row }) => `${row.original.pendingWeight} g` },
    { header: 'Rate', cell: ({ row }) => row.original.rate },
    { header: 'Amount', cell: ({ row }) => inr(row.original.amount) },
    { header: 'Advance', cell: ({ row }) => inr(row.original.advance) },
    { header: 'Status', cell: ({ row }) => <Badge variant={STATUS_VARIANT[row.original.status]}>{row.original.status}</Badge> },
    { id: 'actions', header: '', cell: ({ row }) => {
      const b = row.original
      const isOpen = b.status === 'PENDING' || b.status === 'PARTIAL'
      return (
        <div className="flex justify-end gap-1">
          {/* deliver = a new Buy/Sell prefilled with this booking (same flow as picking it there); posts at the booking's branch */}
          {canDeliver && isOpen && (activeBranch === String(b.branch.id)
            ? <Button asChild variant="ghost" size="sm"><Link to={`/app/buy_sell/new?booking=${b.id}`}><Truck className="size-4" aria-hidden />Deliver</Link></Button>
            : <Button variant="ghost" size="sm" disabled title={`Switch to branch ${b.branch.name} to deliver`}><Truck className="size-4" aria-hidden />Deliver</Button>)}
          {canEdit && isOpen && <Button variant="ghost" size="sm" onClick={() => setCancelling(b)}>Cancel</Button>}
          {/* only an untouched PENDING booking can be deleted (the server reverses its advance) */}
          {canDelete && b.status === 'PENDING' && <Button variant="ghost" size="sm" onClick={() => setDeleting(b)}>Delete</Button>}
        </div>
      )
    } },
  ]

  // Summary numbers derived from the page already fetched (no extra requests).
  const items = data?.items ?? []
  const openRows = items.filter((b) => b.status === 'PENDING' || b.status === 'PARTIAL')
  const goldDue = openRows.filter((b) => b.metal === 'GOLD').reduce((sum, b) => sum + n(b.pendingWeight), 0)
  const silverDue = openRows.filter((b) => b.metal === 'SILVER').reduce((sum, b) => sum + n(b.pendingWeight), 0)
  const advanceTotal = items.reduce((sum, b) => sum + n(b.advance), 0)

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
          <h2 className="text-xl">Rate locks</h2>
          <p className="text-sm text-muted-foreground">Metal rates locked in advance for later delivery</p>
        </div>
        {canEdit && <NewBookingDialog />}
      </div>

      <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tile('Locked rates', data ? String(data.total) : '—', 'Matching current filters', Lock)}
        {tile('Open on this page', data ? String(openRows.length) : '—', data ? `of ${items.length} shown` : undefined, Hourglass)}
        {tile('Gold due on this page', data ? `${goldDue.toFixed(3)} g` : '—', data ? `Silver ${silverDue.toFixed(3)} g` : undefined, Scale)}
        {tile('Advances on this page', data ? inr(String(advanceTotal)) : '—', 'Taken against these locks', Wallet)}
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 pt-6">
          <Input className="max-w-xs" placeholder="Search no / party / mobile…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); clearSel() }} />
          <Select value={side || 'all'} onValueChange={(v) => { setSide(v === 'all' ? '' : v); setPage(1); clearSel() }}>
            <SelectTrigger className="w-32" aria-label="Side"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All sides</SelectItem>{TRADE_SIDES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={metal || 'all'} onValueChange={(v) => { setMetal(v === 'all' ? '' : v); setPage(1); clearSel() }}>
            <SelectTrigger className="w-32" aria-label="Metal"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All metals</SelectItem>{METALS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); clearSel() }}>
            <SelectTrigger className="w-40" aria-label="Status"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Open (pending)</SelectItem>
              <SelectItem value="all">All statuses</SelectItem>
              {BHAV_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          {canDelete && selected.length > 0 && (
            <Button variant="outline" className="ml-auto text-destructive hover:text-destructive" disabled={bulkDelete.isPending} onClick={() => setBulkDeleting(true)}>
              Delete selected ({selected.length})
            </Button>
          )}
        </CardContent>
      </Card>

      <Card className="p-4">
        <DataTable columns={columns} data={data?.items ?? []} isLoading={isLoading} emptyText="No bookings" pagination={data ? { page: data.page, pageSize: data.pageSize, total: data.total, onPage: (p) => { setPage(p); clearSel() } } : undefined} />
      </Card>
      <MpinDialog open={!!cancelling} title={`Cancel booking #${cancelling?.bookingNo ?? ''}`} onConfirm={(mpin) => cancel.mutateAsync({ id: cancelling!.id, mpin })} onClose={() => setCancelling(null)} />
      <MpinDialog open={!!deleting} title={`Delete booking #${deleting?.bookingNo ?? ''}`} onConfirm={(mpin) => del.mutateAsync({ id: deleting!.id, mpin })} onClose={() => setDeleting(null)} />
      <MpinDialog
        open={bulkDeleting}
        title={`Delete ${selected.length} booking${selected.length === 1 ? '' : 's'}`}
        onConfirm={async (mpin) => {
          await bulkDelete.mutateAsync({ bookings: selected.map((b) => ({ id: b.id, bookingNo: b.bookingNo })), mpin })
          clearSel()
        }}
        onClose={() => setBulkDeleting(false)}
      />
    </div>
  )
}
