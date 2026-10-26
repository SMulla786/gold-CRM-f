import type { ColumnDef } from '@tanstack/react-table'
import { ClipboardList, Flame, IndianRupee, Printer, ReceiptText, UserPlus, Wallet, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { DataTable } from '@/components/DataTable'
import { MpinDialog } from '@/components/MpinDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAuth } from '@/lib/auth'
import { useBulkCancelOrders, useOrder, useOrders } from '@/lib/ordersQueries'
import { ORDER_STATUSES, type OrderDto } from '@/shared'

import { IssueDialog } from './IssueDialog'
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

export function OrderList() {
  const { can } = useAuth()
  const [status, setStatus] = useState('')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  // OPEN = multi-status preset (statuses=PENDING,IN_PROCESS); any other value is a single status
  const { data, isLoading } = useOrders({ ...(status === 'OPEN' ? { statuses: 'PENDING,IN_PROCESS' } : { status: status || undefined }), q: q || undefined, page, pageSize })
  const bulkCancel = useBulkCancelOrders()
  const [sel, setSel] = useState<Set<number>>(new Set())
  const [cancelling, setCancelling] = useState(false)
  const canCancel = can('orders.create', 'delete')
  const canIssue = can('orders.karigar_list', 'edit')
  const canBill = can('billing.sell_bill', 'edit')
  const [assigning, setAssigning] = useState<number | null>(null)

  // Summary numbers derived from the page already fetched (no extra requests).
  const items = data?.items ?? []
  const selectable = items.filter(cancellable)
  const selected = selectable.filter((o) => sel.has(o.id))
  const toggle = (id: number) => setSel((s) => { const x = new Set(s); if (x.has(id)) x.delete(id); else x.add(id); return x })
  const allSelected = selectable.length > 0 && selected.length === selectable.length

  const columns: ColumnDef<OrderDto, unknown>[] = [
    ...(canCancel ? [{
      id: 'select',
      header: () => <Checkbox aria-label="Choose all cancellable orders on this page" checked={allSelected} disabled={selectable.length === 0} onCheckedChange={(c) => setSel(c ? new Set(selectable.map((o) => o.id)) : new Set())} />,
      cell: ({ row }) => cancellable(row.original) ? <Checkbox aria-label={`Choose order ${row.original.orderNo}`} checked={sel.has(row.original.id)} onCheckedChange={() => toggle(row.original.id)} /> : null,
    } satisfies ColumnDef<OrderDto, unknown>] : []),
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
          <Input className="max-w-xs" placeholder="Search order / party / mobile…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); setSel(new Set()) }} />
          <Select value={status || 'all'} onValueChange={(v) => { setStatus(v === 'all' ? '' : v); setPage(1); setSel(new Set()) }}>
            <SelectTrigger className="w-44" aria-label="Status"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="OPEN">Open (pending + in process)</SelectItem>
              {ORDER_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          {canCancel && selected.length > 0 && (
            <Button variant="outline" className="ml-auto text-destructive hover:text-destructive" disabled={bulkCancel.isPending} onClick={() => setCancelling(true)}>
              Cancel selected ({selected.length})
            </Button>
          )}
        </CardContent>
      </Card>

      <Card className="p-4">
        <DataTable columns={columns} data={data?.items ?? []} isLoading={isLoading} emptyText="No orders" pagination={data ? { page: data.page, pageSize: data.pageSize, total: data.total, onPage: (p) => { setPage(p); setSel(new Set()) }, onPageSize: setPageSize } : undefined} />
      </Card>

      <MpinDialog
        open={cancelling}
        title={`Cancel ${selected.length} order${selected.length === 1 ? '' : 's'}`}
        onConfirm={async (mpin) => {
          await bulkCancel.mutateAsync({ orders: selected.map((o) => ({ id: o.id, orderNo: o.orderNo })), mpin })
          setSel(new Set())
        }}
        onClose={() => setCancelling(false)}
      />
      {assigning != null && <AssignOrderDialog orderId={assigning} onClose={() => setAssigning(null)} />}
    </div>
  )
}
