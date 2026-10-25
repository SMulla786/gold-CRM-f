import { useState } from 'react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useDayBook } from '@/lib/accountsQueries'

const today = () => new Date().toISOString().slice(0, 10)
const unit = (asset: string) => (asset === 'MONEY' ? '₹' : asset === 'GOLD' || asset === 'SILVER' ? 'g' : 'pcs')

export function DayBookSummary() {
  const [from, setFrom] = useState(today())
  const [to, setTo] = useState(today())
  const { data, isLoading } = useDayBook({ from, to })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="db-from">From</Label>
          <Input id="db-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="db-to">To</Label>
          <Input id="db-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      {isLoading || !data ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Totals</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Asset</TableHead>
                    <TableHead>Opening</TableHead>
                    <TableHead>In</TableHead>
                    <TableHead>Out</TableHead>
                    <TableHead>Closing</TableHead>
                    <TableHead>Value ₹</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.totals.map((t) => (
                    <TableRow key={t.asset}>
                      <TableCell className="font-medium">{t.asset}</TableCell>
                      <TableCell>{t.opening} {unit(t.asset)}</TableCell>
                      <TableCell className="text-green-600 dark:text-green-500">{t.in}</TableCell>
                      <TableCell className="text-destructive">{t.out}</TableCell>
                      <TableCell className="font-medium">{t.closing} {unit(t.asset)}</TableCell>
                      <TableCell>{t.value}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>By source</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Source</TableHead>
                    <TableHead>Asset</TableHead>
                    <TableHead>In</TableHead>
                    <TableHead>Out</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.bySource.length ? (
                    data.bySource.map((s, i) => (
                      <TableRow key={i}>
                        <TableCell>{s.source}</TableCell>
                        <TableCell>{s.asset}</TableCell>
                        <TableCell className="text-green-600 dark:text-green-500">{s.in}</TableCell>
                        <TableCell className="text-destructive">{s.out}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow><TableCell colSpan={4} className="h-16 text-center text-muted-foreground">No activity</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
