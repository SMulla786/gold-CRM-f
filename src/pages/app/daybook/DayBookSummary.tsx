import { businessDayISO } from '@/shared'
import { Coins, Gem, Lock, LockOpen, Scale, Sparkles, Store, Wallet, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

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
import { useSettings } from '@/lib/appQueries'
import { useAuth } from '@/lib/auth'
import { useT } from '@/lib/i18n'
import { sourceLabel } from '@/lib/sourceLinks'

import { dayBookPrefs, shownAssets } from './dayBookPrefs'

const today = businessDayISO
const unit = (asset: string) => (asset === 'MONEY' ? '₹' : asset === 'GOLD' || asset === 'SILVER' ? 'g' : 'pcs')
const DAYS_PER_PAGE = 10
const ASSET_ICON: Record<string, LucideIcon> = { MONEY: Wallet, GOLD: Coins, SILVER: Coins, STONE: Gem, ARTIFICIAL: Sparkles, FRANCHISE: Store }

export function DayBookSummary() {
  const { can } = useAuth()
  const t = useT()
  const canManageDay = can('daybook.all_in_one', 'edit')
  const [from, setFromRaw] = useState(today())
  const [to, setToRaw] = useState(today())
  const [dayPage, setDayPage] = useState(1) // client-side paging of the day-wise list
  const setFrom = (v: string) => { setFromRaw(v); setDayPage(1) }
  const setTo = (v: string) => { setToRaw(v); setDayPage(1) }
  const singleDay = from === to // status + open/close only make sense for one day
  const { data, isLoading } = useDayBook({ from, to, groupBy: singleDay ? undefined : 'DATE' })
  const openDay = useOpenDay()
  const closeDay = useCloseDay()
  const [confirm, setConfirm] = useState<'open' | 'close' | null>(null)
  // SET-08: only the asset groups chosen in Day Book Settings
  const shown = new Set<string>(shownAssets(dayBookPrefs(useSettings().data)))
  const show = (r: { asset: string }) => shown.has(r.asset)

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
          {data.totals.some(show) && (
            <div className="stagger grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
              {data.totals.filter(show).map((r) => (
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
                  {data.totals.filter(show).map((r) => (
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

          {!!data.days?.length && (
            <SectionCard title={t('daybook.by_date')}>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('db98.sn')}</TableHead>
                      <TableHead>{t('daybook.col_date')}</TableHead>
                      <TableHead>{t('daybook.col_status')}</TableHead>
                      {data.days[0]!.totals.filter(show).map((a) => <TableHead key={a.asset} className="text-right whitespace-nowrap">{a.asset}</TableHead>)}
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.days.slice((dayPage - 1) * DAYS_PER_PAGE, dayPage * DAYS_PER_PAGE).map((d, i) => (
                      <TableRow key={d.date}>
                        <TableCell className="text-muted-foreground tabular-nums">{(dayPage - 1) * DAYS_PER_PAGE + i + 1}</TableCell>
                        <TableCell className="whitespace-nowrap font-medium">{new Date(d.date).toLocaleDateString('en-IN')}</TableCell>
                        <TableCell>{d.status ? <Badge variant={d.status === 'OPEN' ? 'secondary' : 'destructive'}>{d.status}</Badge> : '—'}</TableCell>
                        {/* opening → closing per asset; in/out on hover */}
                        {d.totals.filter(show).map((a) => (
                          <TableCell key={a.asset} className="text-right whitespace-nowrap tabular-nums" title={`+${a.in} / −${a.out}`}>
                            <span className="text-muted-foreground">{a.opening}</span> → <span className="font-medium">{a.closing}</span>
                          </TableCell>
                        ))}
                        <TableCell className="whitespace-nowrap">
                          <Button variant="ghost" size="sm" onClick={() => { setFrom(d.date); setTo(d.date) }}>{t('daybook.open_day')}</Button>
                          <Button asChild variant="ghost" size="sm"><Link to={`/app/daybook/all-in-one?from=${d.date}&to=${d.date}`}>{t('db98.view_all_in_one')}</Link></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {data.days.length > DAYS_PER_PAGE && (
                <div className="flex items-center justify-end gap-2 border-t px-6 py-3 text-sm">
                  <span className="text-muted-foreground">{t('table.page_of', { page: dayPage, pages: Math.ceil(data.days.length / DAYS_PER_PAGE), total: data.days.length })}</span>
                  <Button variant="outline" size="sm" disabled={dayPage <= 1} onClick={() => setDayPage((p) => p - 1)}>{t('table.previous')}</Button>
                  <Button variant="outline" size="sm" disabled={dayPage * DAYS_PER_PAGE >= data.days.length} onClick={() => setDayPage((p) => p + 1)}>{t('table.next')}</Button>
                </div>
              )}
            </SectionCard>
          )}

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
                  {data.bySource.some(show) ? (
                    data.bySource.filter(show).map((s, i) => (
                      <TableRow key={i}>
                        <TableCell>{sourceLabel(t, s.source)}</TableCell>
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
