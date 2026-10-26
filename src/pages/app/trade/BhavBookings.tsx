import type { ColumnDef } from '@tanstack/react-table'
import { Hourglass, Lock, Scale, Wallet, type LucideIcon } from 'lucide-react'
import { useState } from 'react'

import { DataTable } from '@/components/DataTable'
import { MpinDialog } from '@/components/MpinDialog'
import { PartyPicker } from '@/components/PartyPicker'
import { SelectBranchForTxn } from '@/components/SelectBranchForTxn'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useBankAccounts } from '@/lib/appQueries'
import { useAuth } from '@/lib/auth'
import { useBhavBookings, useCancelBhav, useCreateBhav } from '@/lib/tradeQueries'
import { BHAV_STATUSES, METALS, TRADE_SIDES, type BhavBookingDto, type PartyRefDto } from '@/shared'

const inr = (s: string) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(s))
const date = (s: string) => new Date(s).toLocaleDateString('en-IN')
const n = (s: string) => Number(s) || 0
const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline'> = { PENDING: 'default', PARTIAL: 'secondary', DELIVERED: 'outline', CANCELLED: 'outline' }

function NewBookingDialog() {
  const { activeBranch } = useAuth()
  const branchReady = activeBranch !== '' && activeBranch !== 'all'
  const { data: banks } = useBankAccounts()
  const create = useCreateBhav()
  const [open, setOpen] = useState(false)
  const [party, setParty] = useState<PartyRefDto | null>(null)
  const [f, setF] = useState({ side: 'BUY', metal: 'GOLD', weight: '', rate: '', cash: '0', online: '0', bankAccountId: '', narration: '' })
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }))

  const valid = branchReady && !!party && n(f.weight) > 0 && n(f.rate) > 0 && (n(f.online) === 0 || f.bankAccountId)
  const submit = async () => {
    await create.mutateAsync({
      side: f.side, partyId: party!.id, metal: f.metal, weight: n(f.weight), rate: n(f.rate),
      cash: n(f.cash), online: n(f.online), bankAccountId: n(f.online) > 0 ? Number(f.bankAccountId) : undefined, narration: f.narration || undefined,
    })
    setOpen(false); setParty(null); setF({ side: 'BUY', metal: 'GOLD', weight: '', rate: '', cash: '0', online: '0', bankAccountId: '', narration: '' })
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
          <div className="col-span-2 space-y-1.5"><Label htmlFor="bk-party">Party</Label><PartyPicker value={party} onChange={setParty} placeholder="Search name / mobile" id="bk-party" ariaLabel="Party" /></div>
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
        <DialogFooter><Button disabled={!valid || create.isPending} onClick={() => void submit().catch(() => {})}>{create.isPending ? 'Saving…' : 'Book'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function BhavBookings() {
  const { can } = useAuth()
  const canEdit = can('buy_sell.bhav_booking', 'edit')
  const [side, setSide] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const { data, isLoading } = useBhavBookings({ side: side || undefined, status: status || undefined, page })
  const cancel = useCancelBhav()
  const [cancelling, setCancelling] = useState<BhavBookingDto | null>(null)

  const columns: ColumnDef<BhavBookingDto, unknown>[] = [
    { header: 'No', cell: ({ row }) => <span className="font-medium">#{row.original.bookingNo}</span> },
    { header: 'Date', cell: ({ row }) => date(row.original.txnDate) },
    { header: 'Side', cell: ({ row }) => <Badge variant="secondary">{row.original.side}</Badge> },
    { header: 'Party', cell: ({ row }) => row.original.party.name },
    { header: 'Metal', cell: ({ row }) => row.original.metal },
    { header: 'Weight', cell: ({ row }) => `${row.original.weight} g` },
    { header: 'Pending', cell: ({ row }) => `${row.original.pendingWeight} g` },
    { header: 'Rate', cell: ({ row }) => row.original.rate },
    { header: 'Advance', cell: ({ row }) => inr(row.original.advance) },
    { header: 'Status', cell: ({ row }) => <Badge variant={STATUS_VARIANT[row.original.status]}>{row.original.status}</Badge> },
    { id: 'actions', header: '', cell: ({ row }) => (canEdit && (row.original.status === 'PENDING' || row.original.status === 'PARTIAL') ? <Button variant="ghost" size="sm" onClick={() => setCancelling(row.original)}>Cancel</Button> : null) },
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
          <Select value={side || 'all'} onValueChange={(v) => { setSide(v === 'all' ? '' : v); setPage(1) }}>
            <SelectTrigger className="w-32" aria-label="Side"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All sides</SelectItem>{TRADE_SIDES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={status || 'all'} onValueChange={(v) => { setStatus(v === 'all' ? '' : v); setPage(1) }}>
            <SelectTrigger className="w-40" aria-label="Status"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All statuses</SelectItem>{BHAV_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card className="p-4">
        <DataTable columns={columns} data={data?.items ?? []} isLoading={isLoading} emptyText="No bookings" pagination={data ? { page: data.page, pageSize: data.pageSize, total: data.total, onPage: setPage } : undefined} />
      </Card>
      <MpinDialog open={!!cancelling} title={`Cancel booking #${cancelling?.bookingNo ?? ''}`} onConfirm={(mpin) => cancel.mutateAsync({ id: cancelling!.id, mpin })} onClose={() => setCancelling(null)} />
    </div>
  )
}
