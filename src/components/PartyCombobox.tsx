import { ChevronsUpDown } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { partySearch } from '@/lib/appQueries'
import type { PartyRefDto, PartyType } from '@/shared'

interface Props {
  value: PartyRefDto | null
  onChange: (p: PartyRefDto | null) => void
  type?: PartyType
  placeholder?: string
  /** Extra item rendered under the results (e.g. "+ New party"). */
  footer?: (close: () => void) => ReactNode
}

/** Accessible async party combobox (cmdk) — arrow keys, Enter, type-ahead. Server-side search, so filtering is off. */
export function PartyCombobox({ value, onChange, type, placeholder = 'Search party…', footer }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PartyRefDto[]>([])

  useEffect(() => {
    if (query.trim().length < 1) return setResults([])
    const t = setTimeout(() => void partySearch(query, type).then(setResults).catch(() => setResults([])), 250)
    return () => clearTimeout(t)
  }, [query, type])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between font-normal">
          {value ? `${value.name} · ${value.mobile}` : <span className="text-muted-foreground">{placeholder}</span>}
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder={placeholder} value={query} onValueChange={setQuery} />
          <CommandList>
            {query.trim().length > 0 && results.length === 0 && <CommandEmpty>No parties found.</CommandEmpty>}
            <CommandGroup>
              {results.map((r) => (
                <CommandItem
                  key={r.id}
                  value={String(r.id)}
                  onSelect={() => {
                    onChange(r)
                    setQuery('')
                    setOpen(false)
                  }}
                >
                  {r.name} · {r.mobile}
                  {r.shopName ? ` · ${r.shopName}` : ''}
                </CommandItem>
              ))}
            </CommandGroup>
            {footer?.(() => setOpen(false))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
