import type { ColumnDef } from '@tanstack/react-table'
import { Printer, Search } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { DataTable } from '@/components/DataTable'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useGstHsn, useGstRegister, useGstSummary } from '@/lib/reportsQueries'
import { downloadCsv } from '@/lib/csv'
import { useT } from '@/lib/i18n'
import { fetchAllPaged } from '@/lib/queries'
import { businessDayISO, type GstRegisterRowDto, type GstSummaryRowDto, type HsnSummaryRowDto } from '@/shared'

import { GstDashboard } from './gst/GstDashboard'
import { ItcSummary } from './gst/ItcSummary'
import { Reconcile2b } from './gst/Reconcile2b'
import { Gstr1Report } from './Gstr1Report'
import { Gstr3bReport } from './Gstr3bReport'

const inr = (s: string) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(s))
const date = (s: string) => new Date(s).toLocaleDateString('en-IN')

// TASK-97: report / kind / group live in the URL (?report=hsn, ?report=register&kind=PURCHASE, ?report=summary&group=QUARTER) so each report is linkable.
const MODES = ['dashboard', 'register', 'hsn', 'summary', 'gstr1', 'gstr3b', 'itc', 'reconcile'] as const
type Mode = (typeof MODES)[number]
const pick = <T extends string>(v: string | null, all: readonly T[], dflt: T): T => (all as readonly string[]).includes(v ?? '') ? (v as T) : dflt

