import { useState } from 'react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useSchemeDayBook } from '@/lib/schemesQueries'

const inr = (s: string) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(s))
const date = (s: string) => new Date(s).toLocaleDateString('en-IN')
const today = () => new Date().toISOString().slice(0, 10)

export function SchemeDayBook() {
  const [from, setFrom] = useState(today())
  const [to, setTo] = useState(today())
  const { data, isLoading } = useSchemeDayBook({ from, to })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5"><Label htmlFor="db-from">From</Label><Input id="db-from" className="w-40" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div className="space-y-1.5"><Label htmlFor="db-to">To</Label><Input id="db-to" className="w-40" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card><CardHeader className="pb-1"><CardTitle className="text-sm font-medium text-muted-foreground">Opening</CardTitle></CardHeader><CardContent className="text-lg font-semibold tabular-nums">{data ? inr(data.opening) : '—'}</CardContent></Card>
        <Card><CardHeader className="pb-1"><CardTitle className="text-sm font-medium text-muted-foreground">Money in</CardTitle></CardHeader><CardContent className="text-lg font-semibold tabular-nums text-green-600">{data ? inr(data.moneyIn) : '—'}</CardContent></Card>
        <Card><CardHeader className="pb-1"><CardTitle className="text-sm font-medium text-muted-foreground">Money out</CardTitle></CardHeader><CardContent className="text-lg font-semibold tabular-nums text-red-600">{data ? inr(data.moneyOut) : '—'}</CardContent></Card>
        <Card><CardHeader className="pb-1"><CardTitle className="text-sm font-medium text-muted-foreground">Closing</CardTitle></CardHeader><CardContent className="text-lg font-semibold tabular-nums">{data ? inr(data.closing) : '—'}</CardContent></Card>
      </div>

      <div className="overflow-x-auto rounded-md border">
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
              )) : <TableRow><TableCell colSpan={6} className="h-16 text-center text-muted-foreground">No scheme money moved in this range</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
