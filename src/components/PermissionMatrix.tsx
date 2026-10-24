import { Checkbox } from '@/components/ui/checkbox'
import type { ModuleDef, PermissionGrantDto } from '@/shared'

export type GrantMap = Record<string, { view: boolean; edit: boolean; delete: boolean }>

export const grantsToMap = (grants: PermissionGrantDto[]): GrantMap =>
  Object.fromEntries(grants.map((g) => [g.key, { view: g.view, edit: g.edit, delete: g.delete }]))

export const mapToGrants = (map: GrantMap): PermissionGrantDto[] =>
  Object.entries(map)
    .filter(([, v]) => v.view || v.edit || v.delete)
    .map(([key, v]) => ({ key, ...v }))

interface Props {
  catalog: ModuleDef[]
  value: GrantMap
  onChange: (next: GrantMap) => void
  /** Page keys that are per-user overrides on top of the role (shown with a dot). */
  overriddenKeys?: string[]
  disabled?: boolean
}

export function PermissionMatrix({ catalog, value, onChange, overriddenKeys = [], disabled }: Props) {
  const set = (key: string, patch: Partial<GrantMap[string]>) => {
    const cur = value[key] ?? { view: false, edit: false, delete: false }
    const nextRow = { ...cur, ...patch }
    // edit/delete imply view; clearing view clears the rest.
    if (patch.edit || patch.delete) nextRow.view = true
    if (patch.view === false) {
      nextRow.edit = false
      nextRow.delete = false
    }
    onChange({ ...value, [key]: nextRow })
  }
  const overridden = new Set(overriddenKeys)

  return (
    <div className="space-y-4">
      {catalog.map((mod) => (
        <div key={mod.key} className="rounded-md border">
          <div className="flex items-center justify-between border-b bg-muted/40 px-3 py-2">
            <span className="text-sm font-medium">{mod.label}</span>
            {mod.core && <span className="text-xs text-muted-foreground">core</span>}
          </div>
          <div className="divide-y">
            <div className="grid grid-cols-[1fr_4rem_4rem_4rem] items-center px-3 py-1 text-xs text-muted-foreground">
              <span>Page</span>
              <span className="text-center">View</span>
              <span className="text-center">Edit</span>
              <span className="text-center">Delete</span>
            </div>
            {mod.pages.map((pg) => {
              const row = value[pg.key] ?? { view: false, edit: false, delete: false }
              return (
                <div key={pg.key} className="grid grid-cols-[1fr_4rem_4rem_4rem] items-center px-3 py-1.5 text-sm">
                  <span className="flex items-center gap-1.5">
                    {pg.label}
                    {overridden.has(pg.key) && <span className="size-1.5 rounded-full bg-amber-500" title="Overrides role default" />}
                  </span>
                  <span className="text-center">
                    <Checkbox checked={row.view} disabled={disabled} onCheckedChange={(v) => set(pg.key, { view: Boolean(v) })} />
                  </span>
                  <span className="text-center">
                    {pg.actions ? <Checkbox checked={row.edit} disabled={disabled} onCheckedChange={(v) => set(pg.key, { edit: Boolean(v) })} /> : <span className="text-muted-foreground">—</span>}
                  </span>
                  <span className="text-center">
                    {pg.actions ? <Checkbox checked={row.delete} disabled={disabled} onCheckedChange={(v) => set(pg.key, { delete: Boolean(v) })} /> : <span className="text-muted-foreground">—</span>}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
