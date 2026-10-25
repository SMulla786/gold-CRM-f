import { useState } from 'react'

import { MpinDialog } from '@/components/MpinDialog'
import { PartyPicker } from '@/components/PartyPicker'
import { SelectBranchForTxn } from '@/components/SelectBranchForTxn'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useBankAccounts } from '@/lib/appQueries'
import { useAuth } from '@/lib/auth'
import { useCreateOpening, useOpeningBatches, useReverseOpening } from '@/lib/openingQueries'
import { METALS, type PartyRefDto } from '@/shared'

const inr = (s: string) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(s))
const date = (s: string) => new Date(s).toLocaleDateString('en-IN')
const today = () => new Date().toISOString().slice(0, 10)
const n = (s: string) => Number(s) || 0
let uid = 0
const key = () => `o${uid++}`

interface BankRow { key: string; bankAccountId: string; amount: string }
interface MetalRow { key: string; metal: string; metalForm: string; fine: string }
interface PartyRow { key: string; party: PartyRefDto | null; amount: string; gold: string; silver: string }

export function OpeningBalances() {
  const { can, activeBranch } = useAuth()
  const branchReady = activeBranch !== '' && activeBranch !== 'all'
  const canEdit = can('settings.misc', 'edit')
  const canDelete = can('settings.misc', 'delete')
  const { data: banks } = useBankAccounts()
  const { data: batches } = useOpeningBatches()
  const create = useCreateOpening()
  const reverse = useReverseOpening()

  const [txnDate, setTxnDate] = useState(today())
  const [remark, setRemark] = useState('')
  const [cash, setCash] = useState('')
  const [bankRows, setBankRows] = useState<BankRow[]>([])
  const [metalRows, setMetalRows] = useState<MetalRow[]>([])
  const [partyRows, setPartyRows] = useState<PartyRow[]>([])
  const [mpinOpen, setMpinOpen] = useState(false)
  const [reversing, setReversing] = useState<string | null>(null)

  const buildEntries = () => {
    const entries: Record<string, unknown>[] = []
    if (n(cash) > 0) entries.push({ kind: 'CASH', amount: n(cash) })
    for (const b of bankRows) if (b.bankAccountId && n(b.amount) > 0) entries.push({ kind: 'BANK', bankAccountId: Number(b.bankAccountId), amount: n(b.amount) })
    for (const m of metalRows) if (n(m.fine) > 0) entries.push({ kind: 'METAL', metal: m.metal, metalForm: m.metalForm, fine: n(m.fine) })
    for (const p of partyRows) if (p.party && (n(p.amount) || n(p.gold) || n(p.silver))) entries.push({ kind: 'PARTY', partyId: p.party.id, amount: n(p.amount), gold: n(p.gold), silver: n(p.silver) })
    return entries
  }
  const entryCount = buildEntries().length

  const save = async (mpin: string) => {
    await create.mutateAsync({ body: { txnDate, entries: buildEntries(), remark: remark || undefined }, mpin })
    setCash(''); setBankRows([]); setMetalRows([]); setPartyRows([]); setRemark('')
  }

  return (
    <div className="max-w-3xl space-y-6">
      {!branchReady && <SelectBranchForTxn note="Opening balances are recorded per branch. Select a branch." />}

      {canEdit && (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>New opening balance</CardTitle>
            <Button size="sm" disabled={!branchReady || entryCount === 0 || create.isPending} onClick={() => setMpinOpen(true)}>Save (MPIN)</Button>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1.5"><Label htmlFor="ob-date">As of date</Label><Input id="ob-date" type="date" value={txnDate} onChange={(e) => setTxnDate(e.target.value)} /></div>
              <div className="flex-1 space-y-1.5"><Label htmlFor="ob-remark">Remark</Label><Input id="ob-remark" value={remark} onChange={(e) => setRemark(e.target.value)} /></div>
            </div>

            <div className="space-y-1.5 sm:max-w-xs"><Label htmlFor="ob-cash">Cash in hand ₹</Label><Input id="ob-cash" type="number" value={cash} onChange={(e) => setCash(e.target.value)} /></div>

            <Section title="Bank balances" onAdd={() => setBankRows((r) => [...r, { key: key(), bankAccountId: '', amount: '' }])}>
              {bankRows.map((b, i) => (
                <div key={b.key} className="flex flex-wrap items-end gap-2">
                  <Select value={b.bankAccountId} onValueChange={(v) => setBankRows((rs) => rs.map((x, j) => j === i ? { ...x, bankAccountId: v } : x))}>
                    <SelectTrigger className="w-56" aria-label="Bank account"><SelectValue placeholder="Bank" /></SelectTrigger>
                    <SelectContent>{banks?.map((ba) => <SelectItem key={ba.id} value={String(ba.id)}>{ba.bankName} · {ba.accountNo}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input className="w-32" type="number" placeholder="Amount ₹" aria-label="Bank amount" value={b.amount} onChange={(e) => setBankRows((rs) => rs.map((x, j) => j === i ? { ...x, amount: e.target.value } : x))} />
                  <Button variant="ghost" size="sm" aria-label="Remove bank row" onClick={() => setBankRows((rs) => rs.filter((_, j) => j !== i))}>✕</Button>
                </div>
              ))}
            </Section>

            <Section title="Bullion / loose metal (fine g)" onAdd={() => setMetalRows((r) => [...r, { key: key(), metal: 'GOLD', metalForm: 'BULLION', fine: '' }])}>
              {metalRows.map((m, i) => (
                <div key={m.key} className="flex flex-wrap items-end gap-2">
                  <Select value={m.metal} onValueChange={(v) => setMetalRows((rs) => rs.map((x, j) => j === i ? { ...x, metal: v } : x))}>
                    <SelectTrigger className="w-28" aria-label="Metal"><SelectValue /></SelectTrigger>
                    <SelectContent>{METALS.map((mm) => <SelectItem key={mm} value={mm}>{mm}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={m.metalForm} onValueChange={(v) => setMetalRows((rs) => rs.map((x, j) => j === i ? { ...x, metalForm: v } : x))}>
                    <SelectTrigger className="w-28" aria-label="Metal form"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="BULLION">Bullion</SelectItem><SelectItem value="KACHA">Kacha</SelectItem></SelectContent>
                  </Select>
                  <Input className="w-28" type="number" step="0.001" placeholder="Fine g" aria-label="Fine weight" value={m.fine} onChange={(e) => setMetalRows((rs) => rs.map((x, j) => j === i ? { ...x, fine: e.target.value } : x))} />
                  <Button variant="ghost" size="sm" aria-label="Remove metal row" onClick={() => setMetalRows((rs) => rs.filter((_, j) => j !== i))}>✕</Button>
                </div>
              ))}
            </Section>

            <Section title="Party balances (+ owes shop, − shop owes)" onAdd={() => setPartyRows((r) => [...r, { key: key(), party: null, amount: '', gold: '', silver: '' }])}>
              {partyRows.map((p, i) => (
                <div key={p.key} className="flex flex-wrap items-end gap-2">
                  <div className="w-56"><PartyPicker value={p.party} onChange={(v) => setPartyRows((rs) => rs.map((x, j) => j === i ? { ...x, party: v } : x))} ariaLabel="Party" /></div>
                  <Input className="w-28" type="number" placeholder="₹" aria-label="Party amount" value={p.amount} onChange={(e) => setPartyRows((rs) => rs.map((x, j) => j === i ? { ...x, amount: e.target.value } : x))} />
                  <Input className="w-24" type="number" step="0.001" placeholder="Gold g" aria-label="Party gold" value={p.gold} onChange={(e) => setPartyRows((rs) => rs.map((x, j) => j === i ? { ...x, gold: e.target.value } : x))} />
                  <Input className="w-24" type="number" step="0.001" placeholder="Silver g" aria-label="Party silver" value={p.silver} onChange={(e) => setPartyRows((rs) => rs.map((x, j) => j === i ? { ...x, silver: e.target.value } : x))} />
                  <Button variant="ghost" size="sm" aria-label="Remove party row" onClick={() => setPartyRows((rs) => rs.filter((_, j) => j !== i))}>✕</Button>
                </div>
              ))}
            </Section>
            <p className="text-xs text-muted-foreground">{entryCount} entr{entryCount === 1 ? 'y' : 'ies'} ready. Saving posts opening ledger/party rows you can reverse later.</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Past opening batches</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {batches?.length ? batches.map((b) => (
            <div key={b.sourceId} className="flex flex-wrap items-start gap-3 rounded-md border p-3 text-sm">
              <div className="flex-1 space-y-1">
                <div className="font-medium">{date(b.txnDate)} · {b.branch.name} {b.reversed && <Badge variant="secondary">Reversed</Badge>}</div>
                <div className="text-muted-foreground">
                  {Number(b.cash) > 0 && <span>Cash {inr(b.cash)} · </span>}
                  {b.bank.map((x) => <span key={x.bankAccount.id}>{x.bankAccount.name} {inr(x.amount)} · </span>)}
                  {b.metal.map((x, j) => <span key={j}>{x.fine}g {x.metal} · </span>)}
                  {b.parties.length > 0 && <span>{b.parties.length} part{b.parties.length === 1 ? 'y' : 'ies'}</span>}
                </div>
                {b.remark && <div className="text-xs text-muted-foreground">{b.remark}</div>}
              </div>
              {canDelete && !b.reversed && <Button variant="ghost" size="sm" onClick={() => setReversing(b.sourceId)}>Reverse</Button>}
            </div>
          )) : <p className="text-sm text-muted-foreground">No opening balances recorded yet.</p>}
        </CardContent>
      </Card>

      <MpinDialog open={mpinOpen} title="Authenticate & save opening balances" onConfirm={async (mpin) => { await save(mpin); setMpinOpen(false) }} onClose={() => setMpinOpen(false)} />
      <MpinDialog open={!!reversing} title="Reverse opening batch" onConfirm={async (mpin) => { await reverse.mutateAsync({ sourceId: reversing!, mpin }); setReversing(null) }} onClose={() => setReversing(null)} />
    </div>
  )
}

function Section({ title, onAdd, children }: { title: string; onAdd: () => void; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-medium">{title}</h3>
        <Button variant="outline" size="sm" className="ml-auto" onClick={onAdd}>+ Add</Button>
      </div>
      {children}
    </div>
  )
}
