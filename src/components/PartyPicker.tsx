import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NewPartyDialog } from '@/components/NewPartyDialog'
import { partySearch } from '@/lib/appQueries'
import type { PartyRefDto, PartyType } from '@/shared'

interface Props {
  value: PartyRefDto | null
  onChange: (p: PartyRefDto | null) => void
  type?: PartyType
  placeholder?: string
}

/** Typeahead party selector with inline "+ New party". Reused by transaction screens. */
export function PartyPicker({ value, onChange, type, placeholder = 'Search party…' }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PartyRefDto[]>([])
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (query.trim().length < 1) return setResults([])
    const t = setTimeout(() => void partySearch(query, type).then(setResults).catch(() => setResults([])), 250)
    return () => clearTimeout(t)
  }, [query, type])

  if (value) {
    return (
      <div className="flex items-center justify-between rounded-md border px-3 py-1.5 text-sm">
        <span>
          {value.name} · {value.mobile}
        </span>
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
          Change
        </Button>
      </div>
    )
  }

  return (
    <div className="relative">
      <Input value={query} placeholder={placeholder} onChange={(e) => setQuery(e.target.value)} />
      {(results.length > 0 || query.trim().length > 0) && (
        <div className="absolute z-10 mt-1 w-full rounded-md border bg-popover shadow">
          {results.map((r) => (
            <button
              type="button"
              key={r.id}
              className="block w-full px-3 py-1.5 text-left text-sm hover:bg-accent"
              onClick={() => {
                onChange(r)
                setQuery('')
                setResults([])
              }}
            >
              {r.name} · {r.mobile}
              {r.shopName ? ` · ${r.shopName}` : ''}
            </button>
          ))}
          <button type="button" className="block w-full border-t px-3 py-1.5 text-left text-sm font-medium text-primary hover:bg-accent" onClick={() => setCreating(true)}>
            + New party
          </button>
        </div>
      )}
      {creating && (
        <NewPartyDialog
          open
          defaultType={type ?? 'CUSTOMER'}
          onClose={() => setCreating(false)}
          onSaved={(p) => {
            onChange({ id: p.id, type: p.type, name: p.name, mobile: p.mobile, shopName: p.shopName })
            setQuery('')
          }}
        />
      )}
    </div>
  )
}
