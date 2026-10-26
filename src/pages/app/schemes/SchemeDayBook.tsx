import { businessDayISO } from '@/shared'
import { Inbox, ListOrdered, Scale, Undo2, Users, type LucideIcon } from 'lucide-react'
import { useState } from 'react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useSchemeDayBook } from '@/lib/schemesQueries'

const inr = (s: string) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(s))
const date = (s: string) => new Date(s).toLocaleDateString('en-IN')
const today = businessDayISO

export function SchemeDayBook() {
  const [from, setFrom] = useState(today())
  const [to, setTo] = useState(today())
  const { data, isLoading } = useSchemeDayBook({ from, to })

  // Summary numbers derived from the day-book already fetched (no extra requests).
  const rows = data?.rows ?? []
  const reversedCount = rows.filter((r) => r.isReversed).length
  const partyCount = new Set(rows.map((r) => r.party.id)).size
  const inNum = data ? Number(data.moneyIn) : 0
  const outNum = data ? Number(data.moneyOut) : 0
  const flowTotal = inNum + outNum || 1

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
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 pt-6">
          <div className="space-y-1.5"><Label htmlFor="db-from">From</Label><Input id="db-from" className="w-40" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="db-to">To</Label><Input id="db-to" className="w-40" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        </CardContent>
      </Card>

      <div className="hero-card space-y-6 p-6">
        <div>
          <h2 className="text-xl">Scheme cash position</h2>
          {data && <p className="mt-1 text-sm text-white/70">{date(data.from)} – {date(data.to)}</p>}
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-white/60">Opening</p>
            <p className="text-3xl font-extrabold tabular-nums">{data ? inr(data.opening) : '—'}</p>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-white/60">Money in</p>
            <p className="text-3xl font-extrabold tabular-nums text-green-400">{data ? inr(data.moneyIn) : '—'}</p>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-white/60">Money out</p>
            <p className="text-3xl font-extrabold tabular-nums text-red-400">{data ? inr(data.moneyOut) : '—'}</p>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-white/60">Closing</p>
            <p className="text-3xl font-extrabold tabular-nums">{data ? inr(data.closing) : '—'}</p>
          </div>
        </div>
        {data && (
          <div className="space-y-3">
            {[
              { key: 'in', label: 'Inflow share', v: inNum, bar: 'from-brand-strong to-brand' },
              { key: 'out', label: 'Outflow share', v: outNum, bar: 'from-white/70 to-white/30' },
            ].map((m) => (
              <div key={m.key} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-white/60">
                  <span className="font-semibold uppercase tracking-widest">{m.label}</span>
                  <span className="tabular-nums">{Math.round((m.v / flowTotal) * 100)}%</span>
                </div>
                <div className="h-3 rounded-full bg-white/10 shadow-[inset_0_2px_4px_rgb(0_0_0/0.3)]">
                  <div className={`bar-grow h-3 rounded-full bg-gradient-to-r ${m.bar} shadow-[0_0_10px_rgb(212_175_55/0.5)]`} style={{ width: `${Math.max(4, (m.v / flowTotal) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tile('Entries', data ? String(rows.length) : '—', 'In the selected range', ListOrdered)}
        {tile('Net change', data ? inr(String(inNum - outNum)) : '—', 'Inflow less outflow', Scale)}
        {tile('Parties', data ? String(partyCount) : '—', 'Distinct parties with movement', Users)}
        {tile('Reversed', data ? String(reversedCount) : '—', 'Shown struck through below', Undo2)}
      </div>

      <section className="space-y-3">
        <h2 className="text-xl">Movements</h2>
        <Card className="overflow-x-auto p-2">
          <Table>
            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Assign</TableHead><TableHead>Member</TableHead><TableHead>Scheme</TableHead><TableHead>Amount</TableHead><TableHead>Via</TableHead></TableRow></TableHeader>
            <TableBody>
              {isLoading ? <TableRow><TableCell colSpan={6} className="h-16 text-center text-muted-foreground">Loading…</TableCell></TableRow>
                : data?.rows.length ? data.rows.map((r) => (
                  <TableRow key={r.id} className={r.isReversed ? 'text-muted-foreground line-through' : ''}>
                    <TableCell>{date(r.txnDate)}</TableCell><TableCell className="font-medium">{r.assignId}</TableCell>
                    <TableCell>{r.party.name}</TableCell><TableCell>{r.scheme.name}</TableCell>
                    <TableCell className="tabular-nums">{inr(r.amount)}</TableCell><TableCell>{r.medium}</TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <span className="icon-chip"><Inbox className="size-5" aria-hidden /></span>
                        <span>No scheme money moved in this range</span>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
            </TableBody>
          </Table>
        </Card>
      </section>
    </div>
  )
}
