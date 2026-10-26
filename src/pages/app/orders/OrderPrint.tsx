import { useIsFetching } from '@tanstack/react-query'
import { Printer } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useBusinessProfile } from '@/lib/appQueries'
import { useAuth } from '@/lib/auth'
import { useJewelleryTypes } from '@/lib/inventoryQueries'
import { useOrder } from '@/lib/ordersQueries'
import { cn } from '@/lib/utils'
import type { BusinessProfileDto, JewelleryTypeDto, OrderDto } from '@/shared'

const inr = (s: string | number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(s))
const date = (s: string) => new Date(s).toLocaleDateString('en-IN')
const n = (s: string | null | undefined) => Number(s) || 0
const UNIT: Record<string, string> = { PER_GRAM: '/g', PERCENT: '%', FIXED: '' }

/** Printable order slip (customer copy / workshop job card) for /app/orders/:id/print. */
export function OrderPrint() {
  const { id } = useParams()
  const { me } = useAuth()
  const { data: order, isLoading } = useOrder(Number(id))
  const { data: business } = useBusinessProfile()
  const { data: jewelleryTypes } = useJewelleryTypes()

  if (isLoading || !order) return <p className="text-sm text-muted-foreground">Loading…</p>

  const shopName = business?.name ?? me?.business?.name ?? 'Shop'

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 print:hidden">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <Link to={`/app/orders/${order.id}`} className="text-sm font-medium text-brand-strong hover:underline">← Order #{order.orderNo}</Link>
            {order.status === 'CANCELLED' && <Badge variant="destructive">Cancelled</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">Printable order slip. Print it or save it as a PDF from the print dialog.</p>
        </div>
        <Button onClick={() => window.print()}><Printer aria-hidden />Print</Button>
      </div>

      <OrderSlip order={order} shopName={shopName} business={business} jewelleryTypes={jewelleryTypes} className="print-area" />
    </div>
  )
}

