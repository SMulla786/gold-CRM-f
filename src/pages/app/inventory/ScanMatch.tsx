import { CircleCheck, CircleDashed, Package, ScanBarcode, type LucideIcon } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAllStock, useItemGroups } from '@/lib/inventoryQueries'
import type { StockItemDto } from '@/shared'

const CLASS_LABEL: Record<string, string> = { GOLD: 'Gold', SILVER: 'Silver', STONE: 'Stone', ARTIFICIAL: 'Artificial', FRANCHISE: 'Franchise' }
const CODE_TYPES = [
  { value: 'ANY', label: 'Any (tag or HUID)' },
  { value: 'TAG', label: 'Tag no' },
  { value: 'HUID', label: 'HUID' },
]
type FilterKey = 'category' | 'type' | 'purity' | 'group' | 'itemName'
const EMPTY: Record<FilterKey, string> = { category: '', type: '', purity: '', group: '', itemName: '' }
const g3 = (n: number) => `${n.toFixed(3)} g`
const totals = (rows: StockItemDto[]) => ({
  gross: rows.reduce((s, i) => s + Number(i.gross), 0),
  net: rows.reduce((s, i) => s + Number(i.net), 0),
})

// Browser-only stock audit: scan TAG barcodes / HUIDs (keyboard-wedge; Enter submits) and match against available stock.
export function ScanMatch() {
  const { data, isLoading } = useAllStock({ status: 'AVAILABLE', method: 'TAG' })
  // Group -> jewellery type ("Item" filter); the stock DTO only carries the group.
  // shortcut: first 100 groups only (API page cap); page through if a shop ever has more.
  const groupQuery = { page: 1, pageSize: 100 }
  const { data: groups } = useItemGroups(groupQuery)
  const typeOf = useMemo(() => new Map((groups?.items ?? []).map((g) => [g.id, g.jewelleryType])), [groups])

  const [codeType, setCodeType] = useState('ANY')
  const [f, setF] = useState(EMPTY)
  const [q, setQ] = useState('')
  const [scanned, setScanned] = useState<Set<number>>(new Set())
  const [unknown, setUnknown] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  const all = useMemo(() => (data ?? []).filter((i) => i.tagNo), [data])
  const valueOf: Record<FilterKey, (i: StockItemDto) => string> = {
    category: (i) => i.stockClass,
    type: (i) => String(typeOf.get(i.group.id)?.id ?? ''),
    purity: (i) => i.karatCode ?? '',
    group: (i) => String(i.group.id),
    itemName: (i) => String(i.itemName.id),
  }
  const matches = (i: StockItemDto, keys: FilterKey[]) => keys.every((k) => !f[k] || valueOf[k](i) === f[k])
  const order: FilterKey[] = ['category', 'type', 'purity', 'group', 'itemName']
  // Each select only offers values present in stock under the filters to its left.
  const options = (k: FilterKey, label: (i: StockItemDto) => string) => {
    const seen = new Map<string, string>()
    for (const i of all) if (matches(i, order.slice(0, order.indexOf(k))) && valueOf[k](i)) seen.set(valueOf[k](i), label(i))
    return [...seen].sort((a, b) => a[1].localeCompare(b[1]))
  }

  const needle = q.trim().toLowerCase()
  const available = all.filter(
    (i) =>
      matches(i, order) &&
      (!needle || [i.tagNo, i.huid, i.itemName.name, i.group.name].some((s) => s?.toLowerCase().includes(needle))),
  )
  const scannedRows = available.filter((i) => scanned.has(i.id))
  const missed = available.filter((i) => !scanned.has(i.id))
  const offFilter = scanned.size - scannedRows.length

  const submit = (raw: string) => {
    const code = raw.trim().toUpperCase()
    if (!code) return
    const hit = all.find((i) => (codeType !== 'HUID' && i.tagNo === code) || (codeType !== 'TAG' && i.huid === code))
    if (hit) setScanned((s) => new Set(s).add(hit.id))
    else if (!unknown.includes(code)) setUnknown((u) => [...u, code])
    if (inputRef.current) inputRef.current.value = ''
  }
  const reset = () => {
    setScanned(new Set())
    setUnknown([])
    inputRef.current?.focus()
  }

  const pick = (k: FilterKey, label: string, opts: [string, string][]) => (
    <div className="space-y-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <Select
        value={f[k] || 'all'}
        // Changing a filter clears the ones to its right, whose options depend on it.
        onValueChange={(v) => setF((p) => ({ ...p, ...Object.fromEntries(order.slice(order.indexOf(k) + 1).map((x) => [x, ''])), [k]: v === 'all' ? '' : v }))}
      >
        <SelectTrigger className="w-40" aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All</SelectItem>
          {opts.map(([v, l]) => (
            <SelectItem key={v} value={v}>
              {l}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )

  const panel = (title: string, rows: StockItemDto[], Icon: LucideIcon, empty: string) => {
    const t = totals(rows)
    return (
      <Card className="gap-3" aria-label={`${title} panel`}>
        <CardHeader className="flex flex-row items-center justify-between pb-1">
          <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</CardTitle>
          <span className="icon-chip"><Icon className="size-5" aria-hidden /></span>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-3xl font-extrabold tracking-tight tabular-nums">{isLoading ? '—' : rows.length}</div>
          <dl className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <dt className="uppercase tracking-wide text-muted-foreground">Gross wt</dt>
              <dd className="font-semibold tabular-nums">{g3(t.gross)}</dd>
            </div>
            <div>
              <dt className="uppercase tracking-wide text-muted-foreground">Net wt</dt>
              <dd className="font-semibold tabular-nums">{g3(t.net)}</dd>
            </div>
          </dl>
          <ul className="max-h-72 space-y-1 overflow-y-auto border-t pt-2 text-sm">
            {rows.length ? (
              rows.map((i) => (
                <li key={i.id} className="flex justify-between gap-2">
                  <span className="truncate">
                    <span className="font-mono">{i.tagNo}</span> · {i.itemName.name}
                  </span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">{i.net} g</span>
                </li>
              ))
            ) : (
              <li className="text-muted-foreground">{empty}</li>
            )}
          </ul>
        </CardContent>
      </Card>
    )
  }

  const missedTotals = totals(missed)

  return (
    <div className="space-y-8">
      <Card className="print:hidden">
        <CardContent className="flex flex-wrap items-end gap-3 pt-6">
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Code type</span>
            <Select value={codeType} onValueChange={setCodeType}>
              <SelectTrigger className="w-40" aria-label="Code type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CODE_TYPES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {pick('category', 'Category', options('category', (i) => CLASS_LABEL[i.stockClass] ?? i.stockClass))}
          {pick('type', 'Item', options('type', (i) => typeOf.get(i.group.id)?.name ?? ''))}
          {pick('purity', 'Purity', options('purity', (i) => i.karatCode ?? ''))}
          {pick('group', 'Groups', options('group', (i) => i.group.name))}
          {pick('itemName', 'Item names', options('itemName', (i) => i.itemName.name))}
          <div className="space-y-1.5">
            <label htmlFor="scan-q" className="text-xs font-medium text-muted-foreground">Search</label>
            <Input id="scan-q" className="w-56" placeholder="Name, group, tag or HUID" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-end gap-4 print:hidden">
        <div className="space-y-1.5">
          <label htmlFor="scan" className="text-sm font-medium">Scan tag (barcode or type + Enter)</label>
          <div className="flex items-center gap-2">
            <ScanBarcode className="size-5 text-muted-foreground" aria-hidden />
            <Input
              id="scan"
              ref={inputRef}
              className="w-72"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  submit((e.target as HTMLInputElement).value)
                }
              }}
            />
          </div>
        </div>
        <Button variant="outline" onClick={reset}>Reset session</Button>
        <Button variant="outline" disabled={!missed.length} onClick={() => window.print()}>Print missed list</Button>
      </div>

      {(unknown.length > 0 || offFilter > 0) && (
        <div className="space-y-1 text-sm print:hidden">
          {unknown.length > 0 && <p className="text-destructive">Unknown codes ({unknown.length}): {unknown.join(', ')}</p>}
          {offFilter > 0 && <p className="text-muted-foreground">{offFilter} scanned item(s) are outside the current filters.</p>}
        </div>
      )}

      <div className="stagger grid gap-4 print:hidden lg:grid-cols-3">
        {panel('Available', available, Package, isLoading ? 'Loading…' : 'No tagged stock for these filters.')}
        {panel('Scanned', scannedRows, CircleCheck, 'Nothing scanned yet.')}
        {panel('Missed', missed, CircleDashed, 'All available tags scanned.')}
      </div>

      <div className="print-area hidden print:block">
        <h2 className="mb-2 font-medium">
          Missed ({missed.length}) · Gross {g3(missedTotals.gross)} · Net {g3(missedTotals.net)}
        </h2>
        <ul className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
          {missed.map((i) => (
            <li key={i.id}>{i.tagNo} · {i.itemName.name} · {i.gross}/{i.net}g</li>
          ))}
        </ul>
      </div>
    </div>
  )
}
