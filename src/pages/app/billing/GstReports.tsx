import type { ColumnDef } from '@tanstack/react-table'
import { Search } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { DataTable } from '@/components/DataTable'
import { TableCard } from '@/components/SectionCard'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useGstHsn, useGstRegister, useGstSummary } from '@/lib/reportsQueries'
import { downloadCsv } from '@/lib/csv'
import { useT } from '@/lib/i18n'
import { fetchAllPaged } from '@/lib/queries'
import { businessDayISO, type GstRegisterRowDto } from '@/shared'

import { Gstr1Report } from './Gstr1Report'
import { Gstr3bReport } from './Gstr3bReport'

const inr = (s: string) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(s))
const date = (s: string) => new Date(s).toLocaleDateString('en-IN')
const skeletonRows = (cols: number, rows = 5) =>
  Array.from({ length: rows }).map((_, r) => (
    <TableRow key={`sk-${r}`}>{Array.from({ length: cols }).map((_c, c) => <TableCell key={c}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
  ))

export function GstReports() {
  const t = useT()
  const [mode, setMode] = useState('register')
  const [kind, setKind] = useState('SELL')
  const [groupBy, setGroupBy] = useState('MONTH')
  // default period = current month (returns are filed monthly); clear the dates for all time
  const [from, setFrom] = useState(() => `${businessDayISO().slice(0, 7)}-01`)
  const [to, setTo] = useState(businessDayISO)
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [exporting, setExporting] = useState(false)
  const r = { from: from || undefined, to: to || undefined }

  const exportRegister = async () => {
    setExporting(true)
    try {
      const all = await fetchAllPaged<GstRegisterRowDto>('/app/gst/register', { ...r, kind, q: q || undefined })
      const header = ['Bill', 'Date', 'Party', 'GSTIN', 'HSN', 'Taxable', 'CGST', 'SGST', 'IGST', 'Total']
      const body = all.map((x) => [x.billNo, date(x.billDate), x.party.name, x.party.gstin ?? '', x.hsnCodes.join(' '), x.taxable, x.cgst, x.sgst, x.igst, x.total])
      downloadCsv(`gst-register-${kind.toLowerCase()}.csv`, [header, ...body])
    } finally {
      setExporting(false)
    }
  }

  const register = useGstRegister({ ...r, kind, q: q || undefined, page, pageSize })
  const hsn = useGstHsn(r)
  const summary = useGstSummary({ ...r, groupBy })

  const regCols: ColumnDef<GstRegisterRowDto, unknown>[] = [
    { id: 'sn', header: '#', cell: ({ row }) => <span className="text-muted-foreground tabular-nums">{(page - 1) * pageSize + row.index + 1}</span> },
    { header: t('bill.col_bill'), cell: ({ row }) => <Link to={`/app/billing/view/${row.original.billId}`} className="font-semibold text-brand-strong hover:underline">{row.original.billNo}</Link> },
    { header: t('udhari.date'), cell: ({ row }) => date(row.original.billDate) },
    { header: t('udhari.party'), cell: ({ row }) => row.original.party.name },
    { header: 'GSTIN', cell: ({ row }) => <span className="font-mono text-xs">{row.original.party.gstin ?? '—'}</span> },
    { header: 'HSN', cell: ({ row }) => row.original.hsnCodes.join(', ') || '—' },
    { header: t('gst.taxable'), cell: ({ row }) => inr(row.original.taxable) },
    { header: 'CGST', cell: ({ row }) => inr(row.original.cgst) },
    { header: 'SGST', cell: ({ row }) => inr(row.original.sgst) },
    { header: 'IGST', cell: ({ row }) => inr(row.original.igst) },
    { header: t('bill.col_total'), cell: ({ row }) => inr(row.original.total) },
  ]

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">{t('gst.subtitle')}</p>
      <Card className="flex flex-wrap items-end gap-4 p-4">
        <div className="space-y-1.5">
          <Label>{t('gst.report')}</Label>
          <Select value={mode} onValueChange={(v) => { setMode(v); setPage(1) }}>
            <SelectTrigger className="w-44" aria-label={t('gst.report')}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="register">{t('gst.register')}</SelectItem>
              <SelectItem value="hsn">{t('gst.hsn_summary')}</SelectItem>
              <SelectItem value="summary">{t('gst.period_summary')}</SelectItem>
              <SelectItem value="gstr1">{t('gst.gstr1')}</SelectItem>
              <SelectItem value="gstr3b">{t('gst.gstr3b')}</SelectItem>
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
            <Select value={kind} onValueChange={(v) => { setKind(v); setPage(1) }}>
              <SelectTrigger className="w-36" aria-label="Kind"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="SELL">{t('gst.sales')}</SelectItem><SelectItem value="PURCHASE">{t('bill.kind_purchase')}</SelectItem></SelectContent>
            </Select>
          </div>
        )}
        {mode === 'summary' && (
          <div className="space-y-1.5">
            <Label>{t('gst.group_by')}</Label>
            <Select value={groupBy} onValueChange={setGroupBy}>
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
        {mode === 'register' && <Button className="ml-auto" variant="outline" disabled={exporting} onClick={exportRegister}>{exporting ? t('bill.exporting') : t('common.export_csv')}</Button>}
      </Card>

      {mode === 'register' && (
        <DataTable
          columns={regCols}
          data={register.data?.items ?? []}
          isLoading={register.isLoading}
          emptyText={t('gst.no_bills')}
          pagination={register.data ? { page: register.data.page, pageSize: register.data.pageSize, total: register.data.total, onPage: setPage, onPageSize: setPageSize } : undefined}
        />
      )}

      {mode === 'hsn' && (
        <TableCard>
          <Table>
            <TableHeader><TableRow><TableHead>HSN</TableHead><TableHead>{t('gst.col_class')}</TableHead><TableHead>{t('bill.col_weight')}</TableHead><TableHead>{t('gst.taxable')}</TableHead><TableHead>CGST</TableHead><TableHead>SGST</TableHead><TableHead>IGST</TableHead><TableHead>{t('bill.col_total')}</TableHead></TableRow></TableHeader>
            <TableBody>
              {hsn.isLoading ? skeletonRows(8) : hsn.data?.length ? hsn.data.map((h, i) => (
                <TableRow key={i}>
                  <TableCell>{h.hsnCode}</TableCell><TableCell>{h.stockClass}</TableCell><TableCell>{h.weight}</TableCell>
                  <TableCell>{inr(h.taxable)}</TableCell><TableCell>{inr(h.cgst)}</TableCell><TableCell>{inr(h.sgst)}</TableCell><TableCell>{inr(h.igst)}</TableCell><TableCell>{inr(h.total)}</TableCell>
                </TableRow>
              )) : <TableRow><TableCell colSpan={8} className="h-16 text-center text-muted-foreground">{t('common.no_data')}</TableCell></TableRow>}
            </TableBody>
          </Table>
        </TableCard>
      )}

      {mode === 'summary' && (
        <TableCard>
          <Table>
            <TableHeader><TableRow><TableHead>{t('gst.col_period')}</TableHead><TableHead>{t('gst.col_sales_taxable')}</TableHead><TableHead>{t('gst.col_purchase_taxable')}</TableHead><TableHead>{t('gst.col_output_gst')}</TableHead><TableHead>{t('gst.col_input_gst')}</TableHead><TableHead>{t('gst.col_net_payable')}</TableHead></TableRow></TableHeader>
            <TableBody>
              {summary.isLoading ? skeletonRows(6) : summary.data?.length ? summary.data.map((s, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{s.period}</TableCell>
                  <TableCell>{inr(s.salesTaxable)}</TableCell><TableCell>{inr(s.purchaseTaxable)}</TableCell>
                  <TableCell>{inr(s.outputGst)}</TableCell><TableCell>{inr(s.inputGst)}</TableCell>
                  <TableCell className="font-bold">{inr(s.netPayable)}</TableCell>
                </TableRow>
              )) : <TableRow><TableCell colSpan={6} className="h-16 text-center text-muted-foreground">{t('common.no_data')}</TableCell></TableRow>}
            </TableBody>
          </Table>
        </TableCard>
      )}

      {mode === 'gstr1' && <Gstr1Report />}
      {mode === 'gstr3b' && <Gstr3bReport />}
    </div>
  )
}