function Line({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between"><span className="text-muted-foreground">{label}</span><span>{value}</span></div>
}

interface SlipProps { order: OrderDto; shopName: string; business?: BusinessProfileDto; jewelleryTypes?: JewelleryTypeDto[]; className?: string }

/** The slip body itself; shared by the single print page and the multi-order print view. */
function OrderSlip({ order, shopName, business, jewelleryTypes, className }: SlipProps) {
  const totals = order.items.reduce((a, it) => ({ pcs: a.pcs + it.pcs, gross: a.gross + n(it.gross), net: a.net + n(it.net), fine: a.fine + n(it.fine) }), { pcs: 0, gross: 0, net: 0, fine: 0 })
  const balanceDue = n(order.estTotal) - n(order.advance)
  const activePays = order.payments.filter((p) => p.isActive)

  return (
    <div className={cn('space-y-4 rounded-3xl border border-white/80 bg-card p-6 text-sm shadow-sm sm:p-10 dark:border-border print:rounded-none print:border-0 print:bg-transparent print:shadow-none', className)}>
      <header className="text-center">
        <div className="text-lg font-bold">{shopName}</div>
        {business?.address && <div>{business.address}</div>}
        {business?.gstin && <div>GSTIN: {business.gstin}</div>}
        <div className="mt-1 font-medium">ORDER SLIP{order.isUrgent ? ' · URGENT' : ''}</div>
      </header>

      <div className="flex flex-wrap justify-between gap-4 rounded-2xl bg-muted/50 px-4 py-3 print:rounded-none print:border-y print:bg-transparent print:px-0">
        <div>
          <span className="text-muted-foreground">Order:</span> #{order.orderNo}<br />
          <span className="text-muted-foreground">Date:</span> {date(order.orderDate)}<br />
          <span className="text-muted-foreground">Delivery:</span> {order.deliveryDate ? date(order.deliveryDate) : '—'}
        </div>
        <div className="text-right">
          <div className="font-medium">{order.party.name}</div>
          {order.party.mobile && <div>{order.party.mobile}</div>}
          <div className="text-muted-foreground">
            {order.rateType === 'FIXED' ? 'Fixed rate' : 'Rate on delivery'}
            {order.goldRate ? ` · Gold ${inr(order.goldRate)}` : ''}
            {order.silverRate ? ` · Silver ${inr(order.silverRate)}` : ''}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto print:overflow-visible">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead><TableHead>Metal</TableHead><TableHead>Size</TableHead><TableHead>Pcs</TableHead><TableHead>Gross</TableHead><TableHead>Less</TableHead><TableHead>Net</TableHead>
              <TableHead>Touch</TableHead><TableHead>Wst%</TableHead><TableHead>Wst g</TableHead><TableHead>Fine</TableHead><TableHead>Making</TableHead><TableHead>Other</TableHead><TableHead>Labour</TableHead><TableHead className="text-right">Est.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {order.items.map((it) => (
              <TableRow key={it.id}>
                <TableCell className="break-words">{it.itemName.name}{it.jewelleryTypeId ? <div className="text-xs text-muted-foreground">{jewelleryTypes?.find((jt) => jt.id === it.jewelleryTypeId)?.name}</div> : null}{it.remark ? <div className="text-xs text-muted-foreground">{it.remark}</div> : null}</TableCell>
                <TableCell>{it.metal} {it.karatCode ?? ''}</TableCell>
                <TableCell>{it.size ?? '—'}</TableCell>
                <TableCell className="tabular-nums">{it.pcs}</TableCell>
                <TableCell className="tabular-nums">{it.gross}</TableCell>
                <TableCell className="tabular-nums">{it.less}</TableCell>
                <TableCell className="tabular-nums">{it.net}</TableCell>
                <TableCell className="tabular-nums">{it.touch}</TableCell>
                <TableCell className="tabular-nums">{it.wastage}</TableCell>
                <TableCell className="tabular-nums">{it.wastageGm}</TableCell>
                <TableCell className="tabular-nums">{it.fine}</TableCell>
                <TableCell className="tabular-nums">{it.making}{UNIT[it.makingUnit] ?? ''}</TableCell>
                <TableCell className="tabular-nums">{it.other}</TableCell>
                <TableCell className="tabular-nums">{it.labour}</TableCell>
                <TableCell className="text-right tabular-nums">{inr(it.estTotal)}</TableCell>
              </TableRow>
            ))}
            <TableRow className="font-medium">
              <TableCell>Total</TableCell><TableCell /><TableCell />
              <TableCell className="tabular-nums">{totals.pcs}</TableCell>
              <TableCell className="tabular-nums">{totals.gross.toFixed(3)}</TableCell>
              <TableCell />
              <TableCell className="tabular-nums">{totals.net.toFixed(3)}</TableCell>
              <TableCell /><TableCell /><TableCell />
              <TableCell className="tabular-nums">{totals.fine.toFixed(3)}</TableCell>
              <TableCell /><TableCell /><TableCell />
              <TableCell className="text-right tabular-nums">{inr(order.estTotal)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="space-y-1">
          {activePays.length > 0 && (
            <>
              <div className="font-medium">Advances</div>
              <ul className="space-y-0.5 text-muted-foreground">
                {activePays.map((p) => <li key={p.id}>{date(p.txnDate)} · {p.mode}{p.metal ? ` ${p.metalForm ?? ''} ${p.fine}g ${p.metal}` : ''} — {inr(p.amount)}</li>)}
              </ul>
            </>
          )}
          {order.remark && <p><span className="text-muted-foreground">Remark:</span> {order.remark}</p>}
        </div>
        <div className="ml-auto w-full max-w-xs space-y-1 tabular-nums">
          {n(order.miscCharges) > 0 && <Line label="Misc charges (incl.)" value={inr(order.miscCharges)} />}
          <Line label="Estimated total" value={inr(order.estTotal)} />
          <Line label="Advance" value={inr(order.advance)} />
          <div className="flex justify-between border-t-2 border-brand pt-1 text-base font-bold"><span>Balance due</span><span>{inr(balanceDue)}</span></div>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Estimate only; the final amount is billed on delivery{order.rateType === 'FIXED' ? ' at the fixed rate above' : ' at that day\'s rate'}.</p>

      <div className="grid grid-cols-2 gap-10 pt-10 text-center text-xs text-muted-foreground">
        <div className="border-t pt-1">Customer signature</div>
        <div className="border-t pt-1">For {shopName}</div>
      </div>
    </div>
  )
}

/**
 * TASK-98: several order slips in one print job, one slip per page (/app/orders?print=1,2,3, rendered by OrderList).
 * One outer .print-area (it is absolutely positioned in print CSS, so the slips must not each be one).
 */
export function OrderPrintBatch({ ids }: { ids: number[] }) {
  const { me } = useAuth()
  const { data: business } = useBusinessProfile()
  const { data: jewelleryTypes } = useJewelleryTypes()
  const loading = useIsFetching({ queryKey: ['order'] }) > 0
  const shopName = business?.name ?? me?.business?.name ?? 'Shop'

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 print:hidden">
        <div className="space-y-1">
          <Link to="/app/orders" className="text-sm font-medium text-brand-strong hover:underline">← All orders</Link>
          <p className="text-sm text-muted-foreground">Order slips: {ids.length}. Each slip prints on its own page.</p>
        </div>
        <Button id="orders-print-all" disabled={loading} onClick={() => window.print()}><Printer aria-hidden />Print all</Button>
      </div>
      <div className="print-area space-y-6 print:space-y-0">
        {ids.map((id) => <BatchSlip key={id} id={id} shopName={shopName} business={business} jewelleryTypes={jewelleryTypes} />)}
      </div>
    </div>
  )
}

function BatchSlip({ id, ...rest }: Omit<SlipProps, 'order' | 'className'> & { id: number }) {
  const { data: order, isError } = useOrder(id)
  if (isError) return <p className="text-sm text-destructive print:hidden">Could not load order (ID {id}).</p>
  if (!order) return <p className="text-sm text-muted-foreground print:hidden">Loading…</p>
  return <OrderSlip order={order} {...rest} className="break-after-page last:break-after-auto" />
}
