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
import { useT } from '@/lib/i18n'

const today = businessDayISO
const unit = (asset: string) => (asset === 'MONEY' ? '₹' : asset === 'GOLD' || asset === 'SILVER' ? 'g' : 'pcs')
const ASSET_ICON: Record<string, LucideIcon> = { MONEY: Wallet, GOLD: Coins, SILVER: Coins, STONE: Gem, ARTIFICIAL: Sparkles, FRANCHISE: Store }

export function DayBookSummary() {
  const { can } = useAuth()
  const t = useT()
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
          <Label htmlFor="db-from">{t('common.from')}</Label>
          <Input id="db-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="db-to">{t('common.to')}</Label>
          <Input id="db-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        {singleDay && data?.status && (
          <div className="ml-auto flex items-center gap-3">
            <Badge variant={data.status === 'OPEN' ? 'default' : 'destructive'}>{data.status}</Badge>
            {canManageDay && (data.status === 'OPEN'
              ? <Button onClick={() => setConfirm('close')}><Lock aria-hidden />{t('daybook.close_day')}</Button>
              : <Button variant="outline" onClick={() => setConfirm('open')}><LockOpen aria-hidden />{t('daybook.reopen_day')}</Button>)}
          </div>
        )}
      </Card>

      <MpinDialog
        open={!!confirm}
        title={confirm === 'close' ? t('daybook.close_title', { date: from }) : t('daybook.reopen_title', { date: from })}
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
              {data.totals.map((r) => (
                <KpiTile key={r.asset} size="sm" label={r.asset} value={`${r.closing} ${unit(r.asset)}`} sub={`₹${r.value}`}
                  icon={ASSET_ICON[r.asset] ?? Scale} tone={r.asset === 'MONEY' || r.asset === 'GOLD' ? 'gold' : 'slate'} />
              ))}
            </div>
          )}

          <SectionCard title={t('daybook.totals')}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('daybook.col_asset')}</TableHead>
                    <TableHead>{t('daybook.col_opening')}</TableHead>
                    <TableHead>{t('daybook.col_in')}</TableHead>
                    <TableHead>{t('daybook.col_out')}</TableHead>
                    <TableHead>{t('daybook.col_closing')}</TableHead>
                    <TableHead>{t('daybook.col_value')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.totals.map((r) => (
                    <TableRow key={r.asset}>
                      <TableCell className="font-medium">{r.asset}</TableCell>
                      <TableCell>{r.opening} {unit(r.asset)}</TableCell>
                      <TableCell className="text-green-600 dark:text-green-500">{r.in}</TableCell>
                      <TableCell className="text-destructive">{r.out}</TableCell>
                      <TableCell className="font-medium">{r.closing} {unit(r.asset)}</TableCell>
                      <TableCell>{r.value}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
          </SectionCard>

          <SectionCard title={t('daybook.by_source')}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('daybook.col_source')}</TableHead>
                    <TableHead>{t('daybook.col_asset')}</TableHead>
                    <TableHead>{t('daybook.col_in')}</TableHead>
                    <TableHead>{t('daybook.col_out')}</TableHead>
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
                    <TableRow><TableCell colSpan={4} className="h-16 text-center text-muted-foreground">{t('dash.no_activity')}</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
          </SectionCard>
        </>
      )}
    </div>
  )
}
