import { zodResolver } from '@hookform/resolvers/zod'
import type { ColumnDef } from '@tanstack/react-table'
import { BadgeCheck, Layers, Users, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { z } from 'zod'

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
import { businessDayISO, SCHEME_BONUS_TYPES, SCHEME_KINDS, SCHEME_TYPES, schemePatchBody, type SchemeDto } from '@/shared'

type SchemeKind = (typeof SCHEME_KINDS)[number]

const inr = (s: string) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(s))
const date = (s: string) => new Date(s).toLocaleDateString('en-IN')
const today = businessDayISO
const n = (s: string) => Number(s) || 0
const BONUS_LABEL: Record<string, string> = { NONE: 'No bonus', ONE_EMI: 'One free EMI', PERCENT: '% of paid', FIXED: 'Fixed amount' }
/** Anjuman tab shortcuts: the shared Members / Dues / Transactions screens pre-filtered to kind=ANJUMAN. */
const ANJUMAN_VIEWS = [
  { to: '/app/schemes/members', label: 'Anjuman members', key: 'schemes.all' },
  { to: '/app/schemes/dues', label: 'Anjuman dues', key: 'schemes.due_list', alt: 'schemes.due_amount' },
  { to: '/app/schemes/transactions', label: 'Anjuman transactions', key: 'schemes.transactions' },
]

