import type { ColumnDef } from '@tanstack/react-table'
import { Search } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { DataTable } from '@/components/DataTable'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AddPaymentDialog } from '@/pages/app/billing/AddPaymentDialog'
import { DateRangeFilter } from '@/pages/app/trade/TradeExtras'
import { usePendingBills } from '@/lib/udhariQueries'
import { useAuth } from '@/lib/auth'
import { useT } from '@/lib/i18n'
import { PARTY_TYPES, type BillListItemDto } from '@/shared'

const inr = (s: string) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(s))

export function PendingBills() {
  const t = useT()
  const { can } = useAuth()
  const canPayKind = (kind: string) => can(kind === 'PURCHASE' ? 'billing.purchase_bill' : 'billing.sell_bill', 'edit')
  const [type, setType] = useState('')
  const [kind, setKind] = useState('') // UDH-07 tabs: '' = all, SELL = Sale only, PURCHASE = Purchase only
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const { data, isLoading } = usePendingBills({ type: type || undefined, kind: kind || undefined, from: from || undefined, to: to || undefined, q: q || undefined, page, pageSize })
  const sum = data?.summary
  const [paying, setPaying] = useState<BillListItemDto | null>(null)

  const columns: ColumnDef<BillListItemDto, unknown>[] = [
    { id: 'sn', header: '#', cell: ({ row }) => <span className="text-muted-foreground tabular-nums">{(page - 1) * pageSize + row.index + 1}</span> },
    { header: t('udhari.col_bill'), cell: ({ row }) => <Link to={`/app/billing/view/${row.original.id}`} className="font-semibold text-brand-strong hover:underline">{row.original.billNo}</Link> },
    { header: t('udhari.col_bill_date'), cell: ({ row }) => new Date(row.original.billDate).toLocaleDateString('en-IN') },
    { header: t('udhari.col_kind'), cell: ({ row }) => <Badge variant="secondary">{row.original.kind}</Badge> },
    {
      header: t('udhari.col_party'),
      cell: ({ row }) => <div><div className="font-medium">{row.original.party.name}</div><div className="text-xs text-muted-foreground">{[row.original.party.shopName, row.original.party.mobile, row.original.party.type].filter(Boolean).join(' · ')}</div></div>,
    },
    { header: t('udhari.col_items'), cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.itemsSummary ?? '—'}</span> },
    { header: t('bill.final'), cell: ({ row }) => inr(row.original.final) },
    { header: t('udhari.col_paid'), cell: ({ row }) => inr(row.original.paid) },
    { header: t('bill.balance'), cell: ({ row }) => <span className={Number(row.original.balance) < 0 ? 'text-green-600 dark:text-green-500' : 'text-destructive'}>{inr(row.original.balance)}</span> },
    {
      id: 'actions', header: '',
      cell: ({ row }) => (canPayKind(row.original.kind) && Number(row.original.balance) > 0 ? <Button variant="outline" size="sm" onClick={() => setPaying(row.original)}>{t('udhari.add_payment')}</Button> : null),
    },
  ]

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">{t('udhari.pending_intro')}</p>
      <Tabs value={kind || 'all'} onValueChange={(v) => { setKind(v === 'all' ? '' : v); setPage(1) }}>
        <TabsList>
          <TabsTrigger value="all">{t('udhari.tab_all_bills')}</TabsTrigger>
          <TabsTrigger value="SELL">{t('udhari.tab_sale_only')}</TabsTrigger>
          <TabsTrigger value="PURCHASE">{t('udhari.tab_purchase_only')}</TabsTrigger>
        </TabsList>
      </Tabs>
      {/* summary over every bill matching the filters (server-side), not just this page; rupees only (BILL-15 R4); no netted total (owner rule) */}
      <div className="grid gap-4 sm:grid-cols-3">
        {([
          [t('udhari.tab_pending'), sum ? String(sum.count) : '—'],
          [t('udhari.card_sale_due'), sum ? inr(sum.saleDue) : '—'],
          [t('udhari.card_purchase_due'), sum ? inr(sum.purchaseDue) : '—'],
        ] as const).map(([label, value]) => (
          <Card key={label} className="gap-1 p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
            <div className="text-2xl font-bold tabular-nums">{value}</div>
          </Card>
        ))}
      </div>
      <Card className="flex flex-wrap items-center gap-3 p-4">
        <div className="relative w-full sm:max-w-xs sm:flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input className="pl-9" placeholder={t('udhari.search_bills')} value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} />
        </div>
        <Select value={type || 'all'} onValueChange={(v) => { setType(v === 'all' ? '' : v); setPage(1) }}>
          <SelectTrigger className="w-40" aria-label="Party type"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('udhari.all_types')}</SelectItem>
            {PARTY_TYPES.map((pt) => <SelectItem key={pt} value={pt}>{pt}</SelectItem>)}
          </SelectContent>
        </Select>
        <DateRangeFilter from={from} to={to} onChange={(a, b) => { setFrom(a); setTo(b); setPage(1) }} />
      </Card>

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        isLoading={isLoading}
        emptyText={t('udhari.no_pending')}
        pagination={data ? { page: data.page, pageSize: data.pageSize, total: data.total, onPage: setPage, onPageSize: setPageSize } : undefined}
      />

      {paying && <AddPaymentDialog bill={paying} onClose={() => setPaying(null)} />}
    </div>
  )
}
