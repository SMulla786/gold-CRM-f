// TASK-98: alternate bill print layouts (A4 estimate, A5, 58 mm thermal, A4 with item photos).
// A4_GST and THERMAL_80 stay on BillInvoice. Printed customer content is English by design.
import { AuthedImage } from '@/components/AuthedImage'
import { amountInWords } from '@/lib/amountInWords'
import { cn } from '@/lib/utils'
import { INVOICE_PRINT_COLUMNS, type BillDto, type BillLineDto, type BusinessProfileDto } from '@/shared'

type Col = (typeof INVOICE_PRINT_COLUMNS)[number]

const inr = (s: string) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(s))
const date = (s: string) => new Date(s).toLocaleDateString('en-IN')

const COLSPEC: Record<Col, { label: string; get: (it: BillLineDto) => string | number }> = {
  hsn: { label: 'HSN', get: (it) => it.hsnCode ?? '—' }, karat: { label: 'Karat', get: (it) => it.karatCode ?? '—' },
  pcs: { label: 'Pcs', get: (it) => it.pcs }, gross: { label: 'Gross', get: (it) => it.gross }, less: { label: 'Less', get: (it) => it.less },
  net: { label: 'Net', get: (it) => it.net }, tunch: { label: 'Tunch', get: (it) => it.tunch }, wastage: { label: 'Wst%', get: (it) => it.wastage },
  fine: { label: 'Fine', get: (it) => it.fine }, stone: { label: 'Stone', get: (it) => it.stoneCharge }, rate: { label: 'Rate', get: (it) => it.rate },
  labour: { label: 'Labour', get: (it) => it.labour }, other: { label: 'Other', get: (it) => it.other }, disc: { label: 'Disc', get: (it) => it.discount },
  total: { label: 'Total', get: (it) => inr(it.total) },
}
/** A5 is half the width of A4 — only the columns that matter most fit. */
const A5_COLS: Col[] = ['hsn', 'karat', 'net', 'fine', 'rate', 'labour', 'total']

export interface InvoiceMedia { logoUrl: string | null; signatureUrl: string | null; watermarkUrl: string | null }
export interface InvoiceLayoutProps {
  bill: BillDto
  shopName: string
  business?: BusinessProfileDto | null
  stateName?: string
  /** already blanked when the terms toggle is off */
  terms?: string
  /** signatureUrl already nulled when the signature toggle is off */
  media?: InvoiceMedia | null
  /** picked print columns; empty = all */
  columns: string[]
  watermarkOpacity?: number
  showWords: boolean
  showHsn: boolean
  due?: { label: string; value: string } | null
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return <div className={cn('flex justify-between', strong && 'border-t pt-1 font-bold')}><span className={strong ? '' : 'text-muted-foreground'}>{label}</span><span>{value}</span></div>
}

function Totals({ bill, due, combineTax, className }: { bill: BillDto; due?: InvoiceLayoutProps['due']; combineTax?: boolean; className?: string }) {
  const tax = Number(bill.cgst) + Number(bill.sgst) + Number(bill.igst)
  return (
    <div className={cn('space-y-0.5 tabular-nums', className)}>
      <Row label="Subtotal" value={inr(bill.sub)} />
      {Number(bill.discountAmount) > 0 && <Row label="Discount" value={`− ${inr(bill.discountAmount)}`} />}
      {bill.billType === 'GST' && (combineTax
        ? tax > 0 && <Row label="Tax" value={inr(String(tax))} />
        : bill.interState
          ? <Row label={`IGST (${bill.gstPercent}%)`} value={inr(bill.igst)} />
          : <><Row label="CGST" value={inr(bill.cgst)} /><Row label="SGST" value={inr(bill.sgst)} /></>)}
      {Number(bill.round) !== 0 && <Row label="Round off" value={bill.round} />}
      <Row label="Total" value={inr(bill.final)} strong />
      <Row label="Paid" value={inr(bill.paid)} />
      <div className="flex justify-between font-medium"><span>Balance</span><span>{inr(bill.balance)}{Number(bill.balance) < 0 ? ' (adv)' : ''}</span></div>
      {due && <Row label={due.label} value={due.value} />}
    </div>
  )
}

const title = (bill: BillDto, estimate: boolean) =>
  estimate ? 'ESTIMATE' : `${bill.kind === 'SELL' ? 'TAX INVOICE' : 'PURCHASE'} ${bill.billType === 'ROUGH' ? '(ROUGH)' : ''}`

