import { Banknote, Coins, Flame, HandCoins, History, Landmark, Medal, Wallet, type LucideIcon } from 'lucide-react'
import { useState, type ReactNode } from 'react'

import { MpinDialog } from '@/components/MpinDialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/lib/auth'
import { useT } from '@/lib/i18n'
import { useAllStockSummary, useSetStock, useSetStockLogs } from '@/lib/inventoryQueries'
import type { SetStockCard } from '@/shared'

const inr = (s: string) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(s))
const grams = (s: string | undefined) => (s == null ? '—' : `${Number(s).toFixed(3)} g`)

// i18n keys, translated at render.
const CARD_LABEL: Record<SetStockCard, string> = { SHOP_CASH: 'daybook.shop_cash', FINE_GOLD: 'inv.summary.fine_gold', FINE_SILVER: 'inv.summary.fine_silver', KACCHA_GOLD: 'inv.summary.kaccha_gold', KACCHA_SILVER: 'inv.summary.kaccha_silver' }
// aria-labels stay English.
const CARD_ARIA: Record<SetStockCard, string> = { SHOP_CASH: 'shop cash', FINE_GOLD: 'fine gold stock', FINE_SILVER: 'fine silver stock', KACCHA_GOLD: 'kacha gold', KACCHA_SILVER: 'kacha silver' }

