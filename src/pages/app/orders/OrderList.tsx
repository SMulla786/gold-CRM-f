import type { ColumnDef } from '@tanstack/react-table'
import { ClipboardList, Flame, IndianRupee, Printer, ReceiptText, UserPlus, Wallet, XCircle, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { DataTable } from '@/components/DataTable'
import { MpinDialog } from '@/components/MpinDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAuth } from '@/lib/auth'
import { useBulkCancelOrders, useOrder, useOrders } from '@/lib/ordersQueries'
import { ORDER_STATUSES, type OrderDto } from '@/shared'

import { IssueDialog } from './IssueDialog'
import { OrderPrintBatch } from './OrderPrint'
import { cancellable, karigarStatus, sumOf } from './orderUtils'

const inr = (s: string) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(s))
const date = (s: string) => new Date(s).toLocaleDateString('en-IN')
const VARIANT: Record<string, 'default' | 'secondary' | 'destructive'> = { READY: 'default', PENDING: 'secondary', IN_PROCESS: 'secondary', DELIVERED: 'default', CANCELLED: 'destructive' }
const hasPending = (o: OrderDto) => o.items.some((it) => it.status === 'PENDING')

/** Row action: loads the order fresh (same hook as Order Detail) and opens the shared issue dialog with all its PENDING items. */
function AssignOrderDialog({ orderId, onClose }: { orderId: number; onClose: () => void }) {
  const { data: order, isLoading } = useOrder(orderId)
  const pending = order?.items.filter((it) => it.status === 'PENDING') ?? []
  if (order && pending.length > 0) return <IssueDialog items={pending} onClose={onClose} />
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{order ? `Order #${order.orderNo}` : 'Loading order…'}</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">{isLoading || !order ? 'Loading…' : 'Every item on this order is already with a karigar or done.'}</p>
      </DialogContent>
    </Dialog>
  )
}

/** `?print=1,2,3` (from "Print selected") shows those order slips one per page; otherwise the list. */
export function OrderList() {
  const [sp] = useSearchParams()
  const printIds = [...new Set((sp.get('print') ?? '').split(',').map(Number).filter((x) => Number.isInteger(x) && x > 0))].slice(0, 100)
  return printIds.length ? <OrderPrintBatch ids={printIds} /> : <OrderListView />
}

