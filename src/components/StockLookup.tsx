import { PackageSearch } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useStock } from '@/lib/inventoryQueries'

// Mounted only while a search term exists, so the header never fetches stock on its own.
function Results({ q, onLeave }: { q: string; onLeave: () => void }) {
  const { data, isLoading } = useStock({ page: 1, q, status: 'AVAILABLE' })
  if (isLoading) return <p className="text-sm text-muted-foreground">Searching…</p>
  const rows = data?.items ?? []
  if (!rows.length) return <p className="text-sm text-muted-foreground">No available stock matches “{q}”.</p>
  return (
    <ul className="divide-y text-sm">
      {rows.map((i) => (
        <li key={i.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
          <span className="font-mono font-medium">{i.tagNo ?? '—'}</span>
          <span>{i.itemName.name}</span>
          <span className="text-muted-foreground">{i.group.name}</span>
          {i.karatCode && <Badge variant="secondary">{i.karatCode}</Badge>}
          <span className="ml-auto tabular-nums">
            {i.gross} / <span className="font-semibold">{i.net} g</span>
          </span>
          <span className="w-full text-xs text-muted-foreground">
            {i.branch.name} · {i.pcs} pcs{i.huid ? ` · HUID ${i.huid}` : ''}
          </span>
        </li>
      ))}
      {data && data.total > rows.length && (
        <li className="py-2 text-xs text-muted-foreground">
          Showing {rows.length} of {data.total} —{' '}
          <Link to="/app/inventory/stock" className="underline" onClick={onLeave}>open All Stock</Link>
        </li>
      )}
    </ul>
  )
}

/** Header quick lookup (Alt+S): find available stock by tag, HUID or name without leaving the current screen. */
export function StockLookup() {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === 's') {
        e.preventDefault()
        setOpen(true)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const close = () => {
    setOpen(false)
    setQ('')
  }
  const needle = q.trim()
  return (
    <>
      <Button variant="ghost" size="icon" aria-label="Stock lookup (Alt+S)" title="Stock lookup (Alt+S)" onClick={() => setOpen(true)}>
        <PackageSearch />
      </Button>
      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Stock lookup</DialogTitle>
            <DialogDescription>Available stock in the active branch — search by tag, HUID or item name.</DialogDescription>
          </DialogHeader>
          <Input autoFocus aria-label="Search stock" placeholder="Tag no, HUID or item name…" value={q} onChange={(e) => setQ(e.target.value)} />
          {needle ? <Results q={needle} onLeave={close} /> : <p className="text-sm text-muted-foreground">Start typing to search.</p>}
        </DialogContent>
      </Dialog>
    </>
  )
}
