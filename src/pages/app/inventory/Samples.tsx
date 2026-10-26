import { zodResolver } from '@hookform/resolvers/zod'
import type { ColumnDef } from '@tanstack/react-table'
import { useEffect, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import type { z } from 'zod'

import { DataTable } from '@/components/DataTable'
import { PartyCombobox } from '@/components/PartyCombobox'
import { SelectBranchForTxn } from '@/components/SelectBranchForTxn'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useAuth } from '@/lib/auth'
import { useT } from '@/lib/i18n'
import { SAMPLES_PERM, useCreateSample, useIssueSample, useMeltSample, useReturnSample, useSample, useSamples, useUpdateSample } from '@/lib/samplesQueries'
import { METALS, SAMPLE_STATUSES, sampleBody, type PartyRefDto, type SampleDto, type SampleStatus } from '@/shared'

type FormIn = z.input<typeof sampleBody>
type FormOut = z.output<typeof sampleBody>

const ALL = 'ALL'
const date = (s: string) => new Date(s).toLocaleDateString('en-IN')
const dateTime = (s: string) => new Date(s).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
const STATUS_VARIANT: Record<SampleStatus, 'default' | 'secondary' | 'outline' | 'destructive'> = { IN_HAND: 'default', ISSUED: 'secondary', RETURNED: 'outline', MELTED: 'destructive' }
const EDITABLE: SampleStatus[] = ['IN_HAND', 'RETURNED']
/** PartyCombobox shows "name · mobile"; DTO refs carry no mobile. */
const asRef = (p: { id: number; name: string } | null, type: PartyRefDto['type']): PartyRefDto | null => (p ? { id: p.id, name: p.name, type, mobile: '—', shopName: null } : null)
const autoFine = (gross: unknown, tounch: unknown) => ((Number(gross) || 0) * (Number(tounch) || 0) / 100).toFixed(3)

function StatusBadge({ status }: { status: SampleStatus }) {
  const t = useT()
  return <Badge variant={STATUS_VARIANT[status]}>{t(`samples.status.${status}`)}</Badge>
}

