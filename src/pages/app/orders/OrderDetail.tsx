import { BadgeIndianRupee, HandCoins, Package, Printer, Wallet, type LucideIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { MpinDialog } from '@/components/MpinDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { api } from '@/lib/api'
import { useBankAccounts } from '@/lib/appQueries'
import { useAuth } from '@/lib/auth'
import { useJewelleryTypes } from '@/lib/inventoryQueries'
import { orderDesignPath, useAddOrderAdvance, useCancelOrder, useOrder, useRemoveOrderDesign, useUploadOrderDesign } from '@/lib/ordersQueries'
import type { OrderDto } from '@/shared'

import { IssueDialog } from './IssueDialog'

const inr = (s: string) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(s))
const date = (s: string) => new Date(s).toLocaleDateString('en-IN')
const n = (s: string) => Number(s) || 0
const MAKING_UNIT: Record<string, string> = { PER_GRAM: '/g', PERCENT: '%', FIXED: '' }

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

/** Order design file: image preview or "Open design" for a PDF (blob-fetched: the stream needs the bearer header). */
function DesignCard({ order }: { order: OrderDto }) {
  const { can } = useAuth()
  const canEdit = can('orders.create', 'edit')
  const upload = useUploadOrderDesign()
  const remove = useRemoveOrderDesign()
  const input = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<{ url: string; pdf: boolean } | null>(null)
  useEffect(() => {
    if (!order.designUrl) return
    let active = true
    let obj: string | null = null
    api.blob(orderDesignPath(order.id)).then((b) => { if (active) { obj = URL.createObjectURL(b); setFile({ url: obj, pdf: b.type === 'application/pdf' }) } }).catch(() => {})
    return () => { active = false; setFile(null); if (obj) URL.revokeObjectURL(obj) }
  }, [order.id, order.designUrl])
  const save = async (f: File | undefined) => {
    if (f) await upload.mutateAsync({ id: order.id, file: f }).catch(() => {})
    if (input.current) input.current.value = ''
  }
  return (
    <section className="space-y-3">
      <h2 className="text-xl">Design</h2>
      <Card>
        <CardContent className="flex flex-wrap items-center gap-4 pt-6 text-sm">
          {!order.designUrl ? <span className="text-muted-foreground">No design file.</span>
            : !file ? <span className="text-muted-foreground">Loading design…</span>
            : file.pdf ? <Button asChild size="sm" variant="outline"><a href={file.url} target="_blank" rel="noreferrer">Open design</a></Button>
            : <a href={file.url} target="_blank" rel="noreferrer"><img src={file.url} alt={`Order #${order.orderNo} design`} className="max-h-48 rounded-xl border object-contain" /></a>}
          {canEdit && (
            <div className="flex flex-wrap items-center gap-2">
              <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" aria-label="Design file" onChange={(e) => void save(e.target.files?.[0])} />
              <Button type="button" size="sm" variant="outline" disabled={upload.isPending} onClick={() => input.current?.click()}>{order.designUrl ? 'Replace design' : 'Upload design'}</Button>
              {order.designUrl && <Button type="button" size="sm" variant="ghost" disabled={remove.isPending} onClick={() => void remove.mutateAsync(order.id).catch(() => {})}>Remove design</Button>}
              <span className="text-xs text-muted-foreground">Image or PDF, up to 2 MB</span>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  )
}

export function OrderDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { can } = useAuth()
  const { data: order, isLoading } = useOrder(Number(id))
  const { data: jewelleryTypes } = useJewelleryTypes()
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
            {order.goldRate ? ` · Gold ${inr(order.goldRate)}` : ''}{order.silverRate ? ` · Silver ${inr(order.silverRate)}` : ''}
            {' · '}Est. {inr(order.estTotal)}{n(order.miscCharges) ? ` (incl. misc ${inr(order.miscCharges)})` : ''} · Advance {inr(order.advance)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canIssue && selIds.length > 0 && <Button size="sm" onClick={() => setIssuing(true)}>Issue {selIds.length} to karigar</Button>}
          {(order.status === 'PENDING' || order.status === 'IN_PROCESS') && <Button size="sm" variant="outline" onClick={() => setAdvancing(true)}>Add advance</Button>}
          {canBill && order.status === 'READY' && <Button size="sm" onClick={() => navigate(`/app/billing?orderId=${order.id}`)}>Create bill</Button>}
          {order.billId && <Button size="sm" variant="outline" onClick={() => navigate(`/app/billing/view/${order.billId}`)}>View bill</Button>}
          <Button size="sm" variant="outline" onClick={() => navigate(`/app/orders/${order.id}/print`)}><Printer className="size-4" aria-hidden />Print slip</Button>
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
              <TableRow>
                <TableHead /><TableHead>Item</TableHead><TableHead>Type</TableHead><TableHead>Metal</TableHead><TableHead>Pcs</TableHead><TableHead>Gross</TableHead><TableHead>Net</TableHead><TableHead>Fine</TableHead>
                <TableHead>Touch</TableHead><TableHead>Wst%</TableHead><TableHead>Wst g</TableHead><TableHead>Making</TableHead><TableHead>Other ₹</TableHead><TableHead>Line labour ₹</TableHead>
                <TableHead>Est.</TableHead><TableHead>Status</TableHead><TableHead>Karigar</TableHead>
                <TableHead>Returned g / n / f</TableHead><TableHead>Ghat (g)</TableHead><TableHead>Labour ₹</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.items.map((it) => (
                <TableRow key={it.id}>
                  <TableCell>{it.status === 'PENDING' && canIssue ? <Checkbox aria-label={`Select ${it.itemName.name}`} checked={sel.has(it.id)} onCheckedChange={() => toggle(it.id)} /> : null}</TableCell>
                  <TableCell>{it.itemName.name}{it.size ? ` · ${it.size}` : ''}{it.remark ? <span className="block text-xs text-muted-foreground">{it.remark}</span> : null}</TableCell>
                  <TableCell>{jewelleryTypes?.find((jt) => jt.id === it.jewelleryTypeId)?.name ?? '—'}</TableCell>
                  <TableCell>{it.metal} {it.karatCode ?? ''}</TableCell>
                  <TableCell>{it.pcs}</TableCell>
                  <TableCell className="tabular-nums">{it.gross}</TableCell>
                  <TableCell className="tabular-nums">{it.net}</TableCell>
                  <TableCell className="tabular-nums">{it.fine}</TableCell>
                  <TableCell className="tabular-nums">{it.touch}</TableCell>
                  <TableCell className="tabular-nums">{it.wastage}</TableCell>
                  <TableCell className="tabular-nums">{it.wastageGm}</TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums">{it.making}{MAKING_UNIT[it.makingUnit] ?? ''}</TableCell>
                  <TableCell className="tabular-nums">{it.other}</TableCell>
                  <TableCell className="tabular-nums">{inr(it.labour)}</TableCell>
                  <TableCell className="tabular-nums">{inr(it.estTotal)}</TableCell>
                  <TableCell><Badge variant="secondary">{it.status}</Badge></TableCell>
                  <TableCell>{it.karigarIssue ? `#${it.karigarIssue.issueNo} ${it.karigarIssue.karigar.name}` : '—'}</TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums">{it.returnedGross != null ? `${it.returnedGross} / ${it.returnedNet ?? '—'} / ${it.returnedFine ?? '—'}` : '—'}</TableCell>
                  <TableCell className="tabular-nums">{it.ghatAllowance ?? '—'}</TableCell>
                  <TableCell className="tabular-nums">{it.karigarLabour != null ? inr(it.karigarLabour) : '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </section>

      <DesignCard order={order} />

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

      {issuing && <IssueDialog items={order.items.filter((it) => selIds.includes(it.id))} onClose={() => { setIssuing(false); setSel(new Set()) }} />}
      {advancing && <AdvanceDialog order={order} onClose={() => setAdvancing(false)} />}
      <MpinDialog open={cancelling} title={`Cancel order #${order.orderNo}`} onConfirm={(mpin) => cancel.mutateAsync({ id: order.id, mpin })} onClose={() => setCancelling(false)} />
    </div>
  )
}