function Tile({ label, value, sub, Icon, action }: { label: string; value: string; sub?: string; Icon: LucideIcon; action?: ReactNode }) {
  return (
    <Card className="gap-2 hover:-translate-y-1">
      <CardHeader className="flex flex-row items-center justify-between pb-1">
        <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</CardTitle>
        <span className="icon-chip"><Icon className="size-5" aria-hidden /></span>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-extrabold tracking-tight tabular-nums">{value}</div>
        {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
        {action && <div className="mt-3">{action}</div>}
      </CardContent>
    </Card>
  )
}

/** Step 1: new balance + remarks; step 2: MPIN, which runs the save. */
function SetStockDialog({ card, current, onClose }: { card: SetStockCard; current: string; onClose: () => void }) {
  const t = useT()
  const setStock = useSetStock()
  const [value, setValue] = useState('')
  const [remarks, setRemarks] = useState('')
  const [askMpin, setAskMpin] = useState(false)
  const isCash = card === 'SHOP_CASH'
  const valid = value.trim() !== '' && Number.isFinite(Number(value)) && Number(value) >= 0
  if (askMpin) {
    return <MpinDialog open title={t('inv.summary.set_title', { name: t(CARD_LABEL[card]).toLowerCase() })} onConfirm={(mpin) => setStock.mutateAsync({ card, newBalance: Number(value), remarks: remarks.trim() || undefined, mpin })} onClose={onClose} />
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('inv.summary.set_title', { name: t(CARD_LABEL[card]).toLowerCase() })}</DialogTitle>
          <DialogDescription>{t('inv.summary.set_desc', { amt: isCash ? inr(current) : grams(current) })}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="set-stock-value">{isCash ? t('inv.summary.new_balance_cash') : t('inv.summary.new_balance_fine')}</Label>
            <Input id="set-stock-value" type="number" min={0} step={isCash ? '0.01' : '0.001'} autoFocus value={value} onChange={(e) => setValue(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="set-stock-remarks">{t('oldmetal.col_remarks')}</Label>
            <Input id="set-stock-remarks" maxLength={300} placeholder={t('inv.f.optional')} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button disabled={!valid} onClick={() => setAskMpin(true)}>{t('girvi.continue')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function SetStockLogDialog({ onClose }: { onClose: () => void }) {
  const t = useT()
  const [page, setPage] = useState(1)
  const { data, isLoading } = useSetStockLogs({ page, pageSize: 20 })
  const fmt = (card: SetStockCard, v: string) => (card === 'SHOP_CASH' ? inr(v) : grams(v))
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t('inv.summary.log_title')}</DialogTitle>
          <DialogDescription>{t('inv.summary.log_desc')}</DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
        ) : data && data.items.length > 0 ? (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-muted-foreground">
                <tr><th className="p-2">{t('dash.when')}</th><th className="p-2">{t('bill.balance')}</th><th className="p-2">{t('stock.col_branch')}</th><th className="p-2 text-right">{t('udhari.col_old')}</th><th className="p-2 text-right">{t('udhari.new_entry')}</th><th className="p-2 text-right">{t('inv.summary.col_change')}</th><th className="p-2">{t('oldmetal.col_remarks')}</th><th className="p-2">{t('dash.col_by')}</th></tr>
              </thead>
              <tbody>
                {data.items.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="whitespace-nowrap p-2">{new Date(r.createdAt).toLocaleString('en-IN')}</td>
                    <td className="p-2">{t(CARD_LABEL[r.card])}</td>
                    <td className="p-2">{r.branch.name}</td>
                    <td className="p-2 text-right tabular-nums">{fmt(r.card, r.oldBalance)}</td>
                    <td className="p-2 text-right tabular-nums">{fmt(r.card, r.newBalance)}</td>
                    <td className="p-2 text-right tabular-nums">{fmt(r.card, r.difference)}</td>
                    <td className="p-2">{r.remarks ?? '—'}</td>
                    <td className="p-2">{r.user ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <span className="icon-chip"><History className="size-5" aria-hidden /></span>
            <p className="text-sm text-muted-foreground">{t('inv.summary.log_empty')}</p>
          </div>
        )}
        {data && data.total > data.pageSize && (
          <div className="flex items-center justify-end gap-2 text-sm">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>{t('table.previous')}</Button>
            <Button variant="outline" size="sm" disabled={page * data.pageSize >= data.total} onClick={() => setPage(page + 1)}>{t('table.next')}</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

/** Stock and money balances across the shop from one server roll-up; owners can set a balance by hand (MPIN). */
export function AllStockSummary() {
  const t = useT()
  const { can } = useAuth()
  const canSet = can('inventory.all_stock', 'edit')
  const { data } = useAllStockSummary()
  const [setting, setSetting] = useState<{ card: SetStockCard; current: string } | null>(null)
  const [showLog, setShowLog] = useState(false)
  const setBtn = (card: SetStockCard, current: string | undefined) =>
    canSet && current != null ? (
      <Button size="sm" variant="outline" aria-label={`Set ${CARD_ARIA[card]}`} onClick={() => setSetting({ card, current })}>{t('src.SET_STOCK')}</Button>
    ) : undefined
  const rates = data && [data.goldRatePerGram && t('inv.summary.rate_gold', { r: data.goldRatePerGram }), data.silverRatePerGram && t('inv.summary.rate_silver', { r: data.silverRatePerGram })].filter(Boolean).join(', ')

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{t('inv.summary.intro')}</p>
        <Button variant="outline" size="sm" onClick={() => setShowLog(true)}>
          <History className="size-4" aria-hidden />
          {t('inv.summary.log_title')}
        </Button>
      </div>
      <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label={t('inv.summary.fine_gold')} value={grams(data?.fineGold)} sub={t('inv.summary.fine_gold_sub')} Icon={Coins} action={setBtn('FINE_GOLD', data?.fineGold)} />
        <Tile label={t('inv.summary.fine_silver')} value={grams(data?.fineSilver)} sub={t('inv.summary.fine_silver_sub')} Icon={Medal} action={setBtn('FINE_SILVER', data?.fineSilver)} />
        <Tile label={t('inv.summary.kaccha_gold')} value={grams(data?.kacchaGold)} sub={t('inv.summary.kaccha_gold_sub')} Icon={Flame} action={setBtn('KACCHA_GOLD', data?.kacchaGold)} />
        <Tile label={t('inv.summary.kaccha_silver')} value={grams(data?.kacchaSilver)} sub={t('inv.summary.kaccha_silver_sub')} Icon={Flame} action={setBtn('KACCHA_SILVER', data?.kacchaSilver)} />
        <Tile
          label={t('inv.summary.girvi')}
          value={data ? String(data.girvi.activeCount) : '—'}
          sub={data ? t('inv.summary.girvi_sub', { loan: inr(data.girvi.principal), gold: grams(data.girvi.gold), silver: grams(data.girvi.silver) }) : undefined}
          Icon={Landmark}
        />
        <Tile label={t('inv.summary.udhar_amount')} value={data ? inr(data.udhari.amount) : '—'} sub={t('inv.summary.udhar_amount_sub')} Icon={HandCoins} />
        <Tile label={t('inv.summary.udhar_gold')} value={grams(data?.udhari.gold)} sub={t('inv.summary.udhar_gold_sub')} Icon={Coins} />
        <Tile label={t('inv.summary.udhar_silver')} value={grams(data?.udhari.silver)} sub={t('inv.summary.udhar_silver_sub')} Icon={Medal} />
        <Tile label={t('daybook.shop_cash')} value={data ? inr(data.shopCash) : '—'} sub={data ? t('dash.bank', { amt: inr(data.bank) }) : undefined} Icon={Wallet} action={setBtn('SHOP_CASH', data?.shopCash)} />
        <Tile
          label={t('inv.summary.total_amount')}
          value={data ? inr(data.totalAmount) : '—'}
          sub={data ? t('inv.summary.total_amount_sub', { rates: rates || t('inv.summary.no_rate') }) : undefined}
          Icon={Banknote}
        />
      </div>
      {setting && <SetStockDialog card={setting.card} current={setting.current} onClose={() => setSetting(null)} />}
      {showLog && <SetStockLogDialog onClose={() => setShowLog(false)} />}
    </div>
  )
}
