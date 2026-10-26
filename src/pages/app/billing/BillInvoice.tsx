import { AuthedImage } from '@/components/AuthedImage'
import { amountInWords } from '@/lib/amountInWords'
import { INVOICE_PRINT_COLUMNS, type BillDto, type BillLineDto, type BusinessProfileDto } from '@/shared'

const inr = (s: string) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(s))
const date = (s: string) => new Date(s).toLocaleDateString('en-IN')

// TASK-84: each pickable print column → header label + value. Order follows INVOICE_PRINT_COLUMNS.
const COLSPEC: Record<(typeof INVOICE_PRINT_COLUMNS)[number], { label: string; get: (it: BillLineDto) => string | number }> = {
  hsn: { label: 'HSN', get: (it) => it.hsnCode ?? '—' }, karat: { label: 'Karat', get: (it) => it.karatCode ?? '—' },
  pcs: { label: 'Pcs', get: (it) => it.pcs }, gross: { label: 'Gross', get: (it) => it.gross }, less: { label: 'Less', get: (it) => it.less },
  net: { label: 'Net', get: (it) => it.net }, tunch: { label: 'Tunch', get: (it) => it.tunch }, wastage: { label: 'Wst%', get: (it) => it.wastage },
  fine: { label: 'Fine', get: (it) => it.fine }, stone: { label: 'Stone', get: (it) => it.stoneCharge }, rate: { label: 'Rate', get: (it) => it.rate },
  labour: { label: 'Labour', get: (it) => it.labour }, other: { label: 'Other', get: (it) => it.other }, disc: { label: 'Disc', get: (it) => it.discount },
  total: { label: 'Total', get: (it) => inr(it.total) },
}

interface InvoiceMedia { logoUrl: string | null; signatureUrl: string | null; watermarkUrl: string | null }
interface Props {
  bill: BillDto
  shopName: string
  business?: BusinessProfileDto | null
  stateName?: string
  terms?: string
  thermal: boolean
  media?: InvoiceMedia | null
  /** picked print columns; empty = all */
  columns?: string[]
  watermarkOpacity?: number
}

/** Printable invoice — A4 (full table) or 80 mm thermal (compact). Shop header + party + items + GST + amount in words + terms. */
export function BillInvoice({ bill, shopName, business, stateName, terms, thermal, media, columns = [], watermarkOpacity = 10 }: Props) {
  const cols = INVOICE_PRINT_COLUMNS.filter((c) => columns.length === 0 || columns.includes(c))
  const header = (
    <header className="text-center">
      {media?.logoUrl && <AuthedImage path="/app/files/invoice/logo" alt="logo" className="mx-auto mb-1 max-h-16 object-contain" />}
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
    <div className={thermal ? 'space-y-0.5 tabular-nums' : 'ml-auto max-w-xs space-y-0.5 tabular-nums'}>
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
              <tr key={it.id}><td className="break-words">{it.tagNo ?? it.description}</td><td className="text-right">{it.net}</td><td className="text-right">{Number(it.total).toFixed(0)}</td></tr>
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
    <div className="relative space-y-4 text-sm">
      {media?.watermarkUrl && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center" style={{ opacity: watermarkOpacity / 100 }}>
          <AuthedImage path="/app/files/invoice/watermark" alt="" className="max-h-[60%] max-w-[60%] object-contain" />
        </div>
      )}
      {header}
      <div className="border-y py-2">{meta}</div>
      <table className="w-full">
        <thead>
          <tr className="border-b text-left">
            <th className="py-1">Item</th>
            {cols.map((c) => <th key={c} className="text-right">{COLSPEC[c].label}</th>)}
          </tr>
        </thead>
        <tbody>
          {bill.items.map((it) => (
            <tr key={it.id} className="border-b">
              <td className="py-1 break-words">{it.tagNo ? `${it.tagNo} · ` : ''}{it.description}</td>
              {cols.map((c) => <td key={c} className="text-right">{COLSPEC[c].get(it)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      {totals}
      {words}
      {media?.signatureUrl && (
        <div className="mt-6 text-right">
          <AuthedImage path="/app/files/invoice/signature" alt="signature" className="ml-auto h-12 object-contain" />
          <div className="text-xs text-muted-foreground">Authorised signatory</div>
        </div>
      )}
      {terms && <p className="border-t pt-2 text-xs text-muted-foreground">{terms}</p>}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between"><span className="text-muted-foreground">{label}</span><span>{value}</span></div>
}
