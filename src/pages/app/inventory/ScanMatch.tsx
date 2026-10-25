import { useMemo, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useStock } from '@/lib/inventoryQueries'

// Browser-only stock audit: scan TAG barcodes (keyboard-wedge; Enter submits) and match against available stock.
export function ScanMatch() {
  const { data } = useStock({ status: 'AVAILABLE', method: 'TAG', pageSize: 500 })
  const available = useMemo(() => new Map((data?.items ?? []).filter((i) => i.tagNo).map((i) => [i.tagNo as string, i])), [data])
  const [scanned, setScanned] = useState<Set<string>>(new Set())
  const [unknown, setUnknown] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  const submit = (raw: string) => {
    const tag = raw.trim().toUpperCase()
    if (!tag) return
    if (available.has(tag)) setScanned((s) => new Set(s).add(tag))
    else if (!unknown.includes(tag)) setUnknown((u) => [...u, tag])
    if (inputRef.current) inputRef.current.value = ''
  }

  const missed = [...available.keys()].filter((t) => !scanned.has(t))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4 print:hidden">
        <div className="space-y-1.5">
          <label htmlFor="scan" className="text-sm font-medium">Scan tag (barcode or type + Enter)</label>
          <Input id="scan" ref={inputRef} autoFocus onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit((e.target as HTMLInputElement).value) } }} />
        </div>
        <Button variant="outline" onClick={() => { setScanned(new Set()); setUnknown([]) }}>Reset session</Button>
        <Button variant="outline" onClick={() => window.print()}>Print missed list</Button>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 print:hidden">
        {[
          { label: 'Available', n: available.size },
          { label: 'Scanned', n: scanned.size },
          { label: 'Missed', n: missed.length },
          { label: 'Unknown', n: unknown.length },
        ].map((c) => (
          <Card key={c.label}>
            <CardHeader className="pb-1"><CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-semibold">{c.n}</div></CardContent>
          </Card>
        ))}
      </div>

      {unknown.length > 0 && (
        <p className="text-sm text-destructive print:hidden">Unknown tags: {unknown.join(', ')}</p>
      )}

      <div className="print-area">
        <h2 className="mb-2 font-medium">Missed ({missed.length})</h2>
        {missed.length ? (
          <ul className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
            {missed.map((t) => {
              const it = available.get(t)!
              return <li key={t}>{t} · {it.itemName.name} · {it.net}g</li>
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">All available tags scanned.</p>
        )}
      </div>
    </div>
  )
}