/** New sample (POST) or edit (PATCH, only IN_HAND / RETURNED). Fine follows gross × tounch / 100 until typed over. */
function SampleFormDialog({ sample, onClose }: { sample?: SampleDto; onClose: () => void }) {
  const t = useT()
  const { activeBranch } = useAuth()
  const branchReady = !!sample || (activeBranch !== '' && activeBranch !== 'all')
  const create = useCreateSample()
  const update = useUpdateSample()
  const { register, handleSubmit, control, setValue, formState: { errors } } = useForm<FormIn, unknown, FormOut>({
    resolver: zodResolver(sampleBody),
    defaultValues: sample
      ? { metal: sample.metal, grossWt: Number(sample.grossWt), tounchPercent: Number(sample.tounchPercent), note: sample.note ?? '' }
      : { metal: 'GOLD', grossWt: '' as unknown as number, tounchPercent: '' as unknown as number, note: '' },
  })
  const [party, setParty] = useState<PartyRefDto | null>(asRef(sample?.party ?? null, 'CUSTOMER'))
  const [karigar, setKarigar] = useState<PartyRefDto | null>(asRef(sample?.karigar ?? null, 'KARIGAR'))
  // null = automatic (server computes the same 3-dp half-up value when fine is omitted)
  const [fineManual, setFineManual] = useState<string | null>(sample && sample.fine !== autoFine(sample.grossWt, sample.tounchPercent) ? sample.fine : null)
  const [metalV, grossV, tounchV] = useWatch({ control, name: ['metal', 'grossWt', 'tounchPercent'] })
  const fineAuto = autoFine(grossV, tounchV)
  const fineBad = fineManual !== null && (fineManual.trim() === '' || !(Number(fineManual) >= 0))
  const pending = create.isPending || update.isPending

  const submit = handleSubmit(async (v) => {
    if (fineBad) return
    const fine = fineManual !== null ? Number(fineManual) : undefined
    if (sample) {
      await update.mutateAsync({
        id: sample.id,
        body: { metal: v.metal, grossWt: v.grossWt, tounchPercent: v.tounchPercent, fine, partyId: party?.id ?? null, karigarId: karigar?.id ?? null, note: v.note ? v.note : null },
      })
    } else {
      await create.mutateAsync({ metal: v.metal, grossWt: v.grossWt, tounchPercent: v.tounchPercent, fine, partyId: party?.id, karigarId: karigar?.id, note: v.note || undefined })
    }
    onClose()
  })
  const err = (k: keyof FormIn) => errors[k] && <p className="text-xs text-destructive">{errors[k]?.message}</p>

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{sample ? t('samples.edit_title', { no: sample.sampleNo }) : t('samples.new')}</DialogTitle>
          <DialogDescription>{t('samples.form_desc')}</DialogDescription>
        </DialogHeader>
        {!branchReady && <SelectBranchForTxn note={t('samples.branch_note')} />}
        <form id="sample-form" onSubmit={(e) => void submit(e).catch(() => {})} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t('samples.metal')}</Label>
              <Select value={metalV} onValueChange={(v) => setValue('metal', v as FormOut['metal'])}>
                <SelectTrigger aria-label="Sample metal"><SelectValue /></SelectTrigger>
                <SelectContent>{METALS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sm-gross">{t('samples.gross_g')}</Label>
              <Input id="sm-gross" type="number" step="0.001" min="0" inputMode="decimal" {...register('grossWt')} />
              {err('grossWt')}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sm-tounch">{t('samples.tounch_pct')}</Label>
              <Input id="sm-tounch" type="number" step="0.01" min="0" max="100" inputMode="decimal" {...register('tounchPercent')} />
              {err('tounchPercent')}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sm-fine">{t('samples.fine_g')}</Label>
              <Input id="sm-fine" type="number" step="0.001" min="0" inputMode="decimal" value={fineManual ?? fineAuto} onChange={(e) => setFineManual(e.target.value)} />
              {fineManual !== null ? (
                <button type="button" className="text-xs text-primary hover:underline" onClick={() => setFineManual(null)}>{t('samples.use_auto', { g: fineAuto })}</button>
              ) : (
                <p className="text-xs text-muted-foreground">{t('samples.auto_hint')}</p>
              )}
              {fineBad && <p className="text-xs text-destructive">{t('samples.fine_invalid')}</p>}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sm-party">{t('samples.party')}</Label>
            <PartyCombobox id="sm-party" value={party} onChange={setParty} ariaLabel="Sample party" placeholder={t('samples.search_party')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sm-karigar">{t('samples.karigar')}</Label>
            <PartyCombobox id="sm-karigar" value={karigar} onChange={setKarigar} type="KARIGAR" ariaLabel="Sample karigar" placeholder={t('samples.search_karigar')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sm-note">{t('samples.note')}</Label>
            <Input id="sm-note" {...register('note')} />
            {err('note')}
          </div>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('samples.cancel')}</Button>
          <Button type="submit" form="sample-form" disabled={!branchReady || pending || fineBad}>{pending ? t('samples.saving') : sample ? t('samples.save_changes') : t('samples.save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

type ActionKind = 'issue' | 'return' | 'melt'

/** Issue (to karigar / party), return (back in hand) or melt (terminal). Custody only. */
function ActionDialog({ sample, kind, onClose }: { sample: SampleDto; kind: ActionKind; onClose: () => void }) {
  const t = useT()
  const issue = useIssueSample()
  const ret = useReturnSample()
  const melt = useMeltSample()
  const [karigar, setKarigar] = useState<PartyRefDto | null>(asRef(sample.karigar, 'KARIGAR'))
  const [party, setParty] = useState<PartyRefDto | null>(asRef(sample.party, 'CUSTOMER'))
  const [note, setNote] = useState('')
  const pending = issue.isPending || ret.isPending || melt.isPending
  const title = t(`samples.${kind}_title`, { no: sample.sampleNo })

  const go = async () => {
    const body = { note: note.trim() || undefined }
    if (kind === 'issue') await issue.mutateAsync({ id: sample.id, body: { ...body, karigarId: karigar?.id, partyId: party?.id } })
    else if (kind === 'return') await ret.mutateAsync({ id: sample.id, body })
    else await melt.mutateAsync({ id: sample.id, body })
    onClose()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {sample.metal} · {sample.grossWt} g · {Number(sample.tounchPercent).toFixed(2)}% · {t('samples.picker_fine', { g: sample.fine })}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {kind === 'issue' && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="si-karigar">{t('samples.karigar')}</Label>
                <PartyCombobox id="si-karigar" value={karigar} onChange={setKarigar} type="KARIGAR" ariaLabel="Issue to karigar" placeholder={t('samples.search_karigar')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="si-party">{t('samples.party')}</Label>
                <PartyCombobox id="si-party" value={party} onChange={setParty} ariaLabel="Issue to party" placeholder={t('samples.search_party')} />
              </div>
              <p className="text-xs text-muted-foreground">{t('samples.keep_holder')}</p>
            </>
          )}
          {kind === 'melt' && (
            <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">{t('samples.melt_warning')}</p>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="sa-note">{t('samples.note')}</Label>
            <Input id="sa-note" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('samples.cancel')}</Button>
          <Button variant={kind === 'melt' ? 'destructive' : 'default'} disabled={pending} onClick={() => void go().catch(() => {})}>
            {kind === 'issue' ? t('samples.issue_btn') : kind === 'return' ? t('samples.mark_returned') : t('samples.mark_melted')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DetailSheet({ id, onClose }: { id: number; onClose: () => void }) {
  const t = useT()
  const { data, isLoading } = useSample(id)
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{t('samples.detail_title', { no: data?.sampleNo ?? '' })}</SheetTitle>
          <SheetDescription>{t('samples.detail_desc')}</SheetDescription>
        </SheetHeader>
        {isLoading || !data ? (
          <p className="px-4 text-sm text-muted-foreground">{t('samples.loading')}</p>
        ) : (
          <div className="space-y-4 px-4 pb-6 text-sm">
            <div className="grid grid-cols-2 gap-2 rounded-2xl border bg-muted/40 p-3 tabular-nums">
              <div><div className="text-xs text-muted-foreground">{t('samples.metal')}</div>{data.metal}</div>
              <div><div className="text-xs text-muted-foreground">{t('samples.status')}</div><StatusBadge status={data.status} /></div>
              <div><div className="text-xs text-muted-foreground">{t('samples.gross')}</div>{data.grossWt} g</div>
              <div><div className="text-xs text-muted-foreground">{t('samples.tounch')}</div>{Number(data.tounchPercent).toFixed(2)}%</div>
              <div><div className="text-xs text-muted-foreground">{t('samples.fine')}</div>{data.fine} g</div>
              <div><div className="text-xs text-muted-foreground">{t('samples.branch')}</div>{data.branch.name}</div>
              <div><div className="text-xs text-muted-foreground">{t('samples.party')}</div>{data.party?.name ?? '—'}</div>
              <div><div className="text-xs text-muted-foreground">{t('samples.karigar')}</div>{data.karigar?.name ?? '—'}</div>
              {data.note && <div className="col-span-2"><div className="text-xs text-muted-foreground">{t('samples.note')}</div>{data.note}</div>}
            </div>
            <ol className="space-y-2">
              {data.movements.map((m) => (
                <li key={m.id} className="rounded-xl border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{t(`samples.action.${m.action}`)}</span>
                    <span className="text-xs text-muted-foreground">{dateTime(m.createdAt)}</span>
                  </div>
                  {(m.karigar || m.party) && <div className="text-muted-foreground">{t('samples.to_names', { names: [m.karigar?.name, m.party?.name].filter(Boolean).join(' / ') })}</div>}
                  {m.note && <div>{m.note}</div>}
                  {m.user && <div className="text-xs text-muted-foreground">{t('samples.by_user', { user: m.user })}</div>}
                </li>
              ))}
            </ol>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

/** Inventory › Samples: the tounch-sample custody register (IN_HAND → ISSUED → RETURNED …, any → MELTED). */
export function Samples() {
  const t = useT()
  const { can } = useAuth()
  const canEdit = can(SAMPLES_PERM, 'edit')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [status, setStatus] = useState(ALL)
  const [metal, setMetal] = useState(ALL)
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  // 250 ms debounce (same as SamplePicker); a new term goes back to page 1
  useEffect(() => {
    const timer = setTimeout(() => { setDebouncedQ(q.trim()); setPage(1) }, 250)
    return () => clearTimeout(timer)
  }, [q])
  const { data, isLoading } = useSamples({ page, pageSize, q: debouncedQ || undefined, status: status === ALL ? undefined : status, metal: metal === ALL ? undefined : metal })
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<SampleDto | null>(null)
  const [action, setAction] = useState<{ sample: SampleDto; kind: ActionKind } | null>(null)
  const [detailId, setDetailId] = useState<number | null>(null)
  const filter = (fn: (v: string) => void) => (v: string) => { fn(v); setPage(1) }

  const rows = data?.items ?? []
  const gross = rows.reduce((a, s) => a + Number(s.grossWt), 0)
  const fine = rows.reduce((a, s) => a + Number(s.fine), 0)

  const columns: ColumnDef<SampleDto, unknown>[] = [
    { header: t('samples.col_no'), cell: ({ row }) => <button className="font-medium hover:underline" aria-label={`Open sample #${row.original.sampleNo}`} onClick={() => setDetailId(row.original.id)}>#{row.original.sampleNo}</button> },
    { accessorKey: 'metal', header: t('samples.metal') },
    { header: t('samples.col_gross'), cell: ({ row }) => <span className="tabular-nums">{row.original.grossWt}</span> },
    { header: t('samples.col_tounch'), cell: ({ row }) => <span className="tabular-nums">{Number(row.original.tounchPercent).toFixed(2)}</span> },
    { header: t('samples.col_fine'), cell: ({ row }) => <span className="tabular-nums">{row.original.fine}</span> },
    { header: t('samples.status'), cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    { header: t('samples.col_holder'), cell: ({ row }) => [row.original.party?.name, row.original.karigar?.name].filter(Boolean).join(' / ') || '—' },
    { header: t('samples.col_date'), cell: ({ row }) => date(row.original.createdAt) },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const s = row.original
        return (
          <div className="flex justify-end gap-1">
            <Button size="sm" variant="ghost" onClick={() => setDetailId(s.id)}>{t('samples.history')}</Button>
            {canEdit && EDITABLE.includes(s.status) && <Button size="sm" variant="outline" onClick={() => setAction({ sample: s, kind: 'issue' })}>{t('samples.btn_issue')}</Button>}
            {canEdit && s.status === 'ISSUED' && <Button size="sm" variant="outline" onClick={() => setAction({ sample: s, kind: 'return' })}>{t('samples.btn_return')}</Button>}
            {canEdit && EDITABLE.includes(s.status) && <Button size="sm" variant="ghost" onClick={() => setEditing(s)}>{t('samples.btn_edit')}</Button>}
            {canEdit && s.status !== 'MELTED' && <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setAction({ sample: s, kind: 'melt' })}>{t('samples.btn_melt')}</Button>}
          </div>
        )
      },
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl">{t('samples.title')}</h2>
          <p className="text-sm text-muted-foreground">{t('samples.intro')}</p>
        </div>
        {canEdit && <Button onClick={() => setCreating(true)}>{t('samples.new')}</Button>}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="samples-q">{t('samples.search')}</Label>
          <Input id="samples-q" type="search" className="w-56" placeholder={t('samples.search_ph')} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>{t('samples.status')}</Label>
          <Select value={status} onValueChange={filter(setStatus)}>
            <SelectTrigger className="w-40" aria-label="Sample status"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t('samples.all_statuses')}</SelectItem>
              {SAMPLE_STATUSES.map((s) => <SelectItem key={s} value={s}>{t(`samples.status.${s}`)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>{t('samples.metal')}</Label>
          <Select value={metal} onValueChange={filter(setMetal)}>
            <SelectTrigger className="w-36" aria-label="Sample metal filter"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t('samples.all_metals')}</SelectItem>
              {METALS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="ml-auto flex gap-4 rounded-2xl border bg-muted/40 px-4 py-2 text-sm tabular-nums" aria-label="Page totals">
          <span><span className="text-muted-foreground">{t('samples.count')}{' '}</span>{data?.total ?? '—'}</span>
          <span><span className="text-muted-foreground">{t('samples.gross_page')}{' '}</span>{gross.toFixed(3)} g</span>
          <span><span className="text-muted-foreground">{t('samples.fine_page')}{' '}</span>{fine.toFixed(3)} g</span>
        </div>
      </div>

      <Card className="p-4">
        <DataTable
          columns={columns}
          data={rows}
          isLoading={isLoading}
          emptyText={t('samples.empty')}
          pagination={data ? { page: data.page, pageSize: data.pageSize, total: data.total, onPage: setPage, onPageSize: setPageSize } : undefined}
        />
      </Card>

      {creating && <SampleFormDialog onClose={() => setCreating(false)} />}
      {editing && <SampleFormDialog sample={editing} onClose={() => setEditing(null)} />}
      {action && <ActionDialog sample={action.sample} kind={action.kind} onClose={() => setAction(null)} />}
      {detailId && <DetailSheet id={detailId} onClose={() => setDetailId(null)} />}
    </div>
  )
}