function NewSchemeDialog({ kind }: { kind: SchemeKind }) {
  const { activeBranch } = useAuth()
  const branchReady = activeBranch !== '' && activeBranch !== 'all'
  const create = useCreateScheme()
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ type: 'CASH', name: '', title: '', description: '', emiAmount: '', tenureMonths: '12', bonusType: 'NONE', bonusValue: '0', startDate: today(), validityDate: '' })
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }))
  const needsBonusValue = f.bonusType === 'PERCENT' || f.bonusType === 'FIXED'
  // Anjuman may run without a fixed EMI: no EMI / tenure, deposits are ad-hoc (contract allows tenure 0 for ANJUMAN)
  const [hasEmi, setHasEmi] = useState(true)
  const emiOn = kind !== 'ANJUMAN' || hasEmi

  const valid = branchReady && f.name.trim().length >= 2 && (!emiOn || n(f.tenureMonths) >= 1)
    && (f.bonusType !== 'ONE_EMI' || (emiOn && n(f.emiAmount) > 0)) && (!needsBonusValue || n(f.bonusValue) > 0)
  const submit = async () => {
    await create.mutateAsync({
      kind, type: f.type, name: f.name.trim(), title: f.title.trim() || undefined, description: f.description.trim() || undefined,
      emiAmount: emiOn ? n(f.emiAmount) : 0, tenureMonths: emiOn ? n(f.tenureMonths) : 0, bonusType: f.bonusType, bonusValue: n(f.bonusValue),
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
          {kind === 'ANJUMAN' && <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="sc-title">Title (optional)</Label><Input id="sc-title" maxLength={80} value={f.title} onChange={(e) => set('title', e.target.value)} /></div>}
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="sc-name">{kind === 'ANJUMAN' ? 'Scheme name' : 'Name'}</Label><Input id="sc-name" value={f.name} onChange={(e) => set('name', e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Type</Label>
            <Select value={f.type} onValueChange={(v) => set('type', v)}><SelectTrigger aria-label="Scheme type"><SelectValue /></SelectTrigger>
              <SelectContent>{SCHEME_TYPES.map((t) => <SelectItem key={t} value={t}>{t === 'GOLD' ? 'Gold (grams)' : 'Cash (₹)'}</SelectItem>)}</SelectContent></Select>
          </div>
          {kind === 'ANJUMAN' && (
            <div className="space-y-1.5"><Label>EMI</Label>
              <Select value={hasEmi ? 'YES' : 'NO'} onValueChange={(v) => { setHasEmi(v === 'YES'); if (v === 'NO' && f.bonusType === 'ONE_EMI') set('bonusType', 'NONE') }}><SelectTrigger aria-label="Has EMI"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="YES">Yes, fixed monthly EMI</SelectItem><SelectItem value="NO">No, ad-hoc deposits</SelectItem></SelectContent></Select>
            </div>
          )}
          {emiOn && <div className="space-y-1.5"><Label htmlFor="sc-emi">EMI ₹</Label><Input id="sc-emi" type="number" value={f.emiAmount} onChange={(e) => set('emiAmount', e.target.value)} /></div>}
          {emiOn && <div className="space-y-1.5"><Label htmlFor="sc-tenure">Tenure (months)</Label><Input id="sc-tenure" type="number" value={f.tenureMonths} onChange={(e) => set('tenureMonths', e.target.value)} /></div>}
          <div className="space-y-1.5"><Label>Bonus</Label>
            <Select value={f.bonusType} onValueChange={(v) => set('bonusType', v)}><SelectTrigger aria-label="Bonus type"><SelectValue /></SelectTrigger>
              <SelectContent>{SCHEME_BONUS_TYPES.filter((b) => emiOn || b !== 'ONE_EMI').map((b) => <SelectItem key={b} value={b}>{BONUS_LABEL[b]}</SelectItem>)}</SelectContent></Select>
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

/** Edit form: the PATCH contract's name/description, with validity kept as the date input's string (sent as YYYY-MM-DD or null). */
const editSchemeForm = schemePatchBody.pick({ name: true, description: true }).extend({ validityDate: z.string().optional(), title: z.string().trim().max(80).optional() })
type EditSchemeIn = z.input<typeof editSchemeForm>
type EditSchemeOut = z.output<typeof editSchemeForm>

function EditSchemeDialog({ scheme, onClose }: { scheme: SchemeDto; onClose: () => void }) {
  const patch = usePatchScheme()
  const { register, handleSubmit, formState: { errors } } = useForm<EditSchemeIn, unknown, EditSchemeOut>({
    resolver: zodResolver(editSchemeForm),
    defaultValues: { name: scheme.name, title: scheme.title ?? '', description: scheme.description ?? '', validityDate: scheme.validityDate ?? '' },
  })
  const onSubmit = handleSubmit(async (v) => {
    await patch.mutateAsync({ id: scheme.id, body: { name: v.name, title: v.title || null, description: v.description ?? '', validityDate: v.validityDate || null } })
    onClose()
  })
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit {scheme.kind === 'ANJUMAN' ? 'anjuman' : 'scheme'}</DialogTitle></DialogHeader>
        <form onSubmit={(e) => void onSubmit(e).catch(() => {})} className="space-y-4">
          <p className="text-xs text-muted-foreground">EMI, tenure and bonus are fixed once a scheme is created.</p>
          <div className="space-y-1.5"><Label htmlFor="sc-edit-title">Title (blank = none)</Label><Input id="sc-edit-title" {...register('title')} /></div>
          <div className="space-y-1.5"><Label htmlFor="sc-edit-name">Name</Label><Input id="sc-edit-name" {...register('name')} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}</div>
          <div className="space-y-1.5"><Label htmlFor="sc-edit-valid">Validity (blank = none)</Label><Input id="sc-edit-valid" type="date" {...register('validityDate')} /></div>
          <div className="space-y-1.5"><Label htmlFor="sc-edit-desc">Description</Label><Input id="sc-edit-desc" {...register('description')} />
            {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}</div>
          <DialogFooter><Button type="submit" disabled={patch.isPending}>{patch.isPending ? 'Saving…' : 'Save'}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function SchemeList({ kind = 'SAVING' }: { kind?: SchemeKind }) {
  const { can } = useAuth()
  const permKey = kind === 'ANJUMAN' ? 'schemes.anjuman' : 'schemes.all'
  const canEdit = can(permKey, 'edit')
  const canMembers = can('schemes.all', 'view')
  const canDues = can('schemes.due_list', 'view') || can('schemes.due_amount', 'view')
  const canTxns = can('schemes.transactions', 'view')
  const [type, setType] = useState('')
  const [active, setActive] = useState('')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [dateField, setDateField] = useState<'startDate' | 'createdAt'>('startDate')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const { data, isLoading } = useSchemes({
    kind, type: type || undefined, active: active || undefined, q: q.trim() || undefined, page, pageSize,
    ...(from || to ? { dateField, from: from || undefined, to: to || undefined } : {}),
  })
  const patch = usePatchScheme()
  const [editing, setEditing] = useState<SchemeDto | null>(null)
  // Drill-down: a scheme's members (Anjuman rows keep the kind preset too).
  const membersHref = (s: SchemeDto) => `/app/schemes/members?${kind === 'ANJUMAN' ? 'kind=ANJUMAN&' : ''}schemeId=${s.id}`

  const items = data?.items ?? []
  const columns: ColumnDef<SchemeDto, unknown>[] = [
    { header: 'Name', cell: ({ row }) => (canMembers
      ? <Link to={membersHref(row.original)} className="font-medium hover:underline" title="View members">{row.original.name}</Link>
      : <span className="font-medium">{row.original.name}</span>) },
    // shown only once the API returns a title (scheme_cheque_title migration)
    ...(items.some((s) => s.title) ? [{ id: 'title', header: 'Title', cell: ({ row }) => row.original.title || '—' } satisfies ColumnDef<SchemeDto, unknown>] : []),
    { header: 'Type', cell: ({ row }) => row.original.type },
    { header: 'EMI', cell: ({ row }) => inr(row.original.emiAmount) },
    { header: 'Tenure', cell: ({ row }) => (row.original.tenureMonths ? `${row.original.tenureMonths} mo` : 'No EMI') },
    { header: 'Bonus', cell: ({ row }) => (row.original.bonusType === 'NONE' ? '—' : `${BONUS_LABEL[row.original.bonusType]}${row.original.bonusType === 'PERCENT' ? ` ${row.original.bonusValue}%` : ''}`) },
    { header: 'Start', cell: ({ row }) => date(row.original.startDate) },
    { header: 'Validity', cell: ({ row }) => (row.original.validityDate ? date(row.original.validityDate) : '—') },
    { header: 'Branch', cell: ({ row }) => row.original.branch.name || '—' },
    { header: 'Members', cell: ({ row }) => (canMembers
      ? <Link to={membersHref(row.original)} className="tabular-nums hover:underline">{row.original.memberCount}</Link>
      : row.original.memberCount) },
    { header: 'Active', cell: ({ row }) => (canEdit
      ? <Button variant="ghost" size="sm" aria-label="Toggle active" onClick={() => patch.mutate({ id: row.original.id, body: { isActive: !row.original.isActive } })}><Badge variant={row.original.isActive ? 'default' : 'outline'}>{row.original.isActive ? 'Active' : 'Off'}</Badge></Button>
      : <Badge variant={row.original.isActive ? 'default' : 'outline'}>{row.original.isActive ? 'Active' : 'Off'}</Badge>) },
    // drill-down: this scheme's dues / transactions (?schemeId=&kind= presets)
    ...(canDues || canTxns ? [{ id: 'drill', header: '', cell: ({ row }) => {
      const qs = `?schemeId=${row.original.id}&kind=${row.original.kind}`
      return (
        <div className="flex gap-1">
          {canDues && <Button asChild variant="ghost" size="sm"><Link to={`/app/schemes/dues${qs}`} aria-label={`Dues for ${row.original.name}`}>Dues</Link></Button>}
          {canTxns && <Button asChild variant="ghost" size="sm"><Link to={`/app/schemes/transactions${qs}`} aria-label={`Transactions for ${row.original.name}`}>Txns</Link></Button>}
        </div>
      )
    } } satisfies ColumnDef<SchemeDto, unknown>] : []),
    ...(canEdit ? [{ id: 'edit', header: '', cell: ({ row }) => <Button variant="ghost" size="sm" aria-label={`Edit ${row.original.name}`} onClick={() => setEditing(row.original)}>Edit</Button> } satisfies ColumnDef<SchemeDto, unknown>] : []),
  ]

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
        <div className="flex flex-wrap items-center gap-2">
          {anjuman && ANJUMAN_VIEWS.filter((v) => can(v.key, 'view') || ('alt' in v && can(v.alt, 'view'))).map((v) => (
            <Button key={v.to} asChild variant="outline" size="sm"><Link to={`${v.to}?kind=ANJUMAN`}>{v.label}</Link></Button>
          ))}
          {canEdit && <NewSchemeDialog kind={kind} />}
        </div>
      </div>

      <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tile('Total schemes', data ? String(data.total) : '—', 'Matching current filters', Layers)}
        {tile('Active on page', data ? String(items.filter((s) => s.isActive).length) : '—', `of ${items.length} shown`, BadgeCheck)}
        {tile('Enrolled members', data ? String(items.reduce((sum, s) => sum + s.memberCount, 0)) : '—', 'Across schemes shown', Users)}
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 pt-6">
        <Input className="max-w-xs" placeholder={anjuman ? 'Search anjuman name…' : 'Search scheme name…'} aria-label="Search scheme" value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} />
        <Select value={type || 'all'} onValueChange={(v) => { setType(v === 'all' ? '' : v); setPage(1) }}>
          <SelectTrigger className="w-36" aria-label="Type"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All types</SelectItem>{SCHEME_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={active || 'all'} onValueChange={(v) => { setActive(v === 'all' ? '' : v); setPage(1) }}>
          <SelectTrigger className="w-36" aria-label="Status"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="true">Active</SelectItem><SelectItem value="false">Inactive</SelectItem></SelectContent>
        </Select>
        <Select value={dateField} onValueChange={(v) => { setDateField(v as typeof dateField); setPage(1) }}>
          <SelectTrigger className="w-40" aria-label="Filter by"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="startDate">Start date</SelectItem><SelectItem value="createdAt">Launch (created) date</SelectItem></SelectContent>
        </Select>
        <Input className="w-40" type="date" aria-label="From" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1) }} />
        <Input className="w-40" type="date" aria-label="To" value={to} onChange={(e) => { setTo(e.target.value); setPage(1) }} />
        </CardContent>
      </Card>

      <Card className="p-4">
        <DataTable columns={columns} data={data?.items ?? []} isLoading={isLoading} emptyText={`No ${kind === 'ANJUMAN' ? 'anjuman schemes' : 'schemes'} yet`} pagination={data ? { page: data.page, pageSize: data.pageSize, total: data.total, onPage: setPage, onPageSize: setPageSize } : undefined} />
      </Card>
      {editing && <EditSchemeDialog scheme={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}
