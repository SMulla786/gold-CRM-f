import type { ColumnDef } from '@tanstack/react-table'
import { ArrowLeftRight, Plus } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { DataTable } from '@/components/DataTable'
import { PartyPicker } from '@/components/PartyPicker'
import { SelectBranchForTxn } from '@/components/SelectBranchForTxn'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useBankAccounts, useSettings } from '@/lib/appQueries'
import { useAuth } from '@/lib/auth'
import { useCreateGirviTransfer, useGirvi, useGirviList, useGirviTransfers, useReturnGirviTransfer } from '@/lib/girviQueries'
import { useT } from '@/lib/i18n'
import { businessDayISO, type GirviTransferDto, type PartyRefDto } from '@/shared'

const inr = (s: string | number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(s))
const date = (s: string) => new Date(s).toLocaleDateString('en-IN')
const num = (s: string) => Number(s) || 0

/** Cash / online split + bank picker, shared by both dialogs. */
function PayFields({ pay, setPay, prefix }: { pay: { cash: string; online: string; bankAccountId: string }; setPay: (p: { cash: string; online: string; bankAccountId: string }) => void; prefix: string }) {
  const t = useT()
  const { data: banks } = useBankAccounts()
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <div className="space-y-1.5"><Label htmlFor={`${prefix}-cash`}>{t('bill.cash')}</Label><Input id={`${prefix}-cash`} inputMode="decimal" value={pay.cash} onChange={(e) => setPay({ ...pay, cash: e.target.value })} /></div>
      <div className="space-y-1.5"><Label htmlFor={`${prefix}-online`}>{t('bill.online')}</Label><Input id={`${prefix}-online`} inputMode="decimal" value={pay.online} onChange={(e) => setPay({ ...pay, online: e.target.value })} /></div>
      <div className="space-y-1.5">
        <Label htmlFor={`${prefix}-bank`}>{t('bill.bank_account')}</Label>
        <Select value={pay.bankAccountId} onValueChange={(v) => setPay({ ...pay, bankAccountId: v })} disabled={num(pay.online) <= 0}>
          <SelectTrigger id={`${prefix}-bank`}><SelectValue placeholder="—" /></SelectTrigger>
          <SelectContent>{(banks ?? []).map((b) => <SelectItem key={b.id} value={String(b.id)}>{b.bankName} ····{b.accountNo.slice(-4)}</SelectItem>)}</SelectContent>
        </Select>
      </div>
    </div>
  )
}

/** Adds one girvi's still-pledged items to the selection. */
function GirviItemsPicker({ batchId, picked, toggle }: { batchId: number; picked: Set<number>; toggle: (id: number) => void }) {
  const t = useT()
  const { data } = useGirvi(batchId)
  if (!data) return <p className="text-sm text-muted-foreground">{t('girvi.loading_girvi')}</p>
  const pledged = data.items.filter((i) => i.status === 'PLEDGED')
  return (
    <div className="rounded-xl border p-3">
      <p className="mb-2 text-sm font-medium">{t('girvi.picker_heading', { no: data.girviNo, name: data.party.name })}</p>
      {pledged.length === 0 && <p className="text-sm text-muted-foreground">{t('girvi.no_pledged')}</p>}
      <div className="grid gap-2 sm:grid-cols-2">
        {pledged.map((it) => (
          <label key={it.id} className="flex items-center gap-2 rounded-lg border p-2 text-sm">
            <Checkbox checked={picked.has(it.id)} onCheckedChange={() => toggle(it.id)} aria-label={`Select ${it.name}`} />
            <span className="flex-1">{it.name} <span className="text-muted-foreground">({it.category})</span></span>
            <span className="tabular-nums text-muted-foreground">{Number(it.fine).toFixed(3)} g · {inr(it.valuation)}</span>
          </label>
        ))}
      </div>
    </div>
  )
}

