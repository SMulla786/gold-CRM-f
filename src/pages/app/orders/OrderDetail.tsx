import { BadgeIndianRupee, HandCoins, Package, Wallet, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { MpinDialog } from '@/components/MpinDialog'
import { PartyPicker } from '@/components/PartyPicker'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useBankAccounts } from '@/lib/appQueries'
import { useAuth } from '@/lib/auth'
import { useAddOrderAdvance, useCancelOrder, useCreateKarigarIssue, useOrder } from '@/lib/ordersQueries'
import type { OrderDto, PartyRefDto } from '@/shared'

const inr = (s: string) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(s))
const date = (s: string) => new Date(s).toLocaleDateString('en-IN')
const n = (s: string) => Number(s) || 0

function IssueDialog({ itemIds, onClose }: { itemIds: number[]; onClose: () => void }) {
  const issue = useCreateKarigarIssue()
  const { data: banks } = useBankAccounts()
  const [karigar, setKarigar] = useState<PartyRefDto | null>(null)
  const [dueDate, setDueDate] = useState('')
  const [f, setF] = useState({ goldFine: '0', silverFine: '0', cash: '0', online: '0', bankAccountId: '', remark: '' })
  const set = (key: keyof typeof f, v: string) => setF((s) => ({ ...s, [key]: v }))
  const ok = !!karigar && (n(f.online) === 0 || f.bankAccountId)
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Issue {itemIds.length} item{itemIds.length === 1 ? '' : 's'} to karigar</DialogTitle></DialogHeader>
        <div className="grid gap-4">
          <div className="space-y-1.5"><Label>Karigar</Label><PartyPicker value={karigar} onChange={setKarigar} type="KARIGAR" ariaLabel="Karigar" placeholder="Search karigar" /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="ki-due">Due date</Label><Input id="ki-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="ki-gold">Gold fine (g)</Label><Input id="ki-gold" type="number" step="0.001" value={f.goldFine} onChange={(e) => set('goldFine', e.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="ki-silver">Silver fine (g)</Label><Input id="ki-silver" type="number" step="0.001" value={f.silverFine} onChange={(e) => set('silverFine', e.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="ki-cash">Cash ₹</Label><Input id="ki-cash" type="number" value={f.cash} onChange={(e) => set('cash', e.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="ki-online">Online ₹</Label><Input id="ki-online" type="number" value={f.online} onChange={(e) => set('online', e.target.value)} /></div>
            {n(f.online) > 0 && (
              <div className="space-y-1.5"><Label>Bank</Label>
                <Select value={f.bankAccountId} onValueChange={(v) => set('bankAccountId', v)}>
                  <SelectTrigger aria-label="Bank account"><SelectValue placeholder="Bank" /></SelectTrigger>
                  <SelectContent>{banks?.map((b) => <SelectItem key={b.id} value={String(b.id)}>{b.bankName} · {b.accountNo}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div className="space-y-1.5"><Label htmlFor="ki-remark">Remark</Label><Input id="ki-remark" value={f.remark} onChange={(e) => set('remark', e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button disabled={!ok || issue.isPending} onClick={async () => {
            await issue.mutateAsync({ karigarId: karigar!.id, orderItemIds: itemIds, dueDate: dueDate || undefined, goldFine: n(f.goldFine), silverFine: n(f.silverFine), cash: n(f.cash), online: n(f.online), bankAccountId: n(f.online) > 0 ? Number(f.bankAccountId) : undefined, remark: f.remark || undefined })
            onClose()
          }}>Issue</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AdvanceDialog({ order, onClose }: { order: OrderDto; onClose: () => void }) {
  const add = useAddOrderAdvance()
  const { data: banks } = useBankAccounts()
  const [mode, setMode] = useState('CASH')
  const [amount, setAmount] = useState('')
  const [bankAccountId, setBank] = useState('')
  const ok = n(amount) > 0 && (mode === 'CASH' || bankAccountId)
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add advance · order #{order.orderNo}</DialogTitle></DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5"><Label>Mode</Label>
            <Select value={mode} onValueChange={setMode}><SelectTrigger aria-label="Payment mode"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="CASH">Cash</SelectItem><SelectItem value="ONLINE">Online</SelectItem></SelectContent></Select>
          </div>
          <div className="space-y-1.5"><Label htmlFor="adv-amt">Amount ₹</Label><Input id="adv-amt" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
          {mode === 'ONLINE' && (
            <div className="space-y-1.5 sm:col-span-2"><Label>Bank</Label>
              <Select value={bankAccountId} onValueChange={setBank}><SelectTrigger aria-label="Bank account"><SelectValue placeholder="Bank" /></SelectTrigger>
                <SelectContent>{banks?.map((b) => <SelectItem key={b.id} value={String(b.id)}>{b.bankName} · {b.accountNo}</SelectItem>)}</SelectContent></Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button disabled={!ok || add.isPending} onClick={async () => {
            const p = mode === 'ONLINE' ? { mode: 'ONLINE', amount: n(amount), bankAccountId: Number(bankAccountId) } : { mode: 'CASH', amount: n(amount) }
            await add.mutateAsync({ id: order.id, body: { payments: [p] } }); onClose()
          }}>Add advance</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function OrderDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { can } = useAuth()
  const { data: order, isLoading } = useOrder(Number(id))
  const cancel = useCancelOrder()
  const [sel, setSel] = useState<Set<number>>(new Set())
  const [issuing, setIssuing] = useState(false)
  const [advancing, setAdvancing] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  if (isLoading || !order) return <p className="text-sm text-muted-foreground">Loading…</p>

  const pendingIds = order.items.filter((it) => it.status === 'PENDING').map((it) => it.id)
  const selIds = [...sel].filter((x) => pendingIds.includes(x))
  const toggle = (itemId: number) => setSel((s) => { const x = new Set(s); if (x.has(itemId)) x.delete(itemId); else x.add(itemId); return x })
  const canIssue = can('orders.karigar_list', 'edit')
  const canBill = can('billing.sell_bill', 'edit')

  // Summary numbers derived from the order already fetched (no extra requests).
  const activePayments = order.payments.filter((p) => p.isActive).length
  const balanceDue = n(order.estTotal) - n(order.advance)

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
        <div className="space-y-1">
          <Link to="/app/orders" className="inline-flex text-sm text-primary hover:underline">← Orders</Link>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-xl">Order #{order.orderNo}</h2>
            <Badge variant={order.status === 'READY' ? 'default' : order.status === 'CANCELLED' ? 'destructive' : 'secondary'}>{order.status}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {order.party.name} · {order.party.mobile} · {date(order.orderDate)}{order.deliveryDate ? ` → ${date(order.deliveryDate)}` : ''} · {order.rateType === 'FIXED' ? 'Fixed rate' : 'Rate on delivery'}
            {' · '}Est. {inr(order.estTotal)} · Advance {inr(order.advance)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canIssue && selIds.length > 0 && <Button size="sm" onClick={() => setIssuing(true)}>Issue {selIds.length} to karigar</Button>}
          {(order.status === 'PENDING' || order.status === 'IN_PROCESS') && <Button size="sm" variant="outline" onClick={() => setAdvancing(true)}>Add advance</Button>}
          {canBill && order.status === 'READY' && <Button size="sm" onClick={() => navigate(`/app/billing?orderId=${order.id}`)}>Create bill</Button>}
          {order.billId && <Button size="sm" variant="outline" onClick={() => navigate(`/app/billing/view/${order.billId}`)}>View bill</Button>}
          {(order.status === 'PENDING' || order.status === 'IN_PROCESS') && <Button size="sm" variant="ghost" onClick={() => setCancelling(true)}>Cancel</Button>}
        </div>
      </div>

      <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tile('Estimated total', inr(order.estTotal), order.rateType === 'FIXED' ? 'Fixed rate' : 'Rate on delivery', BadgeIndianRupee)}
        {tile('Advance received', inr(order.advance), `${activePayments} payment${activePayments === 1 ? '' : 's'}`, Wallet)}
        {tile('Balance to collect', inr(String(balanceDue)), 'Estimate less advance', HandCoins)}
        {tile('Line items', String(order.items.length), `${pendingIds.length} pending`, Package)}
      </div>

      <section className="space-y-3">
        <h2 className="text-xl">Order items</h2>
        <Card className="overflow-x-auto p-2">
          <Table>
            <TableHeader>
              <TableRow><TableHead /><TableHead>Item</TableHead><TableHead>Metal</TableHead><TableHead>Pcs</TableHead><TableHead>Gross</TableHead><TableHead>Net</TableHead><TableHead>Fine</TableHead><TableHead>Est.</TableHead><TableHead>Status</TableHead><TableHead>Karigar</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {order.items.map((it) => (
                <TableRow key={it.id}>
                  <TableCell>{it.status === 'PENDING' && canIssue ? <Checkbox aria-label={`Select ${it.itemName.name}`} checked={sel.has(it.id)} onCheckedChange={() => toggle(it.id)} /> : null}</TableCell>
                  <TableCell>{it.itemName.name}{it.size ? ` · ${it.size}` : ''}</TableCell>
                  <TableCell>{it.metal} {it.karatCode ?? ''}</TableCell>
                  <TableCell>{it.pcs}</TableCell>
                  <TableCell className="tabular-nums">{it.gross}</TableCell>
                  <TableCell className="tabular-nums">{it.net}</TableCell>
                  <TableCell className="tabular-nums">{it.fine}</TableCell>
                  <TableCell className="tabular-nums">{inr(it.estTotal)}</TableCell>
                  <TableCell><Badge variant="secondary">{it.status}</Badge></TableCell>
                  <TableCell>{it.karigarIssue ? `#${it.karigarIssue.issueNo} ${it.karigarIssue.karigar.name}` : '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </section>

      {order.payments.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xl">Advances</h2>
          <Card>
            <CardContent className="pt-6 text-sm">
              <ul className="space-y-1 text-muted-foreground">
                {order.payments.filter((p) => p.isActive).map((p) => <li key={p.id}>{p.mode}{p.bankAccount ? ` (${p.bankAccount.name})` : ''}{p.metal ? ` ${p.fine}g ${p.metal}` : ''} — {inr(p.amount)}</li>)}
              </ul>
            </CardContent>
          </Card>
        </section>
      )}

      {issuing && <IssueDialog itemIds={selIds} onClose={() => { setIssuing(false); setSel(new Set()) }} />}
      {advancing && <AdvanceDialog order={order} onClose={() => setAdvancing(false)} />}
      <MpinDialog open={cancelling} title={`Cancel order #${order.orderNo}`} onConfirm={(mpin) => cancel.mutateAsync({ id: order.id, mpin })} onClose={() => setCancelling(false)} />
    </div>
  )
}
