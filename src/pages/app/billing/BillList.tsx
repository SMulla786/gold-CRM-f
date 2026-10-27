import type { ColumnDef } from '@tanstack/react-table'
import { Download, Search } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { DataTable } from '@/components/DataTable'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AddPaymentDialog } from '@/pages/app/billing/AddPaymentDialog'
import { useBills, useDeleteBill } from '@/lib/billingQueries'
import { useAuth } from '@/lib/auth'
import { useT } from '@/lib/i18n'
import { downloadCsv } from '@/lib/csv'
import { fetchAllPaged } from '@/lib/queries'
import { shareOnWhatsApp } from '@/lib/share'
import { businessDayISO, BILL_KINDS, BILL_TYPES, PARTY_TYPES, type BillKind, type BillListItemDto } from '@/shared'

const todayISO = businessDayISO

const inr = (s: string) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(s))
const date = (s: string) => new Date(s).toLocaleDateString('en-IN')

function DeleteBillDialog({ bill, onClose }: { bill: BillListItemDto; onClose: () => void }) {
  const t = useT()
  const del = useDeleteBill()
  const [returnStock, setReturnStock] = useState('true')
  const [mpin, setMpin] = useState('')
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{t('bill.delete_q', { no: bill.billNo })}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>{t('bill.stock_handling')}</Label>
            <Select value={returnStock} onValueChange={setReturnStock}>
              <SelectTrigger aria-label="Stock handling"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="true">{t('bill.item_return')}</SelectItem>
                <SelectItem value="false">{t('bill.delete_only')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="del-mpin">{t('mpin.label')}</Label>
            <Input id="del-mpin" inputMode="numeric" maxLength={4} value={mpin} onChange={(e) => setMpin(e.target.value.replace(/\D/g, ''))} />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="destructive"
            disabled={mpin.length !== 4 || del.isPending}
            onClick={async () => { await del.mutateAsync({ id: bill.id, returnStock: returnStock === 'true', mpin }); onClose() }}
          >
            {t('bill.delete_bill')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function BillList() {
  const t = useT()
  const { can } = useAuth()
  const navigate = useNavigate()
  // ?kind=PURCHASE opens the purchase list (links / bookmarks)
  const [params, setParams] = useSearchParams()
  // kind follows ?kind= whenever it changes (the "Bills" / "Purchase bills" tabs, the kind Select), not only on mount
  const kind: BillKind = params.get('kind') === 'PURCHASE' ? 'PURCHASE' : 'SELL'
  const [partyType, setPartyType] = useState('')
  const [status, setStatus] = useState('ACTIVE')
  const [billType, setBillType] = useState('')
  const [q, setQ] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [minTotal, setMinTotal] = useState('')
  const [maxTotal, setMaxTotal] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [exporting, setExporting] = useState(false)
  const [pageKind, setPageKind] = useState(kind)
  if (pageKind !== kind) { setPageKind(kind); setPage(1) } // new kind → back to page 1 (adjust-state-during-render)
  const permKey = kind === 'SELL' ? 'billing.sell_bill' : 'billing.purchase_bill'
  const canEdit = can(permKey, 'edit')
  const canDelete = can(permKey, 'delete')
  const filters = {
    kind, status, q: q || undefined, billType: billType || undefined, partyType: partyType || undefined, from: from || undefined, to: to || undefined,
    minTotal: minTotal || undefined, maxTotal: maxTotal || undefined,
  }
  const { data, isLoading } = useBills({ ...filters, page, pageSize })
  const reset = (set: (v: string) => void) => (v: string) => { set(v); setPage(1) }
  const [paying, setPaying] = useState<BillListItemDto | null>(null)
  const [deleting, setDeleting] = useState<BillListItemDto | null>(null)

  const exportCsv = async () => {
    setExporting(true)
    try {
      const all = await fetchAllPaged<BillListItemDto>('/app/bills', filters)
      const header = ['Bill', 'Date', 'Party', 'Mobile', 'Type', 'Items', 'Final', 'Paid', 'Balance', 'Status']
      const body = all.map((b) => [b.billNo, date(b.billDate), b.party.name, b.party.mobile, b.billType, b.itemCount, b.final, b.paid, b.balance, b.status])
      downloadCsv(`bills-${kind.toLowerCase()}-${status.toLowerCase()}.csv`, [header, ...body])
    } finally {
      setExporting(false)
    }
  }

  const columns: ColumnDef<BillListItemDto, unknown>[] = [
    { header: t('bill.col_bill'), cell: ({ row }) => <Link to={`/app/billing/view/${row.original.id}`} className="font-semibold text-brand-strong hover:underline">{row.original.billNo}</Link> },
    { header: t('udhari.date'), cell: ({ row }) => date(row.original.billDate) },
    { header: t('udhari.party'), cell: ({ row }) => row.original.party.name },
    { accessorKey: 'itemCount', header: t('bill.col_items') },
    { header: t('bill.type'), cell: ({ row }) => <Badge variant="secondary">{row.original.billType}</Badge> },
    { header: t('bill.final'), cell: ({ row }) => inr(row.original.final) },
    { header: t('bill.paid'), cell: ({ row }) => inr(row.original.paid) },
    { header: t('bill.balance'), cell: ({ row }) => <span className={Number(row.original.balance) < 0 ? 'text-green-600 dark:text-green-500' : Number(row.original.balance) > 0 ? 'text-destructive' : ''}>{inr(row.original.balance)}</span> },
    { header: t('bill.col_created_by'), cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.createdBy ?? '—'}</span> },
    {
      id: 'actions', header: '',
      cell: ({ row }) =>
        row.original.status === 'ACTIVE' ? (
          <div className="flex flex-wrap gap-2">
            {canEdit && row.original.billDate.slice(0, 10) === todayISO() && <Button variant="outline" size="sm" onClick={() => navigate(`/app/billing/edit/${row.original.id}`)}>{t('common.edit')}</Button>}
            {canEdit && Number(row.original.balance) !== 0 && <Button variant="outline" size="sm" onClick={() => setPaying(row.original)}>{t('bill.add_payment')}</Button>}
            <Button variant="ghost" size="sm" onClick={() => shareOnWhatsApp(row.original.party.mobile, `${row.original.kind === 'SELL' ? 'Bill' : 'Purchase'} ${row.original.billNo} · Total ${inr(row.original.final)} · Balance ${inr(row.original.balance)}`)}>{t('bill.share')}</Button>
            {canDelete && <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeleting(row.original)}>{t('common.delete')}</Button>}
          </div>
        ) : <Badge variant="secondary">{t('bill.deleted')}</Badge>,
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{t('bill.list_subtitle')}</p>
        <Button variant="outline" disabled={exporting} onClick={exportCsv}><Download aria-hidden />{exporting ? t('bill.exporting') : t('common.export_csv')}</Button>
      </div>
      <Card className="flex flex-wrap items-center gap-3 p-4">
        <Select
          value={kind}
          onValueChange={(v) => {
            setParams((sp) => { const n = new URLSearchParams(sp); if (v === 'PURCHASE') n.set('kind', v); else n.delete('kind'); return n }, { replace: true })
          }}
        >
          <SelectTrigger className="w-full sm:w-36" aria-label="Bill kind"><SelectValue /></SelectTrigger>
          <SelectContent>{BILL_KINDS.map((k) => <SelectItem key={k} value={k}>{k === 'SELL' ? t('bill.kind_sell') : t('bill.kind_purchase')}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1) }}>
          <SelectTrigger className="w-full sm:w-32" aria-label="Status"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="ACTIVE">{t('bill.status_active')}</SelectItem><SelectItem value="DELETED">{t('bill.deleted')}</SelectItem></SelectContent>
        </Select>
        <div className="relative w-full sm:max-w-sm sm:flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input className="pl-9" placeholder={t('bill.search_ph')} value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} />
        </div>
        <Select value={billType || 'all'} onValueChange={(v) => reset(setBillType)(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-full sm:w-32" aria-label="Bill type filter"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('bill.all_types')}</SelectItem>
            {BILL_TYPES.map((bt) => <SelectItem key={bt} value={bt}>{bt}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={partyType || 'all'} onValueChange={(v) => reset(setPartyType)(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-full sm:w-40" aria-label="Contact type filter"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('bill98.all_party_types')}</SelectItem>
            {PARTY_TYPES.map((pt) => <SelectItem key={pt} value={pt}>{t(`party.type.${pt}`)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input className="w-full sm:w-40" type="date" aria-label="From date" value={from} onChange={(e) => reset(setFrom)(e.target.value)} />
        <Input className="w-full sm:w-40" type="date" aria-label="To date" value={to} onChange={(e) => reset(setTo)(e.target.value)} />
        <Input className="w-full sm:w-28" type="number" min="0" placeholder={t('bill.min_total')} aria-label="Minimum total" value={minTotal} onChange={(e) => reset(setMinTotal)(e.target.value)} />
        <Input className="w-full sm:w-28" type="number" min="0" placeholder={t('bill.max_total')} aria-label="Maximum total" value={maxTotal} onChange={(e) => reset(setMaxTotal)(e.target.value)} />
      </Card>

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        isLoading={isLoading}
        emptyText={t('bill.no_bills')}
        pagination={data ? { page: data.page, pageSize: data.pageSize, total: data.total, onPage: setPage, onPageSize: setPageSize } : undefined}
      />

      {paying && <AddPaymentDialog bill={paying} onClose={() => setPaying(null)} />}
      {deleting && <DeleteBillDialog bill={deleting} onClose={() => setDeleting(null)} />}
    </div>
  )
}
