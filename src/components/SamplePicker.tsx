import { FlaskConical, X } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/lib/auth'
import { SAMPLES_PERM, useSampleSearch } from '@/lib/samplesQueries'
import type { SamplePickDto, SampleStatus } from '@/shared'

/** One-line summary of a sample: #no · gross · tounch% · fine · holder. */
const sampleLine = (s: SamplePickDto) => {
  const holder = s.karigar?.name ?? s.party?.name
  return `#${s.sampleNo} · ${s.metal} · ${s.grossWt} g · ${Number(s.tounchPercent).toFixed(2)}% · fine ${s.fine} g${holder ? ` · ${holder}` : ''}`
}

interface Base {
  metal?: string
  statuses?: SampleStatus[]
  /** Accessible name of the search box (default "Search samples"). */
  ariaLabel?: string
  id?: string
  /** Lookup only: rows are shown but cannot be picked. */
  readOnly?: boolean
}
type Props = Base &
  (
    | { multiple: true; value?: SamplePickDto[]; onChange: (v: SamplePickDto[]) => void }
    | { multiple?: false; value?: SamplePickDto | null; onChange?: (v: SamplePickDto | null) => void }
  )

/** Search + pick samples from GET /app/samples/search (debounced). Single or multiple selection. */
export function SamplePicker(props: Props) {
  const { metal, statuses, ariaLabel = 'Search samples', id, readOnly } = props
  const [query, setQuery] = useState('')
  const [q, setQ] = useState('')
  useEffect(() => {
    const timer = setTimeout(() => setQ(query.trim()), 250)
    return () => clearTimeout(timer)
  }, [query])
  const { data, isLoading, isError } = useSampleSearch({ q, metal, statuses })

  const picked: SamplePickDto[] = props.multiple ? (props.value ?? []) : props.value ? [props.value] : []
  const isPicked = (s: SamplePickDto) => picked.some((p) => p.id === s.id)
  const toggle = (s: SamplePickDto) => {
    if (readOnly) return
    if (props.multiple) props.onChange(isPicked(s) ? picked.filter((p) => p.id !== s.id) : [...picked, s])
    else props.onChange?.(isPicked(s) ? null : s)
  }
  const unpick = (s: SamplePickDto) => {
    if (props.multiple) props.onChange(picked.filter((p) => p.id !== s.id))
    else props.onChange?.(null)
  }

  return (
    <div className="space-y-2">
      {!readOnly && picked.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {picked.map((s) => (
            <span key={s.id} className="inline-flex items-center gap-1 rounded-full border bg-muted/50 py-0.5 pl-2.5 pr-1 text-xs tabular-nums">
              {sampleLine(s)}
              <button type="button" className="rounded-full p-0.5 hover:bg-muted" aria-label={`Remove sample #${s.sampleNo}`} onClick={() => unpick(s)}>
                <X className="size-3" aria-hidden />
              </button>
            </span>
          ))}
        </div>
      )}
      <Input id={id} type="search" aria-label={ariaLabel} placeholder="Sample no. or holder name" value={query} onChange={(e) => setQuery(e.target.value)} />
      <ul className="max-h-56 divide-y overflow-y-auto rounded-xl border text-sm" aria-label="Samples found">
        {isLoading ? (
          <li className="px-3 py-2 text-muted-foreground">Loading…</li>
        ) : isError ? (
          <li className="px-3 py-2 text-muted-foreground">Could not load samples.</li>
        ) : data?.length ? (
          data.map((s) => (
            <li key={s.id}>
              {readOnly ? (
                <div className="px-3 py-2 tabular-nums">{sampleLine(s)} <span className="text-xs text-muted-foreground">({s.status.replace('_', ' ').toLowerCase()})</span></div>
              ) : (
                <button
                  type="button"
                  aria-pressed={isPicked(s)}
                  className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left tabular-nums hover:bg-muted/60 ${isPicked(s) ? 'bg-primary/10 font-medium' : ''}`}
                  onClick={() => toggle(s)}
                >
                  <span>{sampleLine(s)}</span>
                  {isPicked(s) && <span className="text-xs text-primary">Picked</span>}
                </button>
              )}
            </li>
          ))
        ) : (
          <li className="px-3 py-2 text-muted-foreground">No samples found.</li>
        )}
      </ul>
    </div>
  )
}

/** Read-only sample lookup (check a sample's tounch) for forms like BillForm: a small button + dialog. */
export function SampleLookupButton({ metal }: { metal?: string }) {
  const canView = useAuth().can(SAMPLES_PERM, 'view')
  const [open, setOpen] = useState(false)
  if (!canView) return null
  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <FlaskConical aria-hidden />Samples
      </Button>
      {open && (
        <Dialog open onOpenChange={(o) => !o && setOpen(false)}>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>Sample lookup</DialogTitle>
              <DialogDescription>Check a tounch sample's purity. Lookup only: nothing is added to this bill.</DialogDescription>
            </DialogHeader>
            <SamplePicker metal={metal} statuses={['IN_HAND', 'ISSUED', 'RETURNED']} readOnly />
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
