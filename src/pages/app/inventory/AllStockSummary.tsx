import { Banknote, Coins, Flame, HandCoins, History, Landmark, Medal, Wallet, type LucideIcon } from 'lucide-react'
import { useState, type ReactNode } from 'react'

import { MpinDialog } from '@/components/MpinDialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/lib/auth'
import { useAllStockSummary, useSetStock, useSetStockLogs } from '@/lib/inventoryQueries'
import type { SetStockCard } from '@/shared'

const inr = (s: string) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(s))
const grams = (s: string | undefined) => (s == null ? '—' : `${Number(s).toFixed(3)} g`)

const CARD_LABEL: Record<SetStockCard, string> = { SHOP_CASH: 'Shop cash', FINE_GOLD: 'Fine gold stock', FINE_SILVER: 'Fine silver stock', KACCHA_GOLD: 'Kacha gold', KACCHA_SILVER: 'Kacha silver' }

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
  const setStock = useSetStock()
  const [value, setValue] = useState('')
  const [remarks, setRemarks] = useState('')
  const [askMpin, setAskMpin] = useState(false)
  const isCash = card === 'SHOP_CASH'
  const valid = value.trim() !== '' && Number.isFinite(Number(value)) && Number(value) >= 0
  if (askMpin) {
    return <MpinDialog open title={`Set ${CARD_LABEL[card].toLowerCase()}`} onConfirm={(mpin) => setStock.mutateAsync({ card, newBalance: Number(value), remarks: remarks.trim() || undefined, mpin })} onClose={onClose} />
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Set {CARD_LABEL[card].toLowerCase()}</DialogTitle>
          <DialogDescription>Now {isCash ? inr(current) : grams(current)} at the selected branch. The difference is posted to the ledger as a Set Stock entry.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="set-stock-value">New balance {isCash ? '(₹)' : '(fine g)'}</Label>
            <Input id="set-stock-value" type="number" min={0} step={isCash ? '0.01' : '0.001'} autoFocus value={value} onChange={(e) => setValue(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="set-stock-remarks">Remarks</Label>
            <Input id="set-stock-remarks" maxLength={300} placeholder="Optional" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button disabled={!valid} onClick={() => setAskMpin(true)}>Continue</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function SetStockLogDialog({ onClose }: { onClose: () => void }) {
  const [page, setPage] = useState(1)
  const { data, isLoading } = useSetStockLogs({ page, pageSize: 20 })
  const fmt = (card: SetStockCard, v: string) => (card === 'SHOP_CASH' ? inr(v) : grams(v))
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Set stock activity log</DialogTitle>
          <DialogDescription>Every balance set by hand, newest first.</DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : data && data.items.length > 0 ? (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-muted-foreground">
                <tr><th className="p-2">When</th><th className="p-2">Balance</th><th className="p-2">Branch</th><th className="p-2 text-right">Old</th><th className="p-2 text-right">New</th><th className="p-2 text-right">Change</th><th className="p-2">Remarks</th><th className="p-2">By</th></tr>
              </thead>
              <tbody>
                {data.items.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="whitespace-nowrap p-2">{new Date(r.createdAt).toLocaleString('en-IN')}</td>
                    <td className="p-2">{CARD_LABEL[r.card]}</td>
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
            <p className="text-sm text-muted-foreground">No balances have been set yet.</p>
          </div>
        )}
        {data && data.total > data.pageSize && (
          <div className="flex items-center justify-end gap-2 text-sm">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page * data.pageSize >= data.total} onClick={() => setPage(page + 1)}>Next</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

/** Stock and money balances across the shop from one server roll-up; owners can set a balance by hand (MPIN). */
export function AllStockSummary() {
  const { can } = useAuth()
  const canSet = can('inventory.all_stock', 'edit')
  const { data } = useAllStockSummary()
  const [setting, setSetting] = useState<{ card: SetStockCard; current: string } | null>(null)
  const [showLog, setShowLog] = useState(false)
  const setBtn = (card: SetStockCard, current: string | undefined) =>
    canSet && current != null ? (
      <Button size="sm" variant="outline" aria-label={`Set ${CARD_LABEL[card].toLowerCase()}`} onClick={() => setSetting({ card, current })}>Set stock</Button>
    ) : undefined
  const rates = data && [data.goldRatePerGram && `gold ₹${data.goldRatePerGram}/g`, data.silverRatePerGram && `silver ₹${data.silverRatePerGram}/g`].filter(Boolean).join(', ')

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Stock and money balances across the shop. Set stock applies to the selected branch.</p>
        <Button variant="outline" size="sm" onClick={() => setShowLog(true)}>
          <History className="size-4" aria-hidden />
          Set stock activity log
        </Button>
      </div>
      <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Fine gold stock" value={grams(data?.fineGold)} sub="Stock, bullion and loose fine gold" Icon={Coins} action={setBtn('FINE_GOLD', data?.fineGold)} />
        <Tile label="Fine silver stock" value={grams(data?.fineSilver)} sub="Stock, bullion and loose fine silver" Icon={Medal} action={setBtn('FINE_SILVER', data?.fineSilver)} />
        <Tile label="Kacha gold" value={grams(data?.kacchaGold)} sub="Old gold waiting to be melted" Icon={Flame} action={setBtn('KACCHA_GOLD', data?.kacchaGold)} />
        <Tile label="Kacha silver" value={grams(data?.kacchaSilver)} sub="Old silver waiting to be melted" Icon={Flame} action={setBtn('KACCHA_SILVER', data?.kacchaSilver)} />
        <Tile
          label="Girvi loans open"
          value={data ? String(data.girvi.activeCount) : '—'}
          sub={data ? `Loan ${inr(data.girvi.principal)} · Gold ${grams(data.girvi.gold)} · Silver ${grams(data.girvi.silver)}` : undefined}
          Icon={Landmark}
        />
        <Tile label="Udhar to receive" value={data ? inr(data.udhari.amount) : '—'} sub="Money customers owe you" Icon={HandCoins} />
        <Tile label="Udhar gold" value={grams(data?.udhari.gold)} sub="Fine gold customers owe you" Icon={Coins} />
        <Tile label="Udhar silver" value={grams(data?.udhari.silver)} sub="Fine silver customers owe you" Icon={Medal} />
        <Tile label="Shop cash" value={data ? inr(data.shopCash) : '—'} sub={data ? `Bank ${inr(data.bank)}` : undefined} Icon={Wallet} action={setBtn('SHOP_CASH', data?.shopCash)} />
        <Tile
          label="Total amount"
          value={data ? inr(data.totalAmount) : '—'}
          sub={data ? `Metal at today's rate (${rates || 'no rate set'}) + cash, bank, udhar and girvi loans` : undefined}
          Icon={Banknote}
        />
      </div>
      {setting && <SetStockDialog card={setting.card} current={setting.current} onClose={() => setSetting(null)} />}
      {showLog && <SetStockLogDialog onClose={() => setShowLog(false)} />}
    </div>
  )
}
