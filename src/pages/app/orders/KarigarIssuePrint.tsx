import { Printer } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useBusinessProfile } from '@/lib/appQueries'
import { useAuth } from '@/lib/auth'
import { useKarigarIssue } from '@/lib/ordersQueries'

const inr = (s: string | number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(s))
const date = (s: string) => new Date(s).toLocaleDateString('en-IN')
const n = (s: string | null | undefined) => Number(s) || 0

/** Printable karigar assignment / issue slip for /app/orders/karigar/:id/print. */
export function KarigarIssuePrint() {
  const { id } = useParams()
  const { me } = useAuth()
  const { data: issue, isLoading } = useKarigarIssue(Number(id))
  const { data: business } = useBusinessProfile()

  if (isLoading || !issue) return <p className="text-sm text-muted-foreground">Loading…</p>

  const shopName = business?.name ?? me?.business?.name ?? 'Shop'
  const totals = issue.items.reduce((a, it) => ({ pcs: a.pcs + it.pcs, gross: a.gross + n(it.gross), less: a.less + n(it.less), net: a.net + n(it.net), fine: a.fine + n(it.fine) }), { pcs: 0, gross: 0, less: 0, net: 0, fine: 0 })
  const received = issue.items.filter((it) => it.status === 'RECEIVED')

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 print:hidden">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <Link to="/app/orders/karigar" className="text-sm font-medium text-brand-strong hover:underline">← Karigar issues</Link>
            <Badge variant={issue.status === 'OPEN' ? 'secondary' : 'default'}>{issue.status}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">Printable assignment slip to hand over with the material.</p>
        </div>
        <Button onClick={() => window.print()}><Printer aria-hidden />Print</Button>
      </div>

      <div className="print-area space-y-4 rounded-3xl border border-white/80 bg-card p-6 text-sm shadow-sm sm:p-10 dark:border-border print:rounded-none print:border-0 print:bg-transparent print:shadow-none">
        <header className="text-center">
          <div className="text-lg font-bold">{shopName}</div>
          {business?.address && <div>{business.address}</div>}
          <div className="mt-1 font-medium">KARIGAR ISSUE SLIP</div>
        </header>

        <div className="flex flex-wrap justify-between gap-4 rounded-2xl bg-muted/50 px-4 py-3 print:rounded-none print:border-y print:bg-transparent print:px-0">
          <div>
            <span className="text-muted-foreground">Issue:</span> #{issue.issueNo}<br />
            <span className="text-muted-foreground">Date:</span> {date(issue.issueDate)}<br />
            <span className="text-muted-foreground">Due:</span> {issue.dueDate ? date(issue.dueDate) : '—'}
          </div>
          <div className="text-right">
            <div className="font-medium">{issue.karigar.name}</div>
            {issue.karigar.mobile && <div>{issue.karigar.mobile}</div>}
          </div>
        </div>

        <div className="overflow-x-auto print:overflow-visible">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead><TableHead>Order</TableHead><TableHead>Metal</TableHead><TableHead>Size</TableHead><TableHead>Pcs</TableHead>
                <TableHead>Gross</TableHead><TableHead>Less</TableHead><TableHead>Net</TableHead><TableHead>Touch</TableHead><TableHead className="text-right">Fine</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {issue.items.map((it) => (
                <TableRow key={it.id}>
                  <TableCell className="break-words">{it.itemName.name}{it.remark ? <div className="text-xs text-muted-foreground">{it.remark}</div> : null}</TableCell>
                  <TableCell>#{it.order.orderNo}</TableCell>
                  <TableCell>{it.metal} {it.karatCode ?? ''}</TableCell>
                  <TableCell>{it.size ?? '—'}</TableCell>
                  <TableCell className="tabular-nums">{it.pcs}</TableCell>
                  <TableCell className="tabular-nums">{it.gross}</TableCell>
                  <TableCell className="tabular-nums">{it.less}</TableCell>
                  <TableCell className="tabular-nums">{it.net}</TableCell>
                  <TableCell className="tabular-nums">{it.touch}</TableCell>
                  <TableCell className="text-right tabular-nums">{it.fine}</TableCell>
                </TableRow>
              ))}
              <TableRow className="font-medium">
                <TableCell>Total</TableCell><TableCell /><TableCell /><TableCell />
                <TableCell className="tabular-nums">{totals.pcs}</TableCell>
                <TableCell className="tabular-nums">{totals.gross.toFixed(3)}</TableCell>
                <TableCell className="tabular-nums">{totals.less.toFixed(3)}</TableCell>
                <TableCell className="tabular-nums">{totals.net.toFixed(3)}</TableCell>
                <TableCell />
                <TableCell className="text-right tabular-nums">{totals.fine.toFixed(3)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        <div className="ml-auto max-w-xs space-y-1 tabular-nums">
          <div className="font-medium">Material handed over</div>
          <Line label="Gold fine" value={`${issue.goldFine} g`} />
          <Line label="Silver fine" value={`${issue.silverFine} g`} />
          <Line label="Cash" value={inr(issue.cash)} />
          <Line label={`Online${issue.bankAccount ? ` (${issue.bankAccount.name})` : ''}`} value={inr(issue.online)} />
          {issue.wastagePercent != null && <Line label="Wastage agreed" value={`${issue.wastagePercent} %`} />}
          {issue.wastageGm != null && <Line label="Wastage agreed (g)" value={`${issue.wastageGm} g`} />}
        </div>

        {received.length > 0 && (
          <div className="space-y-1">
            <div className="font-medium">Received back</div>
            <ul className="space-y-0.5 text-muted-foreground tabular-nums">
              {received.map((it) => <li key={it.id}>{it.itemName.name} (ord #{it.order.orderNo}) · gross {it.returnedGross ?? '—'}g · net {it.returnedNet ?? '—'}g · fine {it.returnedFine ?? '—'}g · ghat {it.ghatAllowance ?? '0.000'}g · labour {inr(it.karigarLabour ?? '0')}</li>)}
            </ul>
          </div>
        )}
        {!!issue.samples?.length && (
          <div className="space-y-1">
            <div className="font-medium">Tounch samples handed over</div>
            <ul className="space-y-0.5 text-muted-foreground tabular-nums">
              {issue.samples.map((s) => <li key={s.id}>#{s.sampleNo} · {s.metal} · gross {s.grossWt}g · tounch {s.tounchPercent}% · fine {s.fine}g</li>)}
            </ul>
          </div>
        )}
        {issue.remark && <p><span className="text-muted-foreground">Remark:</span> {issue.remark}</p>}

        <div className="grid grid-cols-2 gap-10 pt-10 text-center text-xs text-muted-foreground">
          <div className="border-t pt-1">Karigar signature</div>
          <div className="border-t pt-1">For {shopName}</div>
        </div>
      </div>
    </div>
  )
}

function Line({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between"><span className="text-muted-foreground">{label}</span><span>{value}</span></div>
}