export function GstReports() {
  const t = useT()
  const [sp, setSp] = useSearchParams()
  const mode = pick<Mode>(sp.get('report'), MODES, 'dashboard')
  const kind = pick(sp.get('kind'), ['SELL', 'PURCHASE'] as const, 'SELL')
  const groupBy = pick(sp.get('group'), ['MONTH', 'QUARTER', 'YEAR'] as const, 'MONTH')
  // default period = current month (returns are filed monthly); clear the dates for all time
  const [from, setFrom] = useState(() => `${businessDayISO().slice(0, 7)}-01`)
  const [to, setTo] = useState(businessDayISO)
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [exporting, setExporting] = useState(false)
  const r = { from: from || undefined, to: to || undefined }
  const setParam = (k: string, v: string) => { setSp((p) => { p.set(k, v); return p }); setPage(1) }

  const REPORT_LABEL: Record<Mode, string> = {
    dashboard: 'GST dashboard', register: t('gst.register'), hsn: t('gst.hsn_summary'), summary: t('gst.period_summary'),
    gstr1: t('gst.gstr1'), gstr3b: t('gst.gstr3b'), itc: 'ITC summary', reconcile: 'GSTR-2B reconciliation',
  }

  const exportRegister = async () => {
    setExporting(true)
    try {
      const all = await fetchAllPaged<GstRegisterRowDto>('/app/gst/register', { ...r, kind, q: q || undefined })
      const header = ['Bill', 'Date', 'Party', 'GSTIN', 'HSN', 'GST %', 'Taxable', 'CGST', 'SGST', 'IGST', 'Total']
      const body = all.map((x) => [x.billNo, date(x.billDate), x.party.name, x.party.gstin ?? '', x.hsnCodes.join(' '), x.gstPercent ?? '', x.taxable, x.cgst, x.sgst, x.igst, x.total])
      downloadCsv(`gst-register-${kind.toLowerCase()}.csv`, [header, ...body])
    } finally {
      setExporting(false)
    }
  }

  const register = useGstRegister({ ...r, kind, q: q || undefined, page, pageSize })
  const hsn = useGstHsn(r)
  const summary = useGstSummary({ ...r, groupBy })
  const period = `${from || '…'}_${to || '…'}`

  const exportHsn = () => downloadCsv(`gst-hsn-${period}.csv`, [
    ['HSN', 'Class', 'Weight', 'Taxable', 'CGST', 'SGST', 'IGST', 'Total'],
    ...(hsn.data ?? []).map((h) => [h.hsnCode, t(`class.${h.stockClass}`), h.weight, h.taxable, h.cgst, h.sgst, h.igst, h.total]),
  ])
  const exportSummary = () => downloadCsv(`gst-summary-${groupBy.toLowerCase()}-${period}.csv`, [
    ['Period', 'Sales taxable', 'Purchase taxable', 'Output GST', 'Input GST', 'Net payable'],
    ...(summary.data ?? []).map((s) => [s.period, s.salesTaxable, s.purchaseTaxable, s.outputGst, s.inputGst, s.netPayable]),
  ])
  const csv = mode === 'register' ? exportRegister : mode === 'hsn' ? exportHsn : mode === 'summary' ? exportSummary : null

  const regCols: ColumnDef<GstRegisterRowDto, unknown>[] = [
    { id: 'sn', header: '#', cell: ({ row }) => <span className="text-muted-foreground tabular-nums">{(page - 1) * pageSize + row.index + 1}</span> },
    { header: t('bill.col_bill'), cell: ({ row }) => <Link to={`/app/billing/view/${row.original.billId}`} className="font-semibold text-brand-strong hover:underline">{row.original.billNo}</Link> },
    { header: t('udhari.date'), cell: ({ row }) => date(row.original.billDate) },
    { header: t('udhari.party'), cell: ({ row }) => row.original.party.name },
    { header: 'GSTIN', cell: ({ row }) => <span className="font-mono text-xs">{row.original.party.gstin ?? '—'}</span> },
    { header: 'HSN', cell: ({ row }) => row.original.hsnCodes.join(', ') || '—' },
    { header: 'GST %', cell: ({ row }) => (row.original.gstPercent != null ? `${row.original.gstPercent}%` : '—') },
    { header: t('gst.taxable'), cell: ({ row }) => inr(row.original.taxable) },
    { header: 'CGST', cell: ({ row }) => inr(row.original.cgst) },
    { header: 'SGST', cell: ({ row }) => inr(row.original.sgst) },
    { header: 'IGST', cell: ({ row }) => inr(row.original.igst) },
    { header: t('bill.col_total'), cell: ({ row }) => inr(row.original.total) },
  ]
  const hsnCols: ColumnDef<HsnSummaryRowDto, unknown>[] = [
    { header: 'HSN', accessorKey: 'hsnCode' },
    { header: t('gst.col_class'), cell: ({ row }) => t(`class.${row.original.stockClass}`) },
    { header: t('bill.col_weight'), accessorKey: 'weight' },
    { header: t('gst.taxable'), cell: ({ row }) => inr(row.original.taxable) },
    { header: 'CGST', cell: ({ row }) => inr(row.original.cgst) },
    { header: 'SGST', cell: ({ row }) => inr(row.original.sgst) },
    { header: 'IGST', cell: ({ row }) => inr(row.original.igst) },
    { header: t('bill.col_total'), cell: ({ row }) => inr(row.original.total) },
  ]
  const sumCols: ColumnDef<GstSummaryRowDto, unknown>[] = [
    { header: t('gst.col_period'), cell: ({ row }) => <span className="font-medium">{row.original.period}</span> },
    { header: t('gst.col_sales_taxable'), cell: ({ row }) => inr(row.original.salesTaxable) },
    { header: t('gst.col_purchase_taxable'), cell: ({ row }) => inr(row.original.purchaseTaxable) },
    { header: t('gst.col_output_gst'), cell: ({ row }) => inr(row.original.outputGst) },
    { header: t('gst.col_input_gst'), cell: ({ row }) => inr(row.original.inputGst) },
    { header: t('gst.col_net_payable'), cell: ({ row }) => <span className="font-bold">{inr(row.original.netPayable)}</span> },
  ]
  // HSN + period summary come back whole; page them client-side.
  const clientPaged = <T,>(rows: T[] | undefined) => ({
    data: (rows ?? []).slice((page - 1) * pageSize, page * pageSize),
    pagination: rows ? { page, pageSize, total: rows.length, onPage: setPage, onPageSize: setPageSize } : undefined,
  })

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground print:hidden">{t('gst.subtitle')}</p>
      <Card className="flex flex-wrap items-end gap-4 p-4 print:hidden">
        <div className="space-y-1.5">
          <Label>{t('gst.report')}</Label>
          <Select value={mode} onValueChange={(v) => setParam('report', v)}>
            <SelectTrigger className="w-44" aria-label={t('gst.report')}><SelectValue /></SelectTrigger>
            <SelectContent>
              {MODES.map((m) => <SelectItem key={m} value={m}>{REPORT_LABEL[m]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {mode === 'register' && (
          <div className="relative w-full sm:max-w-xs sm:flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input className="pl-9" placeholder={t('gst.search')} value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} />
          </div>
        )}
        {mode === 'register' && (
          <div className="space-y-1.5">
            <Label>{t('gst.kind')}</Label>
            <Select value={kind} onValueChange={(v) => setParam('kind', v)}>
              <SelectTrigger className="w-36" aria-label="Kind"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="SELL">{t('gst.sales')}</SelectItem><SelectItem value="PURCHASE">{t('bill.kind_purchase')}</SelectItem></SelectContent>
            </Select>
          </div>
        )}
        {mode === 'summary' && (
          <div className="space-y-1.5">
            <Label>{t('gst.group_by')}</Label>
            <Select value={groupBy} onValueChange={(v) => setParam('group', v)}>
              <SelectTrigger className="w-32" aria-label="Group by"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="MONTH">{t('gst.month')}</SelectItem><SelectItem value="QUARTER">{t('gst.quarter')}</SelectItem><SelectItem value="YEAR">{t('gst.year')}</SelectItem></SelectContent>
            </Select>
          </div>
        )}
        {mode !== 'gstr1' && mode !== 'gstr3b' && (
          <>
            <div className="space-y-1.5"><Label htmlFor="g-from">{t('common.from')}</Label><Input id="g-from" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1) }} /></div>
            <div className="space-y-1.5"><Label htmlFor="g-to">{t('common.to')}</Label><Input id="g-to" type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1) }} /></div>
          </>
        )}
        <div className="ml-auto flex flex-wrap gap-2">
          {csv && <Button variant="outline" disabled={exporting} onClick={() => void csv()}>{exporting ? t('bill.exporting') : t('common.export_csv')}</Button>}
          {/* "PDF" = the browser's print dialog (Save as PDF) on the .print-area below */}
          <Button variant="outline" onClick={() => window.print()}><Printer aria-hidden />Print / PDF</Button>
        </div>
      </Card>

      <div className="print-area space-y-6">
        <div className="hidden print:block">
          <h2 className="text-lg font-bold">{REPORT_LABEL[mode]}{mode === 'register' ? ` · ${kind === 'SELL' ? t('gst.sales') : t('bill.kind_purchase')}` : ''}</h2>
          {mode !== 'gstr1' && mode !== 'gstr3b' && <p className="text-sm">{from ? date(from) : '…'} – {to ? date(to) : '…'}</p>}
        </div>

        {mode === 'dashboard' && <GstDashboard from={from} to={to} />}

        {mode === 'register' && (
          <DataTable
            columns={regCols}
            data={register.data?.items ?? []}
            isLoading={register.isLoading}
            emptyText={t('gst.no_bills')}
            pagination={register.data ? { page: register.data.page, pageSize: register.data.pageSize, total: register.data.total, onPage: setPage, onPageSize: setPageSize } : undefined}
          />
        )}

        {mode === 'hsn' && <DataTable columns={hsnCols} isLoading={hsn.isLoading} emptyText={t('common.no_data')} {...clientPaged(hsn.data)} />}
        {mode === 'summary' && <DataTable columns={sumCols} isLoading={summary.isLoading} emptyText={t('common.no_data')} {...clientPaged(summary.data)} />}

        {mode === 'gstr1' && <Gstr1Report />}
        {mode === 'gstr3b' && <Gstr3bReport />}
        {mode === 'itc' && <ItcSummary from={from} to={to} />}
        {mode === 'reconcile' && <Reconcile2b from={from} to={to} />}
      </div>
    </div>
  )
}
