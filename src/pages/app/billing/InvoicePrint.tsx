// TASK-98: the printable bill — owns the .print-area and switches layout by billing.invoice.format.
// A4_GST / THERMAL_80 render the existing BillInvoice; with default toggles the output is unchanged.
import { INVOICE_PRINT_COLUMNS, type BillDto, type BusinessProfileDto, type InvoiceFormat, type SettingsDto } from '@/shared'

import { usePartyBalance } from '@/lib/billingQueries'
import { cn } from '@/lib/utils'
import { BillInvoice } from '@/pages/app/billing/BillInvoice'
import { SheetInvoice, Thermal58Invoice, type InvoiceLayoutProps } from '@/pages/app/billing/invoice/layouts'

const inr = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n)

/** Per-format print CSS (only non-default formats — A4_GST adds nothing). */
const PRINT_CSS: Partial<Record<InvoiceFormat, string>> = {
  A5: '@media print { @page { size: A5; } }',
  THERMAL_58: '@media print { .print-area.print-thermal { width: 58mm; } }',
}

interface Props {
  bill: BillDto
  format: InvoiceFormat
  settings?: SettingsDto
  shopName: string
  business?: BusinessProfileDto | null
  stateName?: string
  /** TASK-98: on-screen preview only (Settings › Invoice "Full view") — no .print-area wrapper and no print CSS, so it can live in a dialog */
  bare?: boolean
}

export function InvoicePrint({ bill, format, settings, shopName, business, stateName, bare }: Props) {
  const opt = settings?.['billing.invoice']
  const showDue = opt?.showDueBalance ?? false
  // Party's current udhar balance (+ = party owes the shop); falls back to this bill's balance if unavailable.
  const { data: partyBal, isError } = usePartyBalance(showDue ? bill.party.id : undefined)
  const thermal = format === 'THERMAL_80' || format === 'THERMAL_58'

  const content = settings?.['invoice.content']
  const showHsn = opt?.showHsn ?? true
  const columns = content?.columns ?? []
  const media = settings?.['invoice.media']
  const p: InvoiceLayoutProps = {
    bill, shopName, business, stateName,
    terms: (opt?.showTerms ?? true) ? content?.terms : undefined,
    media: (opt?.showSignature ?? true) || !media ? media : { ...media, signatureUrl: null },
    columns,
    watermarkOpacity: content?.watermarkOpacity,
    showWords: opt?.showAmountInWords ?? true,
    showHsn,
    due: showDue ? dueRow(bill, partyBal, isError) : null,
  }
  // BillInvoice treats an empty list as "all", so drop HSN explicitly (keep Total if nothing else is left).
  const billCols = showHsn ? columns : withoutHsn(columns)

  let body
  switch (format) {
    case 'A4_ESTIMATE': body = <SheetInvoice variant="estimate" {...p} />; break
    case 'A5': body = <SheetInvoice variant="a5" {...p} />; break
    case 'A4_IMAGES': body = <SheetInvoice variant="images" {...p} />; break
    case 'THERMAL_58': body = <Thermal58Invoice {...p} />; break
    default:
      body = <BillInvoice bill={bill} shopName={shopName} business={business} stateName={stateName} terms={p.terms} thermal={format === 'THERMAL_80'} media={p.media} columns={billCols} watermarkOpacity={p.watermarkOpacity} showWords={p.showWords} due={p.due} />
  }

  if (bare) return <div className="overflow-x-auto rounded-xl border bg-card p-4">{body}</div>

  const css = PRINT_CSS[format]
  return (
    <div className={cn('print-area rounded-3xl border border-white/80 bg-card p-6 shadow-sm sm:p-10 dark:border-border print:rounded-none print:border-0 print:bg-transparent print:shadow-none', thermal && 'print-thermal')}>
      {css && <style>{css}</style>}
      <div className="overflow-x-auto print:overflow-visible">{body}</div>
    </div>
  )
}

function withoutHsn(columns: string[]): string[] {
  const rest = (columns.length ? columns : [...INVOICE_PRINT_COLUMNS]).filter((c) => c !== 'hsn')
  return rest.length ? rest : ['total']
}

function dueRow(bill: BillDto, bal: { amount: string; gold: string; silver: string } | undefined, failed: boolean): InvoiceLayoutProps['due'] {
  if (!bal) return failed ? { label: 'Bill due', value: inr(Math.max(0, Number(bill.balance))) } : null
  const amt = Number(bal.amount)
  const metal = [Number(bal.gold) ? `Au ${bal.gold} g` : '', Number(bal.silver) ? `Ag ${bal.silver} g` : ''].filter(Boolean).join(' · ')
  const value = `${inr(Math.abs(amt))}${amt < 0 ? ' Cr' : amt > 0 ? ' Dr' : ''}${metal ? ` · ${metal}` : ''}`
  return { label: 'Total due (party)', value }
}