function OrderListView() {
  const navigate = useNavigate()
  const { can } = useAuth()
  const [status, setStatus] = useState('')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  // OPEN = multi-status preset (statuses=PENDING,IN_PROCESS); any other value is a single status
  const { data, isLoading } = useOrders({ ...(status === 'OPEN' ? { statuses: 'PENDING,IN_PROCESS' } : { status: status || undefined }), q: q || undefined, page, pageSize })
  const bulkCancel = useBulkCancelOrders()
  const [sel, setSel] = useState<Set<number>>(new Set())
  const [confirming, setConfirming] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [failed, setFailed] = useState<Array<{ id: number; orderNo?: number; reason: string }>>([])
  const canCancel = can('orders.create', 'delete')
  const canIssue = can('orders.karigar_list', 'edit')
  const canBill = can('billing.sell_bill', 'edit')
  const [assigning, setAssigning] = useState<number | null>(null)

  // Summary numbers derived from the page already fetched (no extra requests).
  const items = data?.items ?? []
  // Selection is page-local (DataTable has no cross-page selection): cleared on page, page size, search and status change.
  const selected = items.filter((o) => sel.has(o.id))
  const cancellableCount = selected.filter(cancellable).length
  const clearSel = () => setSel(new Set())
  const toggle = (id: number) => setSel((s) => { const x = new Set(s); if (x.has(id)) x.delete(id); else x.add(id); return x })
  const allSelected = items.length > 0 && selected.length === items.length

  const columns: ColumnDef<OrderDto, unknown>[] = [
    {
      id: 'select',
      header: () => <Checkbox aria-label="Choose all orders on this page" checked={allSelected} disabled={items.length === 0} onCheckedChange={(c) => setSel(c ? new Set(items.map((o) => o.id)) : new Set())} />,
      cell: ({ row }) => <Checkbox aria-label={`Choose order ${row.original.orderNo}`} checked={sel.has(row.original.id)} onCheckedChange={() => toggle(row.original.id)} />,
    },
    { header: 'Order', cell: ({ row }) => <Link to={`/app/orders/${row.original.id}`} className="font-medium text-primary hover:underline">#{row.original.orderNo}</Link> },
    { header: 'Date', cell: ({ row }) => date(row.original.orderDate) },
    { header: 'Delivery', cell: ({ row }) => (row.original.deliveryDate ? date(row.original.deliveryDate) : '—') },
    { header: 'Party', cell: ({ row }) => <span>{row.original.party.name}{row.original.isUrgent && <Badge variant="destructive" className="ml-2">Urgent</Badge>}{row.original.party.mobile && <span className="block text-xs text-muted-foreground">{row.original.party.mobile}</span>}</span> },
    {
      header: 'Product & Details',
      cell: ({ row }) => {
        const its = row.original.items
        return <span title={its.map((it) => it.itemName.name).join(', ')}>{its[0]?.itemName.name ?? '—'}{its.length > 1 && <span className="block text-xs text-muted-foreground">+{its.length - 1} more</span>}</span>
      },
    },
    {
      header: 'Gross / Fine (g)',
      cell: ({ row }) => <span className="whitespace-nowrap tabular-nums">{sumOf(row.original.items, (it) => it.gross).toFixed(3)} / {sumOf(row.original.items, (it) => it.fine).toFixed(3)}</span>,
    },
    { header: 'Est.', cell: ({ row }) => inr(row.original.estTotal) },
    { header: 'Advance', cell: ({ row }) => inr(row.original.advance) },
    { header: 'Balance due', cell: ({ row }) => <span className="tabular-nums">{inr(String(Number(row.original.estTotal) - Number(row.original.advance)))}</span> },
    { header: 'Status', cell: ({ row }) => <Badge variant={VARIANT[row.original.status] ?? 'secondary'}>{row.original.status}</Badge> },
    { header: 'Karigar status', cell: ({ row }) => <span className="text-xs text-muted-foreground">{karigarStatus(row.original)}</span> },
    {
      id: 'print',
      header: '',
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          {canBill && row.original.status === 'READY' && (
            <Button asChild size="sm" variant="ghost" title="Bill this ready order"><Link to={`/app/billing?orderId=${row.original.id}`} aria-label={`Bill order ${row.original.orderNo}`}><ReceiptText className="size-4" aria-hidden /></Link></Button>
          )}
          {canIssue && hasPending(row.original) && (
            <Button size="sm" variant="ghost" title="Assign pending items to a karigar" aria-label={`Assign order ${row.original.orderNo} to karigar`} onClick={() => setAssigning(row.original.id)}>
              <UserPlus className="size-4" aria-hidden />
            </Button>
          )}
          <Button asChild size="sm" variant="ghost"><Link to={`/app/orders/${row.original.id}/print`} aria-label={`Print order slip ${row.original.orderNo}`}><Printer className="size-4" aria-hidden /></Link></Button>
        </div>
      ),
    },
  ]

  const urgentRows = items.filter((o) => o.isUrgent).length
  const estTotal = items.reduce((sum, o) => sum + Number(o.estTotal), 0)
  const advanceTotal = items.reduce((sum, o) => sum + Number(o.advance), 0)

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
      <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tile('Order count', data ? String(data.total) : '—', 'Matching current filters', ClipboardList)}
        {tile('Urgent on this page', data ? String(urgentRows) : '—', data ? `of ${items.length} shown` : undefined, Flame)}
        {tile('Estimated value', data ? inr(String(estTotal)) : '—', 'Across this page', IndianRupee)}
        {tile('Advances on this page', data ? inr(String(advanceTotal)) : '—', 'Collected up front', Wallet)}
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 pt-6">
          <Input className="max-w-xs" placeholder="Search order / party / mobile…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); clearSel() }} />
          <Select value={status || 'all'} onValueChange={(v) => { setStatus(v === 'all' ? '' : v); setPage(1); clearSel() }}>
            <SelectTrigger className="w-44" aria-label="Status"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="OPEN">Open (pending + in process)</SelectItem>
              {ORDER_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selected.length > 0 && (
        <div id="orders-bulk-bar" role="toolbar" aria-label="Selected orders" className="flex flex-wrap items-center gap-2 rounded-2xl border bg-muted/50 px-4 py-3">
          <span className="text-sm font-medium tabular-nums">{selected.length} selected</span>
          <Button id="orders-bulk-print" size="sm" variant="outline" className="ml-auto" onClick={() => navigate(`/app/orders?print=${selected.map((o) => o.id).join(',')}`)}>
            <Printer className="size-4" aria-hidden />Print selected
          </Button>
          <Button
            id="orders-bulk-cancel"
            size="sm"
            variant="outline"
            className="text-destructive hover:text-destructive"
            disabled={!canCancel || cancellableCount === 0 || bulkCancel.isPending}
            title={!canCancel ? 'You do not have permission to cancel orders' : cancellableCount === 0 ? 'None of the selected orders can be cancelled' : undefined}
            onClick={() => setConfirming(true)}
          >
            <XCircle className="size-4" aria-hidden />Cancel selected
          </Button>
          <Button id="orders-bulk-clear" size="sm" variant="ghost" onClick={clearSel}>Clear selection</Button>
        </div>
      )}

      <Card className="p-4">
        <DataTable columns={columns} data={data?.items ?? []} isLoading={isLoading} emptyText="No orders" pagination={data ? { page: data.page, pageSize: data.pageSize, total: data.total, onPage: (p) => { setPage(p); clearSel() }, onPageSize: (sz) => { setPageSize(sz); clearSel() } } : undefined} />
      </Card>

      <Dialog open={confirming} onOpenChange={(o) => !o && setConfirming(false)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Cancel selected orders?</DialogTitle>
            <DialogDescription>
              Orders to cancel: {selected.length}. Any order that can no longer be cancelled is skipped and listed afterwards.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirming(false)}>Keep orders</Button>
            <Button id="orders-bulk-cancel-continue" variant="destructive" onClick={() => { setConfirming(false); setCancelling(true) }}>Continue</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <MpinDialog
        open={cancelling}
        title={`Cancel selected orders (${selected.length})`}
        onConfirm={async (mpin) => {
          const noById = new Map(selected.map((o) => [o.id, o.orderNo]))
          const res = await bulkCancel.mutateAsync({ ids: selected.map((o) => o.id), mpin })
          clearSel()
          setFailed(res.failed.map((f) => ({ ...f, orderNo: noById.get(f.id) })))
        }}
        onClose={() => setCancelling(false)}
      />
      <Dialog open={failed.length > 0} onOpenChange={(o) => !o && setFailed([])}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Orders not cancelled</DialogTitle>
            <DialogDescription>These orders were left as they are.</DialogDescription>
          </DialogHeader>
          <ul id="orders-bulk-failed" className="max-h-72 space-y-1 overflow-y-auto text-sm">
            {failed.map((f) => (
              <li key={f.id}><span className="font-medium">{f.orderNo != null ? `Order #${f.orderNo}` : `ID ${f.id}`}</span>: {f.reason}</li>
            ))}
          </ul>
          <DialogFooter><Button onClick={() => setFailed([])}>OK</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      {assigning != null && <AssignOrderDialog orderId={assigning} onClose={() => setAssigning(null)} />}
    </div>
  )
}
