import { FileDown, Printer } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useBusinessProfile } from '@/lib/appQueries'
import { useAuth } from '@/lib/auth'
import { useJustBill } from '@/lib/justbillQueries'
import { amountInWords } from '@/lib/amountInWords'
import { useStates } from '@/lib/queries'
import { downloadPdf, shareOnWhatsApp } from '@/lib/share'

const inr = (s: string) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(s))
const date = (s: string) => new Date(s).toLocaleDateString('en-IN')

export function JustBillView() {
  const { id } = useParams()
  const { me } = useAuth()
  const { data: bill, isLoading } = useJustBill(Number(id))
  const { data: business } = useBusinessProfile()
  const { data: states } = useStates()

  if (isLoading || !bill) return <p className="text-sm text-muted-foreground">Loading…</p>

  const shopName = business?.name ?? me?.business?.name ?? 'Shop'
  const stateName = states?.find((s) => s.id === business?.stateId)?.name
  const who = bill.party?.name ?? bill.customerName
  const summary = `${shopName}\nBill ${bill.billNo} · ${date(bill.billDate)}\nTotal ${inr(bill.final)} · Paid ${inr(bill.paid)} · Balance ${inr(bill.balance)}`

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 print:hidden">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <Link to="/app/billing/just" className="text-sm font-medium text-brand-strong hover:underline">← Just Bills</Link>
            {bill.status === 'DELETED' && <Badge variant="secondary">Deleted</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">Printable copy of this Just Bill. Share, print or save it as a PDF.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => shareOnWhatsApp(bill.mobile ?? '', summary)}>Share</Button>
          <Button variant="outline" onClick={downloadPdf}><FileDown aria-hidden />Download PDF</Button>
          <Button onClick={() => window.print()}><Printer aria-hidden />Print</Button>
        </div>
      </div>

      <div className="print-area space-y-4 text-sm rounded-3xl border border-white/80 bg-card p-6 shadow-sm sm:p-10 dark:border-border print:rounded-none print:border-0 print:bg-transparent print:shadow-none">
        <header className="text-center">
          <div className="text-lg font-bold">{shopName}</div>
          {business?.address && <div>{business.address}</div>}
          {stateName && <div>{stateName}</div>}
          {business?.gstin && <div>GSTIN: {business.gstin}</div>}
          <div className="mt-1 font-medium">{bill.gstPercent !== '0' ? 'TAX INVOICE' : 'BILL'}</div>
        </header>

        <div className="flex justify-between rounded-2xl bg-muted/50 px-4 py-3 print:rounded-none print:border-y print:bg-transparent print:px-0">
          <div><span className="text-muted-foreground">Bill:</span> {bill.billNo}<br /><span className="text-muted-foreground">Date:</span> {date(bill.billDate)}</div>
          <div className="text-right"><div className="font-medium">{who}</div>{bill.mobile && <div>{bill.mobile}</div>}</div>
        </div>

        <Table>
          <TableHeader>
            <TableRow><TableHead>Item</TableHead><TableHead>Karat</TableHead><TableHead>Qty</TableHead><TableHead>Rate</TableHead><TableHead>Making</TableHead><TableHead className="text-right">Total</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {bill.items.map((it) => (
              <TableRow key={it.id}>
                <TableCell className="break-words">{it.name}</TableCell>
                <TableCell>{it.karat ?? '—'}</TableCell>
                <TableCell>{it.quantity} {it.unit === 'GRAM' ? 'g' : 'pcs'}</TableCell>
                <TableCell>{it.rate}</TableCell>
                <TableCell>{it.making}</TableCell>
                <TableCell className="text-right tabular-nums">{inr(it.total)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="ml-auto max-w-xs space-y-1 tabular-nums">
          <Line label="Subtotal" value={inr(bill.sub)} />
          {Number(bill.discountAmount) > 0 && <Line label="Discount" value={`− ${inr(bill.discountAmount)}`} />}
          {bill.gstPercent !== '0' && (bill.interState ? <Line label={`IGST (${bill.gstPercent}%)`} value={inr(bill.igst)} /> : <><Line label="CGST" value={inr(bill.cgst)} /><Line label="SGST" value={inr(bill.sgst)} /></>)}
          {Number(bill.round) !== 0 && <Line label="Round off" value={bill.round} />}
          <div className="flex justify-between border-t-2 border-brand pt-1 text-base font-bold"><span>Final</span><span>{inr(bill.final)}</span></div>
          <Line label="Paid" value={inr(bill.paid)} />
          <div className="flex justify-between font-medium"><span>Balance</span><span>{inr(bill.balance)}</span></div>
        </div>
        <p className="mt-2"><span className="text-muted-foreground">In words:</span> {amountInWords(bill.final)}</p>
      </div>
    </div>
  )
}

function Line({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between"><span className="text-muted-foreground">{label}</span><span>{value}</span></div>
}
