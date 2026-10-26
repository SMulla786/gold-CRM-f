import type { ColumnDef } from '@tanstack/react-table'
import { Download, Search } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { DataTable } from '@/components/DataTable'
import { MpinDialog } from '@/components/MpinDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useDeleteJustBill, useJustBills } from '@/lib/justbillQueries'
import { useAuth } from '@/lib/auth'
import { downloadCsv } from '@/lib/csv'
import { useT } from '@/lib/i18n'
import { fetchAllPaged } from '@/lib/queries'
import { shareOnWhatsApp } from '@/lib/share'
import type { JustBillListItemDto } from '@/shared'

const inr = (s: string) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(s))
const date = (s: string) => new Date(s).toLocaleDateString('en-IN')

export function JustBillList() {
  const t = useT()
  const { can } = useAuth()
  const canDelete = can('billing.just_bill', 'delete')
  const [q, setQ] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [status, setStatus] = useState('ACTIVE')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [exporting, setExporting] = useState(false)
  const filters = { q: q || undefined, from: from || undefined, to: to || undefined, status }
  const { data, isLoading } = useJustBills({ ...filters, page, pageSize })

  const exportCsv = async () => {
    setExporting(true)
    try {
      const all = await fetchAllPaged<JustBillListItemDto>('/app/just-bills', filters)
      const header = ['Bill', 'Date', 'Customer', 'Mobile', 'Items', 'Weight', 'Sub total', 'Discount', 'GST', 'Final', 'Paid', 'Balance', 'Status']
      const body = all.map((b) => [b.billNo, date(b.billDate), b.party?.name ?? b.customerName, b.mobile ?? '', b.itemCount, b.weight, b.sub, b.discountAmount, b.gst, b.final, b.paid, b.balance, b.status])
      downloadCsv(`just-bills-${status.toLowerCase()}.csv`, [header, ...body])
    } finally {
      setExporting(false)
    }
  }
  const del = useDeleteJustBill()
  const [deleting, setDeleting] = useState<JustBillListItemDto | null>(null)

  const columns: ColumnDef<JustBillListItemDto, unknown>[] = [
    { header: t('bill.col_bill'), cell: ({ row }) => <Link to={`/app/billing/just/view/${row.original.id}`} className="font-semibold text-brand-strong hover:underline">{row.original.billNo}</Link> },
    { header: t('udhari.date'), cell: ({ row }) => date(row.original.billDate) },
    { header: t('bill.customer'), cell: ({ row }) => row.original.party?.name ?? row.original.customerName },
    { accessorKey: 'itemCount', header: t('bill.col_items') },
    { header: t('bill.col_weight'), cell: ({ row }) => `${row.original.weight} g` },
    { header: t('bill.subtotal'), cell: ({ row }) => inr(row.original.sub) },
    { header: t('bill.discount'), cell: ({ row }) => (Number(row.original.discountAmount) ? inr(row.original.discountAmount) : '—') },
    { header: 'GST', cell: ({ row }) => (Number(row.original.gst) ? inr(row.original.gst) : '—') },
    { header: t('bill.final'), cell: ({ row }) => inr(row.original.final) },
    { header: t('bill.balance'), cell: ({ row }) => inr(row.original.balance) },
    {
      id: 'actions', header: '',
      cell: ({ row }) =>
        row.original.status === 'ACTIVE' ? (
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => shareOnWhatsApp(row.original.mobile ?? '', `Bill ${row.original.billNo} · Total ${inr(row.original.final)} · Balance ${inr(row.original.balance)}`)}>{t('bill.share')}</Button>
            {canDelete && <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeleting(row.original)}>{t('common.delete')}</Button>}
          </div>
        ) : <Badge variant="secondary">{t('bill.deleted')}</Badge>,
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{t('jbill.list_subtitle')}</p>
        <Button variant="outline" disabled={exporting} onClick={exportCsv}><Download aria-hidden />{exporting ? t('bill.exporting') : t('common.export_csv')}</Button>
      </div>
      <Card className="flex flex-wrap items-end gap-4 p-4">
        <div className="relative w-full sm:max-w-sm sm:flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input className="pl-9" placeholder={t('jbill.search_ph')} value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} />
        </div>
        <div className="space-y-1.5"><Label htmlFor="jbl-from">{t('common.from')}</Label><Input id="jbl-from" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1) }} /></div>
        <div className="space-y-1.5"><Label htmlFor="jbl-to">{t('common.to')}</Label><Input id="jbl-to" type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1) }} /></div>
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1) }}>
          <SelectTrigger className="w-full sm:w-32" aria-label="Status"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="ACTIVE">{t('bill.status_active')}</SelectItem><SelectItem value="DELETED">{t('bill.deleted')}</SelectItem></SelectContent>
        </Select>
      </Card>

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        isLoading={isLoading}
        emptyText={t('bill.no_bills')}
        pagination={data ? { page: data.page, pageSize: data.pageSize, total: data.total, onPage: setPage, onPageSize: setPageSize } : undefined}
      />

      <MpinDialog open={!!deleting} title={t('jbill.delete_title', { no: deleting?.billNo ?? '' })} onConfirm={(mpin) => del.mutateAsync({ id: deleting!.id, mpin })} onClose={() => setDeleting(null)} />
    </div>
  )
}
