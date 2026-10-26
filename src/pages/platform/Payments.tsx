import type { ColumnDef } from '@tanstack/react-table'
import { Ban, BadgeCheck, Clock, Receipt, type LucideIcon } from 'lucide-react'
import { useState } from 'react'

import { AuthedImage } from '@/components/AuthedImage'
import { DataTable } from '@/components/DataTable'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useT } from '@/lib/i18n'
import { usePayments, useReviewPayment } from '@/lib/queries'
import type { PaymentDto } from '@/shared'

const inr = (s: string) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(s))
const date = (s: string | null) => (s ? new Date(s).toLocaleDateString('en-IN') : '—')
const statusVariant = (s: PaymentDto['status']) => (s === 'CONFIRMED' ? 'default' : s === 'PENDING' ? 'secondary' : 'destructive')

export function Payments() {
  const t = useT()
  const [page, setPage] = useState(1)
  const { data, isLoading } = usePayments(page)
  const review = useReviewPayment()
  const [proof, setProof] = useState<number | null>(null)

  const columns: ColumnDef<PaymentDto, unknown>[] = [
    { accessorKey: 'businessName', header: t('payments.col_business') },
    { accessorKey: 'amount', header: t('subscription.col_amount'), cell: ({ row }) => inr(row.original.amount) },
    { accessorKey: 'method', header: t('subscription.col_method') },
    { accessorKey: 'utr', header: t('payments.col_utr'), cell: ({ row }) => row.original.utr ?? '—' },
    { accessorKey: 'status', header: t('stock.col_status'), cell: ({ row }) => <Badge variant={statusVariant(row.original.status)}>{row.original.status}</Badge> },
    { accessorKey: 'paidAt', header: t('bill.paid'), cell: ({ row }) => date(row.original.paidAt) },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const p = row.original
        return (
          <div className="flex justify-end gap-2">
            {p.hasProof && <Button variant="ghost" size="sm" onClick={() => setProof(proof === p.id ? null : p.id)}>{proof === p.id ? t('payments.hide_proof') : t('subscription.col_proof')}</Button>}
            {p.status === 'PENDING' && (
              <>
                <Button size="sm" disabled={review.isPending} onClick={() => review.mutate({ id: p.id, status: 'CONFIRMED' })}>{t('common.confirm')}</Button>
                <Button size="sm" variant="outline" disabled={review.isPending} onClick={() => { if (window.confirm(t('payments.reject_confirm', { amount: inr(p.amount), business: p.businessName }))) review.mutate({ id: p.id, status: 'REJECTED' }) }}>{t('payments.reject')}</Button>
              </>
            )}
          </div>
        )
      },
    },
  ]

  // Summary numbers derived from the page already fetched (no extra requests).
  const items = data?.items ?? []
  const confirmedRows = items.filter((p) => p.status === 'CONFIRMED')
  const confirmedSum = confirmedRows.reduce((sum, p) => sum + Number(p.amount), 0)
  const pendingRows = items.filter((p) => p.status === 'PENDING')
  const pendingSum = pendingRows.reduce((sum, p) => sum + Number(p.amount), 0)
  const rejectedRows = items.filter((p) => p.status === 'REJECTED').length

  const tile = (label: string, value: string, sub: string | undefined, Icon: LucideIcon) => (
    <Card className="gap-2 hover:-translate-y-1">
      <CardHeader className="flex flex-row items-center justify-between pb-1">
        <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</CardTitle>
        <span className="icon-chip"><Icon className="size-5" aria-hidden /></span>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-extrabold tracking-tight tabular-nums">{value}</div>
        {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1>{t('bill.payments')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('payments.subtitle')}</p>
        </div>
      </header>

      <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tile(t('payments.total'), data ? String(data.total) : '—', t('payments.all_time'), Receipt)}
        {tile(t('payments.confirmed'), data ? inr(String(confirmedSum)) : '—', data ? t('payments.confirmed_sub', { n: confirmedRows.length, total: items.length }) : undefined, BadgeCheck)}
        {tile(t('payments.pending'), data ? String(pendingRows.length) : '—', data ? t('payments.pending_sub', { amount: inr(String(pendingSum)) }) : undefined, Clock)}
        {tile(t('payments.rejected'), data ? String(rejectedRows) : '—', data ? t('payments.rejected_sub', { total: items.length }) : undefined, Ban)}
      </div>

      <Card className="p-4">
        <DataTable
          columns={columns}
          data={data?.items ?? []}
          isLoading={isLoading}
          pagination={data ? { page: data.page, pageSize: data.pageSize, total: data.total, onPage: setPage } : undefined}
        />
        {proof != null && <AuthedImage path={`/platform/payments/${proof}/proof`} alt="Payment screenshot" className="mt-4 max-h-[28rem] rounded-xl border" />}
      </Card>
    </div>
  )
}
