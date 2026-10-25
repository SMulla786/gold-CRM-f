import { amountInWords } from '@/lib/amountInWords'
import type { BillDto, BusinessProfileDto } from '@/shared'

const inr = (s: string) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(s))
const date = (s: string) => new Date(s).toLocaleDateString('en-IN')

interface Props {
  bill: BillDto
  shopName: string
  business?: BusinessProfileDto | null
  stateName?: string
  terms?: string
  thermal: boolean
}

/** Printable invoice — A4 (full table) or 80 mm thermal (compact). Shop header + party + items + GST + amount in words + terms. */
export function BillInvoice({ bill, shopName, business, stateName, terms, thermal }: Props) {
  const header = (
    <header className="text-center">
      <div className={thermal ? 'text-sm font-bold' : 'text-lg font-bold'}>{shopName}</div>
      {business?.address && <div>{business.address}</div>}
      {stateName && <div>{stateName}</div>}
      {business?.gstin && <div>GSTIN: {business.gstin}</div>}
      <div className="mt-1 font-medium">{bill.kind === 'SELL' ? 'TAX INVOICE' : 'PURCHASE'} {bill.billType === 'ROUGH' ? '(ROUGH)' : ''}</div>
    </header>
  )

  const meta = (
    <div className={thermal ? 'space-y-0.5' : 'flex justify-between'}>
      <div>
        <div><span className="text-muted-foreground">Bill:</span> {bill.billNo}</div>
        <div><span className="text-muted-foreground">Date:</span> {date(bill.billDate)}</div>
      </div>
      <div className={thermal ? '' : 'text-right'}>
        <div className="font-medium">{bill.party.name}</div>
        <div>{bill.party.mobile}</div>
      </div>
    </div>
  )

  const totals = (
    <div className={thermal ? 'space-y-0.5' : 'ml-auto max-w-xs space-y-0.5'}>
      <Row label="Subtotal" value={inr(bill.sub)} />
      {Number(bill.discountAmount) > 0 && <Row label="Discount" value={`− ${inr(bill.discountAmount)}`} />}
      {bill.billType === 'GST' && (bill.interState
        ? <Row label={`IGST (${bill.gstPercent}%)`} value={inr(bill.igst)} />
        : <><Row label="CGST" value={inr(bill.cgst)} /><Row label="SGST" value={inr(bill.sgst)} /></>)}
      {Number(bill.round) !== 0 && <Row label="Round off" value={bill.round} />}
      <div className="flex justify-between border-t pt-1 font-bold"><span>Total</span><span>{inr(bill.final)}</span></div>
      <Row label="Paid" value={inr(bill.paid)} />
      <div className="flex justify-between font-medium"><span>Balance</span><span>{inr(bill.balance)}{Number(bill.balance) < 0 ? ' (adv)' : ''}</span></div>
    </div>
  )

  const words = <p className={thermal ? 'mt-1' : 'mt-2'}><span className="text-muted-foreground">In words:</span> {amountInWords(bill.final)}</p>

  if (thermal) {
    return (
      <div className="mx-auto w-[80mm] space-y-2 p-2 text-[11px] leading-tight">
        {header}
        <div className="border-y border-dashed py-1">{meta}</div>
        <table className="w-full">
          <thead><tr className="border-b border-dashed text-left"><th>Item</th><th className="text-right">Net</th><th className="text-right">Amt</th></tr></thead>
          <tbody>
            {bill.items.map((it) => (
              <tr key={it.id}><td>{it.tagNo ?? it.description}</td><td className="text-right">{it.net}</td><td className="text-right">{Number(it.total).toFixed(0)}</td></tr>
            ))}
          </tbody>
        </table>
        <div className="border-t border-dashed pt-1">{totals}</div>
        {words}
        {terms && <p className="mt-1 text-[10px] text-muted-foreground">{terms}</p>}
        <p className="text-center text-[10px]">Thank you!</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 text-sm">
      {header}
      <div className="border-y py-2">{meta}</div>
      <table className="w-full">
        <thead>
          <tr className="border-b text-left">
            <th className="py-1">Item</th><th>HSN</th><th>Karat</th><th className="text-right">Pcs</th>
            <th className="text-right">Gross</th><th className="text-right">Net</th><th className="text-right">Fine</th>
            <th className="text-right">Rate</th><th className="text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {bill.items.map((it) => (
            <tr key={it.id} className="border-b">
              <td className="py-1">{it.tagNo ? `${it.tagNo} · ` : ''}{it.description}</td>
              <td>{it.hsnCode ?? '—'}</td><td>{it.karatCode ?? '—'}</td><td className="text-right">{it.pcs}</td>
              <td className="text-right">{it.gross}</td><td className="text-right">{it.net}</td><td className="text-right">{it.fine}</td>
              <td className="text-right">{it.rate}</td><td className="text-right">{inr(it.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {totals}
      {words}
      {terms && <p className="border-t pt-2 text-xs text-muted-foreground">{terms}</p>}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between"><span className="text-muted-foreground">{label}</span><span>{value}</span></div>
}
