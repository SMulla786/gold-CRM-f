import { useState } from 'react'

import { NewPartyDialog } from '@/components/NewPartyDialog'
import { PartyCombobox } from '@/components/PartyCombobox'
import { CommandGroup, CommandItem, CommandSeparator } from '@/components/ui/command'
import { useT } from '@/lib/i18n'
import type { PartyRefDto, PartyType } from '@/shared'

interface Props {
  value: PartyRefDto | null
  onChange: (p: PartyRefDto | null) => void
  type?: PartyType
  placeholder?: string
  /** Accessible name + trigger id, forwarded to the combobox trigger. */
  ariaLabel?: string
  id?: string
}

/** Party combobox with inline "+ New party". Reused by transaction screens. */
export function PartyPicker({ value, onChange, type, placeholder, ariaLabel, id }: Props) {
  const t = useT()
  const [creating, setCreating] = useState(false)
  return (
    <>
      <PartyCombobox
        value={value}
        onChange={onChange}
        type={type}
        placeholder={placeholder}
        ariaLabel={ariaLabel}
        id={id}
        footer={(close) => (
          <>
            <CommandSeparator />
            <CommandGroup>
              <CommandItem value="__new__" onSelect={() => { close(); setCreating(true) }} className="text-primary">
                {t('party.new')}
              </CommandItem>
            </CommandGroup>
          </>
        )}
      />
      {creating && (
        <NewPartyDialog
          open
          defaultType={type ?? 'CUSTOMER'}
          onClose={() => setCreating(false)}
          onSaved={(p) => onChange({ id: p.id, type: p.type, name: p.name, mobile: p.mobile, shopName: p.shopName })}
        />
      )}
    </>
  )
}
