import { Banknote, CircleSlash, Coins, Flame, HandCoins, Landmark, Medal, Wallet, type LucideIcon } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/lib/auth'
import { useGirviList } from '@/lib/girviQueries'
import { useStockSummary } from '@/lib/inventoryQueries'
import { useDashboard } from '@/lib/reportsQueries'
import { useKachaBalance } from '@/lib/tradeQueries'

const inr = (s: string) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(s))
const grams = (s: string | undefined) => (s == null ? '—' : `${Number(s).toFixed(3)} g`)

function Tile({ label, value, sub, Icon }: { label: string; value: string; sub?: string; Icon: LucideIcon }) {
  return (
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
}

const Unavailable = ({ label, why }: { label: string; why: string }) => <Tile label={label} value="—" sub={why} Icon={CircleSlash} />

// Each card owning its hook lets us skip the request entirely when the user lacks that module's permission.
function FineStockTiles() {
  const { data } = useStockSummary()
  const fine = (c: string) => (data ? grams(data.find((s) => s.stockClass === c)?.fine ?? '0') : '—')
  return (
    <>
      <Tile label="Fine gold stock" value={fine('GOLD')} sub="Available stock, all branches you can see" Icon={Coins} />
      <Tile label="Fine silver stock" value={fine('SILVER')} sub="Available stock, all branches you can see" Icon={Medal} />
    </>
  )
}

function KachaTile({ metal }: { metal: 'GOLD' | 'SILVER' }) {
  const { data } = useKachaBalance(metal)
  return <Tile label={metal === 'GOLD' ? 'Kacha gold' : 'Kacha silver'} value={grams(data?.kachaFine)} sub={data ? `Bullion ${grams(data.bullionFine)}` : undefined} Icon={Flame} />
}

function GirviTile() {
  const { data } = useGirviList({ status: 'ACTIVE', pageSize: 1 })
  return <Tile label="Girvi loans open" value={data ? String(data.total) : '—'} sub="Loan amount total is not available yet" Icon={Landmark} />
}

function DashboardTiles() {
  const { data } = useDashboard()
  return (
    <>
      <Tile label="Udhar to receive" value={data ? inr(data.udhari.amount) : '—'} sub="Money customers owe you" Icon={HandCoins} />
      <Tile label="Udhar gold" value={grams(data?.udhari.gold)} sub="Fine gold customers owe you" Icon={Coins} />
      <Tile label="Udhar silver" value={grams(data?.udhari.silver)} sub="Fine silver customers owe you" Icon={Medal} />
      <Tile label="Shop cash" value={data ? inr(data.cash.inHand) : '—'} sub={data ? `Bank ${inr(data.cash.bank)}` : undefined} Icon={Wallet} />
    </>
  )
}

/** Read-only roll-up of balances from other modules' existing endpoints. Setting balances is not offered. */
export function AllStockSummary() {
  const { can } = useAuth()
  const noAccess = 'You do not have access to this'
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">A read-only view of stock and money balances across the shop.</p>
      <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {can('inventory.all_stock', 'view') ? <FineStockTiles /> : (<><Unavailable label="Fine gold stock" why={noAccess} /><Unavailable label="Fine silver stock" why={noAccess} /></>)}
        {can('exchange.list', 'view') ? (<><KachaTile metal="GOLD" /><KachaTile metal="SILVER" /></>) : (<><Unavailable label="Kacha gold" why={noAccess} /><Unavailable label="Kacha silver" why={noAccess} /></>)}
        {can('girvi.ledger', 'view') ? <GirviTile /> : <Unavailable label="Girvi loans open" why={noAccess} />}
        {can('dashboard.home', 'view') ? <DashboardTiles /> : <Unavailable label="Udhar and cash" why={noAccess} />}
        <Tile label="Total amount" value="—" sub="Not available yet" Icon={Banknote} />
      </div>
    </div>
  )
}