function NewTransferDialog({ onClose }: { onClose: () => void }) {
  const t = useT()
  const { activeBranch } = useAuth()
  const create = useCreateGirviTransfer()
  const { data: settings } = useSettings()
  const def = settings?.['girvi.defaults']
  const [lender, setLender] = useState<PartyRefDto | null>(null)
  const [search, setSearch] = useState('')
  const [batches, setBatches] = useState<number[]>([])
  const [picked, setPicked] = useState<Set<number>>(new Set())
  const [transferDate, setTransferDate] = useState(businessDayISO())
  const [terms, setTerms] = useState<{ principal: string; ratePercent: string; ratePeriod: string; interestType: string; ciPeriod: string; method: string; tenureMonths: string }>({
    principal: '', ratePercent: def ? String(def.ratePercent) : '', ratePeriod: def?.ratePeriod ?? 'MONTHLY', interestType: def?.interestType ?? 'SI',
    ciPeriod: def?.ciPeriod ?? 'MONTHLY', method: def?.method ?? 'DAY_WISE', tenureMonths: def ? String(def.tenureMonths) : '12',
  })
  const [pay, setPay] = useState({ cash: '', online: '', bankAccountId: '' })
  const [remark, setRemark] = useState('')
  const { data: found } = useGirviList({ status: 'ACTIVE', q: search || undefined, pageSize: 10 })
  const toggle = (id: number) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })

  const paid = num(pay.cash) + num(pay.online)
  const valid = lender && picked.size > 0 && num(terms.principal) > 0 && Math.abs(paid - num(terms.principal)) < 0.005 && (num(pay.online) === 0 || pay.bankAccountId)
  const submit = () => {
    if (!valid || create.isPending) return
    create.mutate(
      {
        lenderPartyId: lender!.id, itemIds: [...picked], transferDate, principal: num(terms.principal), ratePercent: num(terms.ratePercent), ratePeriod: terms.ratePeriod,
        interestType: terms.interestType, ciPeriod: terms.interestType === 'CI' ? terms.ciPeriod : undefined, method: terms.method, tenureMonths: Number(terms.tenureMonths),
        cash: num(pay.cash), online: num(pay.online), bankAccountId: pay.bankAccountId ? Number(pay.bankAccountId) : undefined, remark: remark || undefined,
      },
      { onSuccess: onClose },
    )
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader><DialogTitle>{t('girvi.transfer_title')}</DialogTitle></DialogHeader>
        <div className="space-y-5">
          {(activeBranch === '' || activeBranch === 'all') && <SelectBranchForTxn note={t('girvi.transfer_branch_note')} />}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="gt-lender">{t('girvi.lender_req')}</Label><PartyPicker value={lender} onChange={setLender} id="gt-lender" ariaLabel="Lender" placeholder={t('girvi.search_lender')} /></div>
            <div className="space-y-1.5"><Label htmlFor="gt-date">{t('girvi.transfer_date')}</Label><Input id="gt-date" type="date" value={transferDate} onChange={(e) => setTransferDate(e.target.value)} /></div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="gt-search">{t('girvi.add_from_active')}</Label>
            <Input id="gt-search" placeholder={t('girvi.search_active')} value={search} onChange={(e) => setSearch(e.target.value)} />
            <div className="flex flex-wrap gap-2">
              {(found?.items ?? []).filter((g) => !batches.includes(g.id)).map((g) => (
                <Button key={g.id} type="button" size="sm" variant="outline" onClick={() => setBatches((b) => [...b, g.id])}>
                  <Plus aria-hidden /> #{g.girviNo} {g.party.name}
                </Button>
              ))}
            </div>
            {batches.map((b) => <GirviItemsPicker key={b} batchId={b} picked={picked} toggle={toggle} />)}
            <p className="text-sm text-muted-foreground">{t('girvi.items_selected', { n: picked.size })}</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5"><Label htmlFor="gt-principal">{t('girvi.amount_received_req')}</Label><Input id="gt-principal" inputMode="decimal" value={terms.principal} onChange={(e) => setTerms({ ...terms, principal: e.target.value })} /></div>
            <div className="space-y-1.5"><Label htmlFor="gt-rate">{t('girvi.interest_pct_req')}</Label><Input id="gt-rate" inputMode="decimal" value={terms.ratePercent} onChange={(e) => setTerms({ ...terms, ratePercent: e.target.value })} /></div>
            <div className="space-y-1.5"><Label htmlFor="gt-tenure">{t('girvi.tenure_req')}</Label><Input id="gt-tenure" inputMode="numeric" value={terms.tenureMonths} onChange={(e) => setTerms({ ...terms, tenureMonths: e.target.value })} /></div>
            <div className="space-y-1.5">
              <Label htmlFor="gt-period">{t('girvi.rate_per')}</Label>
              <Select value={terms.ratePeriod} onValueChange={(v) => setTerms({ ...terms, ratePeriod: v })}>
                <SelectTrigger id="gt-period"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="MONTHLY">{t('gst.month')}</SelectItem><SelectItem value="ANNUAL">{t('girvi.year')}</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gt-type">{t('girvi.interest_type')}</Label>
              <Select value={terms.interestType} onValueChange={(v) => setTerms({ ...terms, interestType: v })}>
                <SelectTrigger id="gt-type"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="SI">{t('girvi.simple_si')}</SelectItem><SelectItem value="CI">{t('girvi.compound_ci')}</SelectItem></SelectContent>
              </Select>
            </div>
            {terms.interestType === 'CI' && (
              <div className="space-y-1.5">
                <Label htmlFor="gt-ci">{t('girvi.compounding')}</Label>
                <Select value={terms.ciPeriod} onValueChange={(v) => setTerms({ ...terms, ciPeriod: v })}>
                  <SelectTrigger id="gt-ci"><SelectValue /></SelectTrigger>
                  <SelectContent>{['DAILY', 'MONTHLY', 'HALF_YEARLY', 'YEARLY'].map((p) => <SelectItem key={p} value={p}>{p.replace('_', ' ').toLowerCase()}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
          </div>

          <PayFields pay={pay} setPay={setPay} prefix="gt" />
          {num(terms.principal) > 0 && Math.abs(paid - num(terms.principal)) >= 0.005 && <p className="text-sm text-destructive">{t('girvi.transfer_mismatch', { amount: inr(terms.principal) })}</p>}
          <div className="space-y-1.5"><Label htmlFor="gt-remark">{t('udhari.remark')}</Label><Input id="gt-remark" maxLength={300} value={remark} onChange={(e) => setRemark(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
          <Button onClick={submit} disabled={!valid || create.isPending}>{create.isPending ? t('bill.saving') : t('girvi.transfer_items')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ReturnDialog({ transfer, onClose }: { transfer: GirviTransferDto; onClose: () => void }) {
  const t = useT()
  const ret = useReturnGirviTransfer()
  const [returnedOn, setReturnedOn] = useState(businessDayISO())
  const [interest, setInterest] = useState(transfer.interest)
  const total = num(transfer.principal) + num(interest)
  const [pay, setPay] = useState({ cash: total.toFixed(2), online: '', bankAccountId: '' })
  const paid = num(pay.cash) + num(pay.online)
  const valid = Math.abs(paid - total) < 0.005 && (num(pay.online) === 0 || pay.bankAccountId)
  const submit = () => {
    if (!valid || ret.isPending) return
    ret.mutate(
      { id: transfer.id, body: { returnedOn, interest: num(interest), cash: num(pay.cash), online: num(pay.online), bankAccountId: pay.bankAccountId ? Number(pay.bankAccountId) : undefined } },
      { onSuccess: onClose },
    )
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader><DialogTitle>{t('girvi.receive_back_title', { no: transfer.transferNo })}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{t('girvi.receive_back_desc', { name: transfer.lender.name, n: transfer.items.length })}</p>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5"><Label htmlFor="gr-date">{t('udhari.date')}</Label><Input id="gr-date" type="date" value={returnedOn} onChange={(e) => setReturnedOn(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>{t('girvi.principal')}</Label><p className="h-9 content-center tabular-nums">{inr(transfer.principal)}</p></div>
            <div className="space-y-1.5"><Label htmlFor="gr-interest">{t('girvi.interest')}</Label><Input id="gr-interest" inputMode="decimal" value={interest} onChange={(e) => setInterest(e.target.value)} /></div>
          </div>
          <p className="text-sm">{t('girvi.total_to_pay')} <span className="font-semibold tabular-nums">{inr(total)}</span> <span className="text-muted-foreground">{t('girvi.interest_owed_today', { amount: inr(transfer.interest) })}</span></p>
          <PayFields pay={pay} setPay={setPay} prefix="gr" />
          {Math.abs(paid - total) >= 0.005 && <p className="text-sm text-destructive">{t('girvi.cash_online_equal', { amount: inr(total) })}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
          <Button onClick={submit} disabled={!valid || ret.isPending}>{ret.isPending ? t('bill.saving') : t('girvi.receive_items_back')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Girvi > Transfers: items re-pledged to lenders, and receiving them back. */
export function GirviTransfers() {
  const t = useT()
  const { can } = useAuth()
  const [status, setStatus] = useState('ACTIVE')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  const [creating, setCreating] = useState(false)
  const [returning, setReturning] = useState<GirviTransferDto | null>(null)
  const { data, isLoading } = useGirviTransfers({ status: status || undefined, from: from || undefined, to: to || undefined, page })
  const canEdit = can('girvi.transfer', 'edit')

  const columns: ColumnDef<GirviTransferDto, unknown>[] = [
    { header: t('girvi.col_receipt'), cell: ({ row }) => <span className="font-semibold">#{row.original.transferNo}</span> },
    { header: t('girvi.transfer_date'), cell: ({ row }) => date(row.original.transferDate) },
    { header: t('girvi.col_lender'), cell: ({ row }) => row.original.lender.name },
    {
      header: t('girvi.col_customers_items'),
      cell: ({ row }) => (
        <div className="max-w-72 space-y-0.5 text-sm">
          {row.original.items.map((i) => (
            <div key={i.id} className="truncate">
              <Link className="text-brand-strong hover:underline" to={`/app/girvi/${i.batchId}`}>#{i.girviNo}</Link> {i.customer.name} · {i.name} <span className="text-muted-foreground">{Number(i.fine).toFixed(3)} g</span>
            </div>
          ))}
        </div>
      ),
    },
    { header: t('girvi.principal'), cell: ({ row }) => <span className="tabular-nums">{inr(row.original.principal)}</span> },
    { header: t('girvi.interest'), cell: ({ row }) => <span className="tabular-nums">{inr(row.original.interest)}<span className="block text-xs text-muted-foreground">{Number(row.original.ratePercent)}% {row.original.interestType}</span></span> },
    { header: t('girvi.col_return_by'), cell: ({ row }) => date(row.original.returnDate) },
    { header: t('stock.col_status'), cell: ({ row }) => <Badge variant={row.original.status === 'ACTIVE' ? 'secondary' : 'default'}>{row.original.status === 'ACTIVE' ? t('girvi.with_lender') : t('girvi.returned_on', { date: row.original.returnedOn ? date(row.original.returnedOn) : '' })}</Badge> },
    { id: 'act', header: '', cell: ({ row }) => (canEdit && row.original.status === 'ACTIVE' ? <Button size="sm" variant="outline" onClick={() => setReturning(row.original)}>{t('girvi.receive_back')}</Button> : null) },
  ]

  return (
    <div className="space-y-6">
      <Card className="flex flex-wrap items-end gap-3 p-4">
        <Select value={status || 'all'} onValueChange={(v) => { setStatus(v === 'all' ? '' : v); setPage(1) }}>
          <SelectTrigger className="w-40" aria-label="Status"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">{t('girvi.status_all')}</SelectItem><SelectItem value="ACTIVE">{t('girvi.with_lender')}</SelectItem><SelectItem value="RETURNED">{t('girvi.returned')}</SelectItem></SelectContent>
        </Select>
        <Input type="date" className="w-40" aria-label="From" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1) }} />
        <Input type="date" className="w-40" aria-label="To" value={to} onChange={(e) => { setTo(e.target.value); setPage(1) }} />
        {canEdit && <Button className="ml-auto" onClick={() => setCreating(true)}><ArrowLeftRight aria-hidden /> {t('girvi.new_transfer')}</Button>}
      </Card>
      <DataTable columns={columns} data={data?.items ?? []} isLoading={isLoading} emptyText={t('girvi.no_transfers')} pagination={data ? { page: data.page, pageSize: data.pageSize, total: data.total, onPage: setPage } : undefined} />
      {creating && <NewTransferDialog onClose={() => setCreating(false)} />}
      {returning && <ReturnDialog transfer={returning} onClose={() => setReturning(null)} />}
    </div>
  )
}
