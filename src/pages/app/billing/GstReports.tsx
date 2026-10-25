import type { ColumnDef } from '@tanstack/react-table'
import { useState } from 'react'

import { DataTable } from '@/components/DataTable'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useGstHsn, useGstRegister, useGstSummary } from '@/lib/reportsQueries'
import { downloadCsv } from '@/lib/csv'
import { fetchAllPaged } from '@/lib/queries'
import type { GstRegisterRowDto } from '@/shared'

const inr = (s: string) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(s))
const date = (s: string) => new Date(s).toLocaleDateString('en-IN')
const skeletonRows = (cols: number, rows = 5) =>
  Array.from({ length: rows }).map((_, r) => (
    <TableRow key={`sk-${r}`}>{Array.from({ length: cols }).map((_c, c) => <TableCell key={c}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
  ))

export function GstReports() {
  const [mode, setMode] = useState('register')
  const [kind, setKind] = useState('SELL')
  const [groupBy, setGroupBy] = useState('MONTH')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  const [exporting, setExporting] = useState(false)
  const r = { from: from || undefined, to: to || undefined }

  const exportRegister = async () => {
    setExporting(true)
    try {
      const all = await fetchAllPaged<GstRegisterRowDto>('/app/gst/register', { ...r, kind })
      const header = ['Bill', 'Date', 'Party', 'GSTIN', 'HSN', 'Taxable', 'CGST', 'SGST', 'IGST', 'Total']
      const body = all.map((x) => [x.billNo, date(x.billDate), x.party.name, x.party.gstin ?? '', x.hsnCodes.join(' '), x.taxable, x.cgst, x.sgst, x.igst, x.total])
      downloadCsv(`gst-register-${kind.toLowerCase()}.csv`, [header, ...body])
    } finally {
      setExporting(false)
    }
  }

  const register = useGstRegister({ ...r, kind, page })
  const hsn = useGstHsn(r)
  const summary = useGstSummary({ ...r, groupBy })

  const regCols: ColumnDef<GstRegisterRowDto, unknown>[] = [
    { header: 'Bill', cell: ({ row }) => row.original.billNo },
    { header: 'Date', cell: ({ row }) => date(row.original.billDate) },
    { header: 'Party', cell: ({ row }) => <span>{row.original.party.name}{row.original.party.gstin ? <span className="block text-xs text-muted-foreground">{row.original.party.gstin}</span> : null}</span> },
    { header: 'HSN', cell: ({ row }) => row.original.hsnCodes.join(', ') || '—' },
    { header: 'Taxable', cell: ({ row }) => inr(row.original.taxable) },
    { header: 'CGST', cell: ({ row }) => inr(row.original.cgst) },
    { header: 'SGST', cell: ({ row }) => inr(row.original.sgst) },
    { header: 'IGST', cell: ({ row }) => inr(row.original.igst) },
    { header: 'Total', cell: ({ row }) => inr(row.original.total) },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label>Report</Label>
          <Select value={mode} onValueChange={(v) => { setMode(v); setPage(1) }}>
            <SelectTrigger className="w-44" aria-label="Report"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="register">Register</SelectItem>
              <SelectItem value="hsn">HSN summary</SelectItem>
              <SelectItem value="summary">Period summary</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {mode === 'register' && (
          <div className="space-y-1.5">
            <Label>Kind</Label>
            <Select value={kind} onValueChange={(v) => { setKind(v); setPage(1) }}>
              <SelectTrigger className="w-36" aria-label="Kind"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="SELL">Sales</SelectItem><SelectItem value="PURCHASE">Purchase</SelectItem></SelectContent>
            </Select>
          </div>
        )}
        {mode === 'summary' && (
          <div className="space-y-1.5">
            <Label>Group by</Label>
            <Select value={groupBy} onValueChange={setGroupBy}>
              <SelectTrigger className="w-32" aria-label="Group by"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="MONTH">Month</SelectItem><SelectItem value="QUARTER">Quarter</SelectItem><SelectItem value="YEAR">Year</SelectItem></SelectContent>
            </Select>
          </div>
        )}
        <div className="space-y-1.5"><Label htmlFor="g-from">From</Label><Input id="g-from" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1) }} /></div>
        <div className="space-y-1.5"><Label htmlFor="g-to">To</Label><Input id="g-to" type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1) }} /></div>
        {mode === 'register' && <Button className="ml-auto" variant="outline" disabled={exporting} onClick={exportRegister}>{exporting ? 'Exporting…' : 'Export CSV'}</Button>}
      </div>

      {mode === 'register' && (
        <DataTable
          columns={regCols}
          data={register.data?.items ?? []}
          isLoading={register.isLoading}
          emptyText="No GST bills"
          pagination={register.data ? { page: register.data.page, pageSize: register.data.pageSize, total: register.data.total, onPage: setPage } : undefined}
        />
      )}

      {mode === 'hsn' && (
        <div className="rounded-md border">
          <Table>
            <TableHeader><TableRow><TableHead>HSN</TableHead><TableHead>Class</TableHead><TableHead>Weight</TableHead><TableHead>Taxable</TableHead><TableHead>CGST</TableHead><TableHead>SGST</TableHead><TableHead>IGST</TableHead><TableHead>Total</TableHead></TableRow></TableHeader>
            <TableBody>
              {hsn.isLoading ? skeletonRows(8) : hsn.data?.length ? hsn.data.map((h, i) => (
                <TableRow key={i}>
                  <TableCell>{h.hsnCode}</TableCell><TableCell>{h.stockClass}</TableCell><TableCell>{h.weight}</TableCell>
                  <TableCell>{inr(h.taxable)}</TableCell><TableCell>{inr(h.cgst)}</TableCell><TableCell>{inr(h.sgst)}</TableCell><TableCell>{inr(h.igst)}</TableCell><TableCell>{inr(h.total)}</TableCell>
                </TableRow>
              )) : <TableRow><TableCell colSpan={8} className="h-16 text-center text-muted-foreground">No data for this range</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      )}

      {mode === 'summary' && (
        <div className="rounded-md border">
          <Table>
            <TableHeader><TableRow><TableHead>Period</TableHead><TableHead>Sales taxable</TableHead><TableHead>Purchase taxable</TableHead><TableHead>Output GST</TableHead><TableHead>Input GST</TableHead><TableHead>Net payable</TableHead></TableRow></TableHeader>
            <TableBody>
              {summary.isLoading ? skeletonRows(6) : summary.data?.length ? summary.data.map((s, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{s.period}</TableCell>
                  <TableCell>{inr(s.salesTaxable)}</TableCell><TableCell>{inr(s.purchaseTaxable)}</TableCell>
                  <TableCell>{inr(s.outputGst)}</TableCell><TableCell>{inr(s.inputGst)}</TableCell>
                  <TableCell className="font-medium">{inr(s.netPayable)}</TableCell>
                </TableRow>
              )) : <TableRow><TableCell colSpan={6} className="h-16 text-center text-muted-foreground">No data for this range</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
