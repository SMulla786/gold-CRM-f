import { zodResolver } from '@hookform/resolvers/zod'
import type { ColumnDef } from '@tanstack/react-table'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { DataTable } from '@/components/DataTable'
import { MpinDialog } from '@/components/MpinDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useBankAccounts } from '@/lib/appQueries'
import { useCreateIncomeExpense, useDeleteIncomeExpense, useIncomeExpense, useIncomeExpenseSummary, useUpdateIncomeExpense } from '@/lib/accountsQueries'
import { useAuth } from '@/lib/auth'
import { businessDayISO, IE_SOURCE_TYPES, incomeExpenseBody, type IncomeExpenseDto } from '@/shared'

type IEIn = z.input<typeof incomeExpenseBody>
type IEOut = z.output<typeof incomeExpenseBody>
const today = businessDayISO
const isToday = (iso: string) => iso.slice(0, 10) === today()

function IEDialog({ entry, onClose }: { entry?: IncomeExpenseDto; onClose: () => void }) {
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
          <DialogTitle>{entry ? 'Edit entry' : 'New income / expense'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={watch('type')} onValueChange={(v) => setValue('type', v as IEOut['type'])}>
                <SelectTrigger aria-label="Type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="INCOME">Income</SelectItem>
                  <SelectItem value="EXPENSE">Expense</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ie-reason">Reason</Label>
              <Input id="ie-reason" {...register('reason')} />
              {errors.reason && <p className="text-xs text-destructive">{errors.reason.message}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ie-cash">Cash ₹</Label>
              <Input id="ie-cash" type="number" step="0.01" {...register('cash')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ie-online">Online ₹</Label>
              <Input id="ie-online" type="number" step="0.01" {...register('online')} />
            </div>
          </div>
          {online > 0 && (
            <div className="space-y-1.5">
              <Label>Bank account</Label>
              <Select value={watch('bankAccountId') ? String(watch('bankAccountId')) : ''} onValueChange={(v) => setValue('bankAccountId', Number(v))}>
                <SelectTrigger aria-label="Bank account">
                  <SelectValue placeholder="Select bank" />
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
              <Label htmlFor="ie-gold">Gold (g)</Label>
              <Input id="ie-gold" type="number" step="0.001" {...register('gold')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ie-silver">Silver (g)</Label>
              <Input id="ie-silver" type="number" step="0.001" {...register('silver')} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ie-remark">Remark</Label>
            <Input id="ie-remark" {...register('remark')} />
          </div>
          <p className="text-xs text-muted-foreground">Enter at least one amount or metal weight.</p>
          <DialogFooter>
            <Button type="submit" disabled={create.isPending}>
              {entry ? 'Save (MPIN)' : create.isPending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
        <MpinDialog
          open={!!pendingEdit}
          title="Authenticate edit"
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

const inr = (s: string) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(s))
const date = (s: string) => new Date(s).toLocaleDateString('en-IN')

export function IncomeExpense() {
  const { can } = useAuth()
  const canEdit = can('income_expense.entry', 'edit')
  const canList = can('income_expense.list', 'view')
  const [page, setPage] = useState(1)
  const [type, setType] = useState('')
  const [sourceType, setSourceType] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [summaryView, setSummaryView] = useState(false)
  const filters = { type: type || undefined, sourceType: sourceType || undefined, from: from || undefined, to: to || undefined }
  const { data, isLoading } = useIncomeExpense({ page, ...filters }, canList && !summaryView)
  const { data: summary, isLoading: summaryLoading } = useIncomeExpenseSummary(filters, canList && summaryView)
  const del = useDeleteIncomeExpense()
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<IncomeExpenseDto | null>(null)
  const [deleting, setDeleting] = useState<IncomeExpenseDto | null>(null)

  const columns: ColumnDef<IncomeExpenseDto, unknown>[] = [
    { accessorKey: 'txnDate', header: 'Date', cell: ({ row }) => date(row.original.txnDate) },
    { accessorKey: 'type', header: 'Type', cell: ({ row }) => <Badge variant={row.original.type === 'INCOME' ? 'default' : 'secondary'}>{row.original.type}</Badge> },
    { accessorKey: 'reason', header: 'Reason' },
    { header: 'Cash', cell: ({ row }) => (Number(row.original.cash) ? inr(row.original.cash) : '—') },
    { header: 'Online', cell: ({ row }) => (Number(row.original.online) ? inr(row.original.online) : '—') },
    { header: 'Metal', cell: ({ row }) => [Number(row.original.gold) ? `${row.original.gold}g Au` : '', Number(row.original.silver) ? `${row.original.silver}g Ag` : ''].filter(Boolean).join(' ') || '—' },
    { accessorKey: 'createdBy', header: 'By', cell: ({ row }) => row.original.createdBy ?? '—' },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) =>
        canEdit ? (
          <div className="flex gap-2">
            {isToday(row.original.txnDate) && (
              <Button variant="outline" size="sm" onClick={() => setEditing(row.original)}>
                Edit
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => setDeleting(row.original)}>
              Delete
            </Button>
          </div>
        ) : null,
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">Income / Expense</h1>
        {canList && (
          <>
            <Select value={type || 'all'} onValueChange={(v) => { setType(v === 'all' ? '' : v); setPage(1) }}>
              <SelectTrigger className="w-36" aria-label="Filter by type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="INCOME">Income</SelectItem>
                <SelectItem value="EXPENSE">Expense</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sourceType || 'all'} onValueChange={(v) => { setSourceType(v === 'all' ? '' : v); setPage(1) }}>
              <SelectTrigger className="w-40" aria-label="Filter by source">
                <SelectValue placeholder="All sources" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sources</SelectItem>
                {IE_SOURCE_TYPES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input className="w-40" type="date" aria-label="From" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1) }} />
            <Input className="w-40" type="date" aria-label="To" value={to} onChange={(e) => { setTo(e.target.value); setPage(1) }} />
            <Button variant="outline" onClick={() => setSummaryView((v) => !v)}>{summaryView ? 'Entries' : 'Daily summary'}</Button>
          </>
        )}
        {canEdit && (
          <Button className="ml-auto" onClick={() => setCreating(true)}>
            New entry
          </Button>
        )}
      </div>

      {!canList ? (
        <p className="text-sm text-muted-foreground">You can add entries; viewing the list needs the Income / Expense List permission.</p>
      ) : summaryView ? (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Cash in</TableHead>
                <TableHead className="text-right">Cash out</TableHead>
                <TableHead className="text-right">Profit</TableHead>
                <TableHead className="text-right">Gold net</TableHead>
                <TableHead className="text-right">Silver net</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summaryLoading ? <TableRow><TableCell colSpan={6} className="h-16 text-center text-muted-foreground">Loading…</TableCell></TableRow>
                : summary?.length ? summary.map((d) => (
                  <TableRow key={d.date}>
                    <TableCell className="font-medium">{date(d.date)}</TableCell>
                    <TableCell className="text-right tabular-nums">{inr(d.cashIn)}</TableCell>
                    <TableCell className="text-right tabular-nums">{inr(d.cashOut)}</TableCell>
                    <TableCell className={`text-right tabular-nums font-medium ${Number(d.profit) < 0 ? 'text-destructive' : ''}`}>{inr(d.profit)}</TableCell>
                    <TableCell className="text-right tabular-nums">{Number(d.goldNet) ? `${d.goldNet}g` : '—'}</TableCell>
                    <TableCell className="text-right tabular-nums">{Number(d.silverNet) ? `${d.silverNet}g` : '—'}</TableCell>
                  </TableRow>
                )) : <TableRow><TableCell colSpan={6} className="h-16 text-center text-muted-foreground">No activity</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={data?.items ?? []}
          isLoading={isLoading}
          emptyText="No entries yet."
          pagination={data ? { page: data.page, pageSize: data.pageSize, total: data.total, onPage: setPage } : undefined}
        />
      )}

      {creating && <IEDialog onClose={() => setCreating(false)} />}
      {editing && <IEDialog entry={editing} onClose={() => setEditing(null)} />}
      <MpinDialog
        open={!!deleting}
        title={`Delete "${deleting?.reason ?? ''}"`}
        onConfirm={(mpin) => del.mutateAsync({ id: deleting!.id, mpin })}
        onClose={() => setDeleting(null)}
      />
    </div>
  )
}