/** Sheet layouts: A4 estimate (no GSTIN / HSN, tax as one line), A5 (compact columns), A4 with item photos. */
export function SheetInvoice({ variant, ...p }: InvoiceLayoutProps & { variant: 'estimate' | 'a5' | 'images' }) {
  const { bill, media } = p
  const estimate = variant === 'estimate'
  const a5 = variant === 'a5'
  const picked = INVOICE_PRINT_COLUMNS.filter((c) => p.columns.length === 0 || p.columns.includes(c))
  const cols = picked.filter((c) => (c !== 'hsn' || (p.showHsn && !estimate)) && (!a5 || A5_COLS.includes(c)))
  return (
    <div className={cn('relative space-y-3', a5 ? 'mx-auto max-w-[148mm] text-xs' : 'space-y-4 text-sm')}>
      {media?.watermarkUrl && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center" style={{ opacity: (p.watermarkOpacity ?? 10) / 100 }}>
          <AuthedImage path="/app/files/invoice/watermark" alt="" className="max-h-[60%] max-w-[60%] object-contain" />
        </div>
      )}
      <header className="text-center">
        {media?.logoUrl && <AuthedImage path="/app/files/invoice/logo" alt="logo" className={cn('mx-auto mb-1 object-contain', a5 ? 'max-h-12' : 'max-h-16')} />}
        <div className={a5 ? 'text-base font-bold' : 'text-lg font-bold'}>{p.shopName}</div>
        {p.business?.address && <div>{p.business.address}</div>}
        {p.stateName && <div>{p.stateName}</div>}
        {!estimate && p.business?.gstin && <div>GSTIN: {p.business.gstin}</div>}
        <div className="mt-1 font-medium">{title(bill, estimate)}</div>
      </header>
      <div className="flex justify-between border-y py-2">
        <div>
          <div><span className="text-muted-foreground">{estimate ? 'Estimate' : 'Bill'}:</span> {bill.billNo}</div>
          <div><span className="text-muted-foreground">Date:</span> {date(bill.billDate)}</div>
        </div>
        <div className="text-right">
          <div className="font-medium">{bill.party.name}</div>
          <div>{bill.party.mobile}</div>
        </div>
      </div>
      <table className="w-full">
        <thead>
          <tr className="border-b text-left">
            {variant === 'images' && <th className="w-20 py-1">Photo</th>}
            <th className="py-1">Item</th>
            {cols.map((c) => <th key={c} className="text-right">{COLSPEC[c].label}</th>)}
          </tr>
        </thead>
        <tbody>
          {bill.items.map((it) => (
            <tr key={it.id} className="border-b align-top">
              {variant === 'images' && (
                <td className="py-1">
                  {it.stockItemId != null
                    ? <AuthedImage path={`/app/files/stock/${it.stockItemId}/photo`} alt={it.description} className="h-16 w-16 rounded border object-cover" />
                    : <div className="h-16 w-16 rounded border border-dashed" />}
                </td>
              )}
              <td className="py-1 break-words">{it.tagNo ? `${it.tagNo} · ` : ''}{it.description}</td>
              {cols.map((c) => <td key={c} className="py-1 text-right">{COLSPEC[c].get(it)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      <Totals bill={bill} due={p.due} combineTax={estimate} className={a5 ? 'ml-auto max-w-[60%]' : 'ml-auto max-w-xs'} />
      {p.showWords && <p><span className="text-muted-foreground">In words:</span> {amountInWords(bill.final)}</p>}
      {media?.signatureUrl && (
        <div className="mt-6 text-right">
          <AuthedImage path="/app/files/invoice/signature" alt="signature" className="ml-auto h-12 object-contain" />
          <div className="text-xs text-muted-foreground">Authorised signatory</div>
        </div>
      )}
      {p.terms && <p className="border-t pt-2 text-xs whitespace-pre-line text-muted-foreground">{p.terms}</p>}
      {estimate && <p className="text-center text-xs text-muted-foreground">This is an estimate, not a tax invoice.</p>}
    </div>
  )
}

/** 58 mm thermal roll: two columns (item, amount), weights under the item name. */
export function Thermal58Invoice(p: InvoiceLayoutProps) {
  const { bill } = p
  return (
    <div className="mx-auto w-[58mm] space-y-1.5 p-1 text-[10px] leading-tight">
      <header className="text-center">
        <div className="text-xs font-bold">{p.shopName}</div>
        {p.business?.address && <div>{p.business.address}</div>}
        {p.business?.gstin && <div>GSTIN: {p.business.gstin}</div>}
        <div className="mt-0.5 font-medium">{title(bill, false)}</div>
      </header>
      <div className="space-y-0.5 border-y border-dashed py-1">
        <div>Bill: {bill.billNo} · {date(bill.billDate)}</div>
        <div className="font-medium">{bill.party.name}</div>
        {bill.party.mobile && <div>{bill.party.mobile}</div>}
      </div>
      <table className="w-full">
        <thead><tr className="border-b border-dashed text-left"><th>Item</th><th className="text-right">Amt</th></tr></thead>
        <tbody>
          {bill.items.map((it) => (
            <tr key={it.id} className="align-top">
              <td className="break-words">
                {it.tagNo ?? it.description}
                <div className="text-muted-foreground">Net {it.net}{p.showHsn && it.hsnCode ? ` · HSN ${it.hsnCode}` : ''}</div>
              </td>
              <td className="text-right">{Number(it.total).toFixed(0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <Totals bill={bill} due={p.due} className="border-t border-dashed pt-1" />
      {p.showWords && <p>In words: {amountInWords(bill.final)}</p>}
      {p.terms && <p className="text-[9px] whitespace-pre-line text-muted-foreground">{p.terms}</p>}
      <p className="text-center">Thank you!</p>
    </div>
  )
}
