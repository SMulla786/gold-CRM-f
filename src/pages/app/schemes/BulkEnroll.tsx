import { useState } from 'react'
import { toast } from 'sonner'

import { PartyPicker } from '@/components/PartyPicker'
import { SelectBranchForTxn } from '@/components/SelectBranchForTxn'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAuth } from '@/lib/auth'
import { useBulkEnroll, useSchemeGroups, useSchemes } from '@/lib/schemesQueries'
import { plural } from '@/lib/plural'
import type { BulkEnrollResult } from '@/lib/schemesQueries'
import { businessDayISO, type PartyRefDto } from '@/shared'

const today = businessDayISO

/** mode PAY = "With EMI pay": the row also sends firstPayment (enrollmentBody already accepts it). */
interface MemberRow { key: string; party: PartyRefDto | null; assignId: string; mode: 'ENROLL' | 'PAY'; payAmount: string; payDate: string }
let uid = 0
const blank = (): MemberRow => ({ key: `m${uid++}`, party: null, assignId: '', mode: 'ENROLL', payAmount: '', payDate: today() })

export function BulkEnroll() {
  const { activeBranch } = useAuth()
  const branchReady = activeBranch !== '' && activeBranch !== 'all'
  const { data: schemes } = useSchemes({ active: 'true', pageSize: 100 })
  const bulk = useBulkEnroll()

  const [schemeId, setSchemeId] = useState('')
  const { data: groups } = useSchemeGroups(schemeId ? Number(schemeId) : undefined)
  const [groupId, setGroupId] = useState('')
  const [emiAmount, setEmiAmount] = useState('')
  const [startDate, setStartDate] = useState(today())
  const [tokenAmount, setTokenAmount] = useState('0')
  const [prefix, setPrefix] = useState('')
  const [startNo, setStartNo] = useState('1')
  const [rows, setRows] = useState<MemberRow[]>([blank(), blank(), blank()])
  const [results, setResults] = useState<BulkEnrollResult[] | null>(null)

  const [count, setCount] = useState('1')
  const setRow = (i: number, patch: Partial<MemberRow>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  const autoNumber = () => setRows((rs) => rs.map((r, i) => ({ ...r, assignId: `${prefix}${Number(startNo) + i}` })))
  // 'Count' shortcut: N more rows for the same customer (same pay options, blank IDs — auto-number them after)
  const repeatRow = (i: number) => setRows((rs) => {
    const n = Math.min(Math.max(Math.trunc(Number(count)) || 0, 0), 50)
    return [...rs.slice(0, i + 1), ...Array.from({ length: n }, () => ({ ...rs[i]!, key: blank().key, assignId: '' })), ...rs.slice(i + 1)]
  })

  const scheme = schemes?.items.find((s) => String(s.id) === schemeId)
  const emi = emiAmount || scheme?.emiAmount || ''
  const payOf = (r: MemberRow) => Number(r.payAmount || emi) || 0
  const filled = rows.filter((r) => r.party && r.assignId.trim())
  const assignIds = filled.map((r) => r.assignId.trim())
  const dupIds = assignIds.length !== new Set(assignIds).size
  const badPay = filled.some((r) => r.mode === 'PAY' && payOf(r) <= 0)
  const valid = branchReady && !!schemeId && filled.length > 0 && !dupIds && !badPay

  const submit = async () => {
    setResults(null)
    const targets = rows.filter((r) => r.party && r.assignId.trim())
    const bodies = targets.map((r) => ({
      schemeId: Number(schemeId), groupId: groupId ? Number(groupId) : undefined, partyId: r.party!.id,
      assignId: r.assignId.trim(), displayName: r.party!.name,
      emiAmount: emiAmount ? Number(emiAmount) : undefined, startDate, tokenAmount: Number(tokenAmount) || 0,
      firstPayment: r.mode === 'PAY' ? { amount: payOf(r), txnDate: r.payDate || undefined, medium: 'CASH' } : undefined,
    }))
    const res = await bulk.mutateAsync(bodies)
    setResults(res)
    const ok = res.filter((r) => r.ok).length
    const fail = res.length - ok
    if (fail === 0) toast.success(`Enrolled ${plural(ok, 'member')}`)
    else toast.error(`${ok} enrolled, ${fail} failed — see the list`)
    if (ok > 0) setRows((rs) => rs.filter((_, i) => !res[i]?.ok)) // keep only the rows that failed, to retry
  }

  return (
    <div className="max-w-6xl space-y-8">
      <div>
        <h2 className="text-xl">Bulk enrolment</h2>
        <p className="text-sm text-muted-foreground">Book several members into one scheme in a single submit.</p>
      </div>

      {!branchReady && <SelectBranchForTxn note="Enrolment is booked at one branch. Select a branch." />}

      <Card>
        <CardHeader><CardTitle>Scheme &amp; terms</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1.5"><Label>Scheme</Label>
            <Select value={schemeId} onValueChange={(v) => { setSchemeId(v); setGroupId('') }}><SelectTrigger aria-label="Scheme"><SelectValue placeholder="Select scheme" /></SelectTrigger>
              <SelectContent>{schemes?.items.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name} · {s.type}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="space-y-1.5"><Label>Group (optional)</Label>
            <Select value={groupId || 'none'} onValueChange={(v) => setGroupId(v === 'none' ? '' : v)} disabled={!groups?.length}><SelectTrigger aria-label="Group"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="none">No group</SelectItem>{groups?.map((g) => <SelectItem key={g.id} value={String(g.id)}>{g.name}{g.memberLimit ? ` (${g.memberCount}/${g.memberLimit})` : ''}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="space-y-1.5"><Label htmlFor="be-emi">EMI ₹ (optional)</Label><Input id="be-emi" type="number" value={emiAmount} onChange={(e) => setEmiAmount(e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="be-start">Start date</Label><Input id="be-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="be-token">Joining token ₹</Label><Input id="be-token" type="number" value={tokenAmount} onChange={(e) => setTokenAmount(e.target.value)} /></div>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-xl">Members</h2>
        <Card>
          <CardContent className="flex flex-wrap items-end gap-3 pt-6">
            <div className="space-y-1.5"><Label htmlFor="be-prefix">ID prefix</Label><Input id="be-prefix" className="w-28" value={prefix} onChange={(e) => setPrefix(e.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="be-startno">Start #</Label><Input id="be-startno" className="w-20" type="number" value={startNo} onChange={(e) => setStartNo(e.target.value)} /></div>
            <Button type="button" variant="outline" onClick={autoNumber}>Auto-number IDs</Button>
            <div className="space-y-1.5"><Label htmlFor="be-count">Count</Label><Input id="be-count" className="w-20" type="number" min={1} max={50} value={count} onChange={(e) => setCount(e.target.value)} /></div>
            <p className="pb-2 text-xs text-muted-foreground">“Repeat” on a row adds this many more rows for the same customer.</p>
          </CardContent>
        </Card>

        <div className="overflow-x-auto rounded-3xl border bg-card shadow-sm">
          <Table>
            <TableHeader><TableRow><TableHead className="min-w-64">Member</TableHead><TableHead>Assign ID</TableHead><TableHead>Processing mode</TableHead><TableHead>Pay EMI ₹</TableHead><TableHead>Pay date</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {rows.map((r, i) => (
                <TableRow key={r.key}>
                  <TableCell><PartyPicker value={r.party} onChange={(p) => setRow(i, { party: p })} placeholder="Search name / mobile" ariaLabel={`Member ${i + 1}`} /></TableCell>
                  <TableCell><Input className="w-32" aria-label={`Assign ID ${i + 1}`} value={r.assignId} onChange={(e) => setRow(i, { assignId: e.target.value })} /></TableCell>
                  <TableCell>
                    <Select value={r.mode} onValueChange={(v) => setRow(i, { mode: v as MemberRow['mode'] })}>
                      <SelectTrigger className="w-36" aria-label={`Mode ${i + 1}`}><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="ENROLL">Enroll only</SelectItem><SelectItem value="PAY">With EMI pay</SelectItem></SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell><Input className="w-28" type="number" aria-label={`Pay EMI ${i + 1}`} placeholder={emi} disabled={r.mode !== 'PAY'} value={r.payAmount} onChange={(e) => setRow(i, { payAmount: e.target.value })} /></TableCell>
                  <TableCell><Input className="w-40" type="date" aria-label={`Pay date ${i + 1}`} max={today()} disabled={r.mode !== 'PAY'} value={r.payDate} onChange={(e) => setRow(i, { payDate: e.target.value })} /></TableCell>
                  <TableCell className="text-sm">{results?.[i] ? (results[i]!.ok ? <span className="text-green-600 dark:text-green-500">✓ enrolled</span> : <span className="text-destructive">{results[i]!.error}</span>) : null}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" aria-label={`Repeat row ${i + 1}`} disabled={!r.party} onClick={() => repeatRow(i)}>Repeat</Button>
                      <Button variant="ghost" size="sm" aria-label="Remove member" disabled={rows.length === 1} onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}>✕</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={() => setRows((rs) => [...rs, blank()])}>+ Add member</Button>
          {dupIds && <span className="text-sm text-destructive">Assign IDs must be unique.</span>}
          {badPay && <span className="text-sm text-destructive">Enter the EMI amount for “With EMI pay” rows.</span>}
          <Button className="ml-auto" disabled={!valid || bulk.isPending} onClick={() => void submit().catch(() => {})}>
            {bulk.isPending ? 'Enrolling…' : `Enrol ${plural(filled.length, 'member')}`}
          </Button>
        </div>
      </section>
      <p className="text-xs text-muted-foreground">Each member is enrolled independently — if one fails (duplicate ID, group full), the rest still go through; failed rows stay listed to retry.</p>
    </div>
  )
}
