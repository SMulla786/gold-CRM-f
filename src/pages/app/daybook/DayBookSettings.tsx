import { useState } from 'react'

import { MpinDialog } from '@/components/MpinDialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useSaveSetting, useSettings } from '@/lib/appQueries'
import { useAuth } from '@/lib/auth'
import { useT } from '@/lib/i18n'
import { sourceLabel } from '@/lib/sourceLinks'
import { DAYBOOK_PAGE_SIZES, LEDGER_ASSETS, LEDGER_SOURCES } from '@/shared'

import { dayBookPrefs, type DayBookPrefs } from './dayBookPrefs'

const assetLabelKey = (a: string) => (a === 'MONEY' ? 'daybook.tab_money' : `class.${a}`)

/** SET-08: Day Book Settings (`daybook.prefs`) — presentation only, saved business-wide with MPIN like the other settings pages. */
export function DayBookSettings() {
  const t = useT()
  const { can } = useAuth()
  const { data: settings } = useSettings()
  const save = useSaveSetting()
  const [v, setV] = useState<DayBookPrefs | null>(null)
  const [mpinOpen, setMpinOpen] = useState(false)

  if (!settings) return <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
  const cur = v ?? dayBookPrefs(settings)
  const set = <K extends keyof DayBookPrefs>(k: K, val: DayBookPrefs[K]) => setV({ ...cur, [k]: val })
  const canEdit = can('settings.misc', 'edit')
  const toggleAsset = (a: DayBookPrefs['assets'][number], on: boolean) =>
    set('assets', LEDGER_ASSETS.filter((x) => (x === a ? on : cur.assets.includes(x))))

  return (
    <div className="max-w-3xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('daybook.settings.assets')}</CardTitle>
          <CardDescription>{t('daybook.settings.assets_desc')}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-3">
          {LEDGER_ASSETS.map((a) => (
            <label key={a} className="flex items-center gap-2 text-sm">
              {/* at least one asset stays on, or the day book has no columns */}
              <Checkbox checked={cur.assets.includes(a)} disabled={!canEdit || (cur.assets.length === 1 && cur.assets.includes(a))} onCheckedChange={(c) => toggleAsset(a, c === true)} />
              {t(assetLabelKey(a))}
            </label>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('daybook.tab_all_in_one')}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>{t('daybook.settings.default_source')}</Label>
            <Select value={cur.defaultSource ?? 'all'} disabled={!canEdit} onValueChange={(nv) => set('defaultSource', nv === 'all' ? null : (nv as DayBookPrefs['defaultSource']))}>
              <SelectTrigger aria-label={t('daybook.settings.default_source')}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('daybook.all_sources')}</SelectItem>
                {LEDGER_SOURCES.map((s) => <SelectItem key={s} value={s}>{sourceLabel(t, s)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t('daybook.settings.page_size')}</Label>
            <Select value={String(cur.pageSize)} disabled={!canEdit} onValueChange={(nv) => set('pageSize', Number(nv) as DayBookPrefs['pageSize'])}>
              <SelectTrigger aria-label={t('daybook.settings.page_size')}><SelectValue /></SelectTrigger>
              <SelectContent>{DAYBOOK_PAGE_SIZES.map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <Checkbox checked={cur.showRunningBalance} disabled={!canEdit} onCheckedChange={(c) => set('showRunningBalance', c === true)} />
            {t('daybook.settings.running_balance')}
          </label>
        </CardContent>
      </Card>

      {canEdit && (
        <div className="flex justify-end">
          <Button size="sm" disabled={!v} onClick={() => setMpinOpen(true)}>{t('daybook.settings.save')}</Button>
        </div>
      )}
      <MpinDialog
        open={mpinOpen}
        title={t('daybook.settings.save_title')}
        onConfirm={async (mpin) => { await save.mutateAsync({ key: 'daybook.prefs', value: cur, mpin }); setV(null); setMpinOpen(false) }}
        onClose={() => setMpinOpen(false)}
      />
    </div>
  )
}
