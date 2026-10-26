import type { ColumnDef } from '@tanstack/react-table'
import { BadgeCheck, Layers, Users, type LucideIcon } from 'lucide-react'
import { useState } from 'react'

import { DataTable } from '@/components/DataTable'
import { SelectBranchForTxn } from '@/components/SelectBranchForTxn'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAuth } from '@/lib/auth'
import { useCreateScheme, usePatchScheme, useSchemes } from '@/lib/schemesQueries'
import { businessDayISO, SCHEME_BONUS_TYPES, SCHEME_KINDS, SCHEME_TYPES, type SchemeDto } from '@/shared'

type SchemeKind = (typeof SCHEME_KINDS)[number]

const inr = (s: string) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(s))
const today = businessDayISO
const n = (s: string) => Number(s) || 0
const BONUS_LABEL: Record<string, string> = { NONE: 'No bonus', ONE_EMI: 'One free EMI', PERCENT: '% of paid', FIXED: 'Fixed amount' }

function NewSchemeDialog({ kind }: { kind: SchemeKind }) {
  const { activeBranch } = useAuth()
  const branchReady = activeBranch !== '' && activeBranch !== 'all'
  const create = useCreateScheme()
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ type: 'CASH', name: '', description: '', emiAmount: '', tenureMonths: '12', bonusType: 'NONE', bonusValue: '0', startDate: today(), validityDate: '' })
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }))
  const needsBonusValue = f.bonusType === 'PERCENT' || f.bonusType === 'FIXED'

  const valid = branchReady && f.name.trim().length >= 2 && n(f.tenureMonths) >= 1
    && (f.bonusType !== 'ONE_EMI' || n(f.emiAmount) > 0) && (!needsBonusValue || n(f.bonusValue) > 0)
  const submit = async () => {
    await create.mutateAsync({
      kind, type: f.type, name: f.name.trim(), description: f.description.trim() || undefined,
      emiAmount: n(f.emiAmount), tenureMonths: n(f.tenureMonths), bonusType: f.bonusType, bonusValue: n(f.bonusValue),
      startDate: f.startDate, validityDate: f.validityDate || undefined,
    })
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button>New {kind === 'ANJUMAN' ? 'anjuman' : 'scheme'}</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New {kind === 'ANJUMAN' ? 'anjuman' : 'scheme'}</DialogTitle></DialogHeader>
        {!branchReady && <SelectBranchForTxn note="A scheme belongs to one branch. Select a branch." />}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="sc-name">Name</Label><Input id="sc-name" value={f.name} onChange={(e) => set('name', e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Type</Label>
            <Select value={f.type} onValueChange={(v) => set('type', v)}><SelectTrigger aria-label="Scheme type"><SelectValue /></SelectTrigger>
              <SelectContent>{SCHEME_TYPES.map((t) => <SelectItem key={t} value={t}>{t === 'GOLD' ? 'Gold (grams)' : 'Cash (₹)'}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="space-y-1.5"><Label htmlFor="sc-emi">EMI ₹</Label><Input id="sc-emi" type="number" value={f.emiAmount} onChange={(e) => set('emiAmount', e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="sc-tenure">Tenure (months)</Label><Input id="sc-tenure" type="number" value={f.tenureMonths} onChange={(e) => set('tenureMonths', e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Bonus</Label>
            <Select value={f.bonusType} onValueChange={(v) => set('bonusType', v)}><SelectTrigger aria-label="Bonus type"><SelectValue /></SelectTrigger>
              <SelectContent>{SCHEME_BONUS_TYPES.map((b) => <SelectItem key={b} value={b}>{BONUS_LABEL[b]}</SelectItem>)}</SelectContent></Select>
          </div>
          {needsBonusValue && <div className="space-y-1.5"><Label htmlFor="sc-bv">Bonus {f.bonusType === 'PERCENT' ? '%' : f.type === 'GOLD' ? 'grams' : '₹'}</Label><Input id="sc-bv" type="number" value={f.bonusValue} onChange={(e) => set('bonusValue', e.target.value)} /></div>}
          <div className="space-y-1.5"><Label htmlFor="sc-start">Start date</Label><Input id="sc-start" type="date" value={f.startDate} onChange={(e) => set('startDate', e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="sc-valid">Validity (optional)</Label><Input id="sc-valid" type="date" value={f.validityDate} onChange={(e) => set('validityDate', e.target.value)} /></div>
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="sc-desc">Description</Label><Input id="sc-desc" value={f.description} onChange={(e) => set('description', e.target.value)} /></div>
        </div>
        <DialogFooter><Button disabled={!valid || create.isPending} onClick={() => void submit().catch(() => {})}>{create.isPending ? 'Saving…' : 'Create'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function SchemeList({ kind = 'SAVING' }: { kind?: SchemeKind }) {
  const { can } = useAuth()
  const permKey = kind === 'ANJUMAN' ? 'schemes.anjuman' : 'schemes.all'
  const canEdit = can(permKey, 'edit')
  const [type, setType] = useState('')
  const [active, setActive] = useState('')
  const [page, setPage] = useState(1)
  const { data, isLoading } = useSchemes({ kind, type: type || undefined, active: active || undefined, page })
  const patch = usePatchScheme()

  const columns: ColumnDef<SchemeDto, unknown>[] = [
    { header: 'Name', cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
    { header: 'Type', cell: ({ row }) => row.original.type },
    { header: 'EMI', cell: ({ row }) => inr(row.original.emiAmount) },
    { header: 'Tenure', cell: ({ row }) => `${row.original.tenureMonths} mo` },
    { header: 'Bonus', cell: ({ row }) => (row.original.bonusType === 'NONE' ? '—' : `${BONUS_LABEL[row.original.bonusType]}${row.original.bonusType === 'PERCENT' ? ` ${row.original.bonusValue}%` : ''}`) },
    { header: 'Members', cell: ({ row }) => row.original.memberCount },
    { header: 'Active', cell: ({ row }) => (canEdit
      ? <Button variant="ghost" size="sm" aria-label="Toggle active" onClick={() => patch.mutate({ id: row.original.id, body: { isActive: !row.original.isActive } })}><Badge variant={row.original.isActive ? 'default' : 'outline'}>{row.original.isActive ? 'Active' : 'Off'}</Badge></Button>
      : <Badge variant={row.original.isActive ? 'default' : 'outline'}>{row.original.isActive ? 'Active' : 'Off'}</Badge>) },
  ]

  const items = data?.items ?? []
  const anjuman = kind === 'ANJUMAN'
  const tile = (label: string, value: string, sub?: string, Icon: LucideIcon = Layers) => (
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl">{anjuman ? 'Anjuman catalogue' : 'Scheme catalogue'}</h2>
          <p className="text-sm text-muted-foreground">{anjuman ? 'Anjuman savings plans offered at this branch.' : 'EMI savings plans, their tenure and bonus rules.'}</p>
        </div>
        {canEdit && <NewSchemeDialog kind={kind} />}
      </div>

      <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tile('Total schemes', data ? String(data.total) : '—', 'Matching current filters', Layers)}
        {tile('Active on page', data ? String(items.filter((s) => s.isActive).length) : '—', `of ${items.length} shown`, BadgeCheck)}
        {tile('Enrolled members', data ? String(items.reduce((sum, s) => sum + s.memberCount, 0)) : '—', 'Across schemes shown', Users)}
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 pt-6">
        <Select value={type || 'all'} onValueChange={(v) => { setType(v === 'all' ? '' : v); setPage(1) }}>
          <SelectTrigger className="w-36" aria-label="Type"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All types</SelectItem>{SCHEME_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={active || 'all'} onValueChange={(v) => { setActive(v === 'all' ? '' : v); setPage(1) }}>
          <SelectTrigger className="w-36" aria-label="Status"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="true">Active</SelectItem><SelectItem value="false">Inactive</SelectItem></SelectContent>
        </Select>
        </CardContent>
      </Card>

      <Card className="p-4">
        <DataTable columns={columns} data={data?.items ?? []} isLoading={isLoading} emptyText={`No ${kind === 'ANJUMAN' ? 'anjuman schemes' : 'schemes'} yet`} pagination={data ? { page: data.page, pageSize: data.pageSize, total: data.total, onPage: setPage } : undefined} />
      </Card>
    </div>
  )
}
