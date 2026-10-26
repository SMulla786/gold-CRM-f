import { businessDayISO } from '@/shared'
import { Coins, Gem, Lock, LockOpen, Scale, Sparkles, Store, Wallet, type LucideIcon } from 'lucide-react'
import { useState } from 'react'

import { KpiTile } from '@/components/KpiTile'
import { MpinDialog } from '@/components/MpinDialog'
import { SectionCard } from '@/components/SectionCard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useCloseDay, useDayBook, useOpenDay } from '@/lib/accountsQueries'
import { useAuth } from '@/lib/auth'

const today = businessDayISO
const unit = (asset: string) => (asset === 'MONEY' ? '₹' : asset === 'GOLD' || asset === 'SILVER' ? 'g' : 'pcs')
const ASSET_ICON: Record<string, LucideIcon> = { MONEY: Wallet, GOLD: Coins, SILVER: Coins, STONE: Gem, ARTIFICIAL: Sparkles, FRANCHISE: Store }

export function DayBookSummary() {
  const { can } = useAuth()
  const canManageDay = can('daybook.all_in_one', 'edit')
  const [from, setFrom] = useState(today())
  const [to, setTo] = useState(today())
  const { data, isLoading } = useDayBook({ from, to })
  const openDay = useOpenDay()
  const closeDay = useCloseDay()
  const [confirm, setConfirm] = useState<'open' | 'close' | null>(null)
  const singleDay = from === to // status + open/close only make sense for one day

  return (
    <div className="space-y-6">
      {/* Filters stay outside the loading branch (daybook-close fills #db-from/#db-to before data arrives). */}
      <Card className="flex flex-wrap items-end gap-4 p-4">
        <div className="space-y-1.5">
          <Label htmlFor="db-from">From</Label>
          <Input id="db-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="db-to">To</Label>
          <Input id="db-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        {singleDay && data?.status && (
          <div className="ml-auto flex items-center gap-3">
            <Badge variant={data.status === 'OPEN' ? 'default' : 'destructive'}>{data.status}</Badge>
            {canManageDay && (data.status === 'OPEN'
              ? <Button onClick={() => setConfirm('close')}><Lock aria-hidden />Close day</Button>
              : <Button variant="outline" onClick={() => setConfirm('open')}><LockOpen aria-hidden />Reopen day</Button>)}
          </div>
        )}
      </Card>

      <MpinDialog
        open={!!confirm}
        title={confirm === 'close' ? `Close ${from}` : `Reopen ${from}`}
        onConfirm={(mpin) => (confirm === 'close' ? closeDay : openDay).mutateAsync({ date: from, mpin })}
        onClose={() => setConfirm(null)}
      />

      {isLoading || !data ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>
          <Skeleton className="h-40 rounded-3xl" /><Skeleton className="h-40 rounded-3xl" />
        </div>
      ) : (
        <>
          {data.totals.length > 0 && (
            <div className="stagger grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
              {data.totals.map((t) => (
                <KpiTile key={t.asset} size="sm" label={t.asset} value={`${t.closing} ${unit(t.asset)}`} sub={`₹${t.value}`}
                  icon={ASSET_ICON[t.asset] ?? Scale} tone={t.asset === 'MONEY' || t.asset === 'GOLD' ? 'gold' : 'slate'} />
              ))}
            </div>
          )}

          <SectionCard title="Totals">
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
          </SectionCard>

          <SectionCard title="By source">
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
          </SectionCard>
        </>
      )}
    </div>
  )
}
