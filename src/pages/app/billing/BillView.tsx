import { Link, useParams } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useBill } from '@/lib/billingQueries'

const inr = (s: string) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(s))
const date = (s: string) => new Date(s).toLocaleDateString('en-IN')

export function BillView() {
  const { id } = useParams()
  const { data: bill, isLoading } = useBill(Number(id))

  if (isLoading || !bill) return <p className="text-sm text-muted-foreground">Loading…</p>

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 print:hidden">
        <Link to="/app/billing/list" className="text-sm text-primary hover:underline">← Bills</Link>
        <Button className="ml-auto" variant="outline" onClick={() => window.print()}>Print</Button>
      </div>

      <div className="print-area space-y-4 rounded-md border p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">{bill.kind === 'SELL' ? 'Sell' : 'Purchase'} Bill · {bill.billNo}</h2>
            <p className="text-sm text-muted-foreground">{date(bill.billDate)} · {bill.branch.name}</p>
            {bill.status === 'DELETED' && <Badge variant="secondary">Deleted</Badge>}
          </div>
          <div className="text-right text-sm">
            <div className="font-medium">{bill.party.name}</div>
            <div className="text-muted-foreground">{bill.party.mobile}</div>
            <Badge variant="secondary">{bill.billType}{bill.interState ? ' · IGST' : ''}</Badge>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead><TableHead>Karat</TableHead><TableHead>Pcs</TableHead>
              <TableHead>Gross</TableHead><TableHead>Net</TableHead><TableHead>Fine</TableHead>
              <TableHead>Rate</TableHead><TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bill.items.map((it) => (
              <TableRow key={it.id}>
                <TableCell>{it.tagNo ? `${it.tagNo} · ` : ''}{it.description}</TableCell>
                <TableCell>{it.karatCode ?? '—'}</TableCell>
                <TableCell>{it.pcs}</TableCell>
                <TableCell>{it.gross}</TableCell>
                <TableCell>{it.net}</TableCell>
                <TableCell>{it.fine}</TableCell>
                <TableCell>{it.rate}</TableCell>
                <TableCell className="text-right">{inr(it.total)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="ml-auto max-w-xs space-y-1 text-sm">
          <Line label="Subtotal" value={inr(bill.sub)} />
          {Number(bill.discountAmount) > 0 && <Line label="Discount" value={`− ${inr(bill.discountAmount)}`} />}
          {bill.billType === 'GST' && (bill.interState
            ? <Line label={`IGST (${bill.gstPercent}%)`} value={inr(bill.igst)} />
            : <><Line label="CGST" value={inr(bill.cgst)} /><Line label="SGST" value={inr(bill.sgst)} /></>)}
          {Number(bill.round) !== 0 && <Line label="Round off" value={bill.round} />}
          <div className="flex justify-between border-t pt-1 text-base font-semibold"><span>Final</span><span>{inr(bill.final)}</span></div>
          <Line label="Paid" value={inr(bill.paid)} />
          <div className="flex justify-between font-medium">
            <span>Balance</span>
            <span>{inr(bill.balance)}{Number(bill.balance) < 0 ? ' (advance)' : ''}{bill.keepBalanceAs !== 'MONEY' && bill.keepWeight ? ` · ${bill.keepWeight}g ${bill.keepBalanceAs}` : ''}</span>
          </div>
        </div>

        {bill.payments.length > 0 && (
          <div className="text-sm">
            <h3 className="mb-1 font-medium">Payments</h3>
            <ul className="space-y-0.5 text-muted-foreground">
              {bill.payments.filter((p) => p.isActive).map((p) => (
                <li key={p.id}>
                  {date(p.txnDate)} · {p.mode}{p.bankAccount ? ` (${p.bankAccount.name})` : ''}{p.metal ? ` ${p.fine}g ${p.metal}` : ''} — {inr(p.amount)}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

function Line({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between"><span className="text-muted-foreground">{label}</span><span>{value}</span></div>
}
