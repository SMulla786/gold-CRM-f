import { zodResolver } from '@hookform/resolvers/zod'
import type { ColumnDef } from '@tanstack/react-table'
import { ArrowDownLeft, ArrowUpRight, Plus, Search, TrendingUp } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { z } from 'zod'

import { CsvExportButton } from '@/components/CsvExportButton'
import { DataTable } from '@/components/DataTable'
import { KpiTile } from '@/components/KpiTile'
import { MpinDialog } from '@/components/MpinDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useBankAccounts } from '@/lib/appQueries'
import { useCreateIncomeExpense, useDeleteIncomeExpense, useIncomeExpense, useIncomeExpenseSummary, useUpdateIncomeExpense } from '@/lib/accountsQueries'
import { useAuth } from '@/lib/auth'
import { useT } from '@/lib/i18n'
import { fetchAllPaged } from '@/lib/queries'
import { sourceHref } from '@/lib/sourceLinks'
import { businessDayISO, IE_SOURCE_TYPES, incomeExpenseBody, type IncomeExpenseDto } from '@/shared'

type IEIn = z.input<typeof incomeExpenseBody>
type IEOut = z.output<typeof incomeExpenseBody>
const today = businessDayISO
const isToday = (iso: string) => iso.slice(0, 10) === today()

function IEDialog({ entry, onClose }: { entry?: IncomeExpenseDto; onClose: () => void }) {
  const t = useT()
  const { data: banks } = useBankAccounts()
  const create = useCreateIncomeExpense()
  const update = useUpdateIncomeExpense()
  const [pendingEdit, setPendingEdit] = useState<Record<string, unknown> | null>(null) // holds validated body awaiting MPIN

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<IEIn, unknown, IEOut>({
    resolver: zodResolver(incomeExpenseBody),
    defaultValues: entry
      ? { type: entry.type, reason: entry.reason, cash: Number(entry.cash), online: Number(entry.online), bankAccountId: entry.bankAccount?.id, gold: Number(entry.gold), silver: Number(entry.silver), remark: entry.remark ?? undefined }
      : { type: 'EXPENSE', cash: 0, online: 0, gold: 0, silver: 0 },
  })
  const online = Number(watch('online')) || 0

  const onSubmit = handleSubmit(async (v) => {
    if (entry) setPendingEdit(v as Record<string, unknown>) // edit needs MPIN
    else {
      await create.mutateAsync(v as Record<string, unknown>)
      onClose()
    }
  })

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{entry ? t('ie.edit_entry') : t('ie.new_title')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t('bill.type')}</Label>
              <Select value={watch('type')} onValueChange={(v) => setValue('type', v as IEOut['type'])}>
                <SelectTrigger aria-label="Type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="INCOME">{t('ie.income')}</SelectItem>
                  <SelectItem value="EXPENSE">{t('ie.expense')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ie-reason">{t('ie.reason')}</Label>
              <Input id="ie-reason" {...register('reason')} />
              {errors.reason && <p className="text-xs text-destructive">{errors.reason.message}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ie-cash">{t('udhari.cash')}</Label>
              <Input id="ie-cash" type="number" step="0.01" {...register('cash')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ie-online">{t('udhari.online')}</Label>
              <Input id="ie-online" type="number" step="0.01" {...register('online')} />
            </div>
          </div>
          {online > 0 && (
            <div className="space-y-1.5">
              <Label>{t('ie.bank_account')}</Label>
              <Select value={watch('bankAccountId') ? String(watch('bankAccountId')) : ''} onValueChange={(v) => setValue('bankAccountId', Number(v))}>
                <SelectTrigger aria-label="Bank account">
                  <SelectValue placeholder={t('ie.select_bank')} />
                </SelectTrigger>
                <SelectContent>
                  {banks?.map((b) => (
                    <SelectItem key={b.id} value={String(b.id)}>
                      {b.bankName} · {b.accountNo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.bankAccountId && <p className="text-xs text-destructive">{errors.bankAccountId.message}</p>}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ie-gold">{t('udhari.gold_g')}</Label>
              <Input id="ie-gold" type="number" step="0.001" {...register('gold')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ie-silver">{t('udhari.silver_g')}</Label>
              <Input id="ie-silver" type="number" step="0.001" {...register('silver')} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ie-remark">{t('udhari.remark')}</Label>
            <Input id="ie-remark" {...register('remark')} />
          </div>
          <p className="text-xs text-muted-foreground">{t('ie.hint')}</p>
          <DialogFooter>
            <Button type="submit" disabled={create.isPending}>
              {entry ? t('ie.save_mpin') : create.isPending ? t('bill.saving') : t('common.save')}
            </Button>
          </DialogFooter>
        </form>
        <MpinDialog
          open={!!pendingEdit}
          title={t('ie.auth_edit')}
          onConfirm={async (mpin) => {
            await update.mutateAsync({ id: entry!.id, body: pendingEdit!, mpin })
            onClose()
          }}
          onClose={() => setPendingEdit(null)}
        />
      </DialogContent>
    </Dialog>
  )
}

const inr = (s: string | number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(s))
const date = (s: string) => new Date(s).toLocaleDateString('en-IN')

export function IncomeExpense() {
  const t = useT()
  const { can } = useAuth()
  const canEdit = can('income_expense.entry', 'edit')
  const canList = can('income_expense.list', 'view')
  const [page, setPage] = useState(1)
  const [type, setType] = useState('')
  const [sourceType, setSourceType] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [summaryView, setSummaryView] = useState(false)
  const [q, setQ] = useState('')
  const [pageSize, setPageSize] = useState(20)
  const filters = { type: type || undefined, sourceType: sourceType || undefined, from: from || undefined, to: to || undefined }
  const { data, isLoading } = useIncomeExpense({ page, pageSize, q: q || undefined, ...filters }, canList && !summaryView)
  const { data: summary, isLoading: summaryLoading } = useIncomeExpenseSummary(filters, canList && summaryView)
  const del = useDeleteIncomeExpense()
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<IncomeExpenseDto | null>(null)
  const [deleting, setDeleting] = useState<IncomeExpenseDto | null>(null)

  const sum = (k: 'cashIn' | 'cashOut' | 'profit') => (summary ?? []).reduce((acc, d) => acc + Number(d[k]), 0)

  const columns: ColumnDef<IncomeExpenseDto, unknown>[] = [
    { accessorKey: 'txnDate', header: t('udhari.date'), cell: ({ row }) => date(row.original.txnDate) },
    { accessorKey: 'type', header: t('bill.type'), cell: ({ row }) => <Badge variant={row.original.type === 'INCOME' ? 'default' : 'secondary'}>{row.original.type}</Badge> },
    {
      accessorKey: 'reason', header: t('ie.reason'),
      // auto rows (sale/purchase/udhar…) link to their source document
      cell: ({ row }) => {
        const r = row.original
        const href = r.sourceType && r.sourceType !== 'DIRECT' ? sourceHref(r.sourceType, String(r.id)) : null
        return href ? <Link to={href} className="font-medium text-brand-strong hover:underline">{r.reason}</Link> : r.reason
      },
    },
    { header: t('ie.col_cash'), cell: ({ row }) => (Number(row.original.cash) ? inr(row.original.cash) : '—') },
    { header: t('ie.col_online'), cell: ({ row }) => (Number(row.original.online) ? inr(row.original.online) : '—') },
    { header: t('udhari.metal'), cell: ({ row }) => [Number(row.original.gold) ? `${row.original.gold}g Au` : '', Number(row.original.silver) ? `${row.original.silver}g Ag` : ''].filter(Boolean).join(' ') || '—' },
    { accessorKey: 'createdBy', header: t('dash.col_by'), cell: ({ row }) => row.original.createdBy ?? '—' },
    {
      id: 'actions',
      header: '',
      // only manual entries are editable here; auto rows belong to their module (their id is the source doc's, not an entry's)
      cell: ({ row }) =>
        canEdit && (row.original.sourceType ?? 'DIRECT') === 'DIRECT' ? (
          <div className="flex gap-2">
            {isToday(row.original.txnDate) && (
              <Button variant="outline" size="sm" onClick={() => setEditing(row.original)}>
                {t('common.edit')}
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => setDeleting(row.original)}>
              {t('common.delete')}
            </Button>
          </div>
        ) : null,
    },
  ]

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1>{t('ie.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('ie.subtitle')}</p>
        </div>
        {canEdit && (
          <Button onClick={() => setCreating(true)}>
            <Plus aria-hidden />{t('ie.new_entry')}
          </Button>
        )}
      </header>

      {canList && (
        <Card className="flex flex-wrap items-center gap-3 p-4">
          {!summaryView && (
            <div className="relative w-full sm:max-w-xs sm:flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input className="pl-9" placeholder={t('ie.search')} value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} />
            </div>
          )}
          <Select value={type || 'all'} onValueChange={(v) => { setType(v === 'all' ? '' : v); setPage(1) }}>
            <SelectTrigger className="w-36" aria-label="Filter by type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('daybook.all')}</SelectItem>
              <SelectItem value="INCOME">{t('ie.income')}</SelectItem>
              <SelectItem value="EXPENSE">{t('ie.expense')}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sourceType || 'all'} onValueChange={(v) => { setSourceType(v === 'all' ? '' : v); setPage(1) }}>
            <SelectTrigger className="w-40" aria-label="Filter by source">
              <SelectValue placeholder={t('daybook.all_sources')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('daybook.all_sources')}</SelectItem>
              {IE_SOURCE_TYPES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input className="w-40" type="date" aria-label="From" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1) }} />
          <Input className="w-40" type="date" aria-label="To" value={to} onChange={(e) => { setTo(e.target.value); setPage(1) }} />
          <Button variant="outline" className="ml-auto" onClick={() => setSummaryView((v) => !v)}>{summaryView ? t('ie.entries') : t('ie.daily_summary')}</Button>
          {!summaryView && (
            <CsvExportButton
              filename="income-expense.csv"
              rows={async () => {
                const all = await fetchAllPaged<IncomeExpenseDto>('/app/income-expense', { ...filters, q: q || undefined })
                return [
                  ['Date', 'Type', 'Source', 'Reason', 'Cash', 'Online', 'Bank', 'Gold', 'Silver', 'Remark', 'By'],
                  ...all.map((r) => [r.txnDate, r.type, r.sourceType ?? 'DIRECT', r.reason, r.cash, r.online, r.bankAccount?.name, r.gold, r.silver, r.remark, r.createdBy]),
                ]
              }}
            />
          )}
        </Card>
      )}

      {!canList ? (
        <Card className="p-6 text-sm text-muted-foreground">{t('ie.no_list_perm')}</Card>
      ) : summaryView ? (
        <>
          {!!summary?.length && (
            <div className="stagger grid gap-4 sm:grid-cols-3">
              <KpiTile icon={ArrowDownLeft} label={t('ie.cash_in')} value={inr(sum('cashIn'))} />
              <KpiTile icon={ArrowUpRight} tone="slate" label={t('ie.cash_out')} value={inr(sum('cashOut'))} />
              <KpiTile icon={TrendingUp} label={t('ie.profit')} value={inr(sum('profit'))} valueClassName={sum('profit') < 0 ? 'text-destructive' : undefined} />
            </div>
          )}
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">{t('udhari.date')}</TableHead>
                  <TableHead className="text-right">{t('ie.cash_in')}</TableHead>
                  <TableHead className="text-right">{t('ie.cash_out')}</TableHead>
                  <TableHead className="text-right">{t('ie.profit')}</TableHead>
                  <TableHead className="text-right">{t('oldmetal.gold_net')}</TableHead>
                  <TableHead className="pr-6 text-right">{t('oldmetal.silver_net')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summaryLoading ? <TableRow><TableCell colSpan={6} className="h-16 text-center text-muted-foreground">{t('common.loading')}</TableCell></TableRow>
                  : summary?.length ? summary.map((d) => (
                    <TableRow key={d.date}>
                      <TableCell className="pl-6 font-medium">
                        {/* open that day's entries */}
                        <button type="button" className="font-semibold text-brand-strong hover:underline" onClick={() => { const day = d.date.slice(0, 10); setFrom(day); setTo(day); setPage(1); setSummaryView(false) }}>{date(d.date)}</button>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{inr(d.cashIn)}</TableCell>
                      <TableCell className="text-right tabular-nums">{inr(d.cashOut)}</TableCell>
                      <TableCell className={`text-right tabular-nums font-medium ${Number(d.profit) < 0 ? 'text-destructive' : ''}`}>{inr(d.profit)}</TableCell>
                      <TableCell className="text-right tabular-nums">{Number(d.goldNet) ? `${d.goldNet}g` : '—'}</TableCell>
                      <TableCell className="pr-6 text-right tabular-nums">{Number(d.silverNet) ? `${d.silverNet}g` : '—'}</TableCell>
                    </TableRow>
                  )) : <TableRow><TableCell colSpan={6} className="h-16 text-center text-muted-foreground">{t('dash.no_activity')}</TableCell></TableRow>}
              </TableBody>
            </Table>
          </Card>
        </>
      ) : (
        <DataTable
          columns={columns}
          data={data?.items ?? []}
          isLoading={isLoading}
          emptyText={t('ie.empty')}
          pagination={data ? { page: data.page, pageSize: data.pageSize, total: data.total, onPage: setPage, onPageSize: setPageSize } : undefined}
        />
      )}

      {creating && <IEDialog onClose={() => setCreating(false)} />}
      {editing && <IEDialog entry={editing} onClose={() => setEditing(null)} />}
      <MpinDialog
        open={!!deleting}
        title={t('ie.delete_title', { reason: deleting?.reason ?? '' })}
        onConfirm={(mpin) => del.mutateAsync({ id: deleting!.id, mpin })}
        onClose={() => setDeleting(null)}
      />
    </div>
  )
}
