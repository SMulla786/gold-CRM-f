import type { ColumnDef } from '@tanstack/react-table'
import { Boxes, Gem, Hash, Layers, Plus, type LucideIcon } from 'lucide-react'
import { useState } from 'react'

import { DataTable } from '@/components/DataTable'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useHsn, useKarats } from '@/lib/appQueries'
import { useAuth } from '@/lib/auth'
import { useCreateItemGroup, useCreateItemName, useItemGroups, useItemNames, useJewelleryTypes, useUpdateItemGroup, useUpdateItemName } from '@/lib/inventoryQueries'
import { CHARGE_UNITS, ENTRY_METHODS, STOCK_CLASSES, type ItemGroupDto, type ItemNameDto } from '@/shared'

const CLASS_LABEL: Record<string, string> = { GOLD: 'Gold', SILVER: 'Silver', STONE: 'Stone', ARTIFICIAL: 'Artificial', FRANCHISE: 'Franchise' }

/** '' → `empty` (undefined = not sent on create; null = cleared on edit), else a number. */
const optNum = (s: string, empty?: null) => (s.trim() === '' ? empty : Number(s))
const str = (v: string | number | null | undefined) => (v == null ? '' : String(v))

type Limits = { minWeight: string; maxWeight: string; minPcs: string; maxPcs: string }
const limitsBody = (l: Limits, empty?: null) => ({ minWeight: optNum(l.minWeight, empty), maxWeight: optNum(l.maxWeight, empty), minPcs: optNum(l.minPcs, empty), maxPcs: optNum(l.maxPcs, empty) })

/** HSN picker fed by the settings HSN master (enabled codes only), with a client-side 4/6/8-digit filter. */
function HsnSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { data } = useHsn({ onlyActive: 'true' })
  const [digits, setDigits] = useState('any')
  // Keep the selected code listed even when it falls outside the digit filter.
  const opts = data?.filter((h) => digits === 'any' || h.code.length === Number(digits) || String(h.id) === value)
  return (
    <div className="flex gap-2">
      <Select value={value || 'none'} onValueChange={(v) => onChange(v === 'none' ? '' : v)}>
        <SelectTrigger aria-label="HSN code">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">No HSN</SelectItem>
          {opts?.map((h) => (
            <SelectItem key={h.id} value={String(h.id)}>
              {h.code} · {h.productType}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={digits} onValueChange={setDigits}>
        <SelectTrigger className="w-28 shrink-0" aria-label="HSN digits">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="any">Any length</SelectItem>
          {['4', '6', '8'].map((d) => (
            <SelectItem key={d} value={d}>{d} digits</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function LimitFields({ prefix, value, onChange }: { prefix: string; value: Limits; onChange: (l: Limits) => void }) {
  const fields: [keyof Limits, string, string][] = [
    ['minWeight', 'Min stock (g)', '0.001'],
    ['maxWeight', 'Max stock (g)', '0.001'],
    ['minPcs', 'Min stock (pcs)', '1'],
    ['maxPcs', 'Max stock (pcs)', '1'],
  ]
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {fields.map(([k, label, step]) => (
        <div key={k} className="space-y-1.5">
          <Label htmlFor={`${prefix}-${k}`}>{label}</Label>
          <Input id={`${prefix}-${k}`} type="number" min={0} step={step} value={value[k]} onChange={(e) => onChange({ ...value, [k]: e.target.value })} />
        </div>
      ))}
    </div>
  )
}

function GroupDialog({ group, defaultClass, onCreated, onClose }: { group?: ItemGroupDto; defaultClass?: string; onCreated?: (groups: ItemGroupDto[]) => void; onClose: () => void }) {
  const editing = !!group
  const create = useCreateItemGroup()
  const update = useUpdateItemGroup()
  const [stockClass, setStockClass] = useState<string>(group?.stockClass ?? defaultClass ?? 'GOLD')
  const { data: types } = useJewelleryTypes(stockClass)
  const [jewelleryTypeId, setJewelleryTypeId] = useState(str(group?.jewelleryType?.id))
  const [gstRate, setGstRate] = useState(group?.gstRate ?? '3')
  const [names, setNames] = useState<string[]>([])
  const [draft, setDraft] = useState('')
  const [editName, setEditName] = useState(group?.name ?? '')
  const [hsnId, setHsnId] = useState(str(group?.hsn?.id))
  const [limits, setLimits] = useState<Limits>({ minWeight: str(group?.minWeight), maxWeight: str(group?.maxWeight), minPcs: str(group?.minPcs), maxPcs: str(group?.maxPcs) })

  const addName = () => {
    const n = draft.trim()
    if (n && !names.includes(n)) setNames([...names, n])
    setDraft('')
  }
  // Edit sends null for a cleared field so the server clears it; create just leaves it out.
  const empty = editing ? null : undefined
  const extra = { hsnId: hsnId ? Number(hsnId) : empty, ...limitsBody(limits, empty) }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{editing ? `Edit group · ${group.name}` : 'New item group(s)'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Stock class</Label>
              <Select value={stockClass} disabled={editing} onValueChange={(v) => { setStockClass(v); setJewelleryTypeId('') }}>
                <SelectTrigger aria-label="Stock class">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STOCK_CLASSES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {CLASS_LABEL[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Jewellery type</Label>
              <Select value={jewelleryTypeId} onValueChange={(v) => setJewelleryTypeId(v === 'none' ? '' : v)}>
                <SelectTrigger aria-label="Jewellery type">
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No type</SelectItem>
                  {types?.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {editing ? (
            <div className="space-y-1.5">
              <Label htmlFor="g-edit-name">Group name</Label>
              <Input id="g-edit-name" value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="g-names">Group names (type and press Enter to add several)</Label>
              <Input
                id="g-names"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault()
                    addName()
                  }
                }}
                onBlur={addName}
              />
              {names.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {names.map((n) => (
                    <Badge key={n} variant="secondary" className="cursor-pointer" onClick={() => setNames(names.filter((x) => x !== n))}>
                      {n} ✕
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="g-gst">GST %</Label>
              <Input id="g-gst" type="number" step="0.01" value={gstRate} onChange={(e) => setGstRate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>HSN code</Label>
              <HsnSelect value={hsnId} onChange={setHsnId} />
            </div>
          </div>
          <LimitFields prefix="g" value={limits} onChange={setLimits} />
        </div>
        <DialogFooter>
          {editing ? (
            <Button
              disabled={!editName.trim() || update.isPending}
              onClick={async () => {
                await update.mutateAsync({ id: group.id, body: { name: editName.trim(), gstRate: Number(gstRate), jewelleryTypeId: jewelleryTypeId ? Number(jewelleryTypeId) : null, ...extra } })
                onClose()
              }}
            >
              Save group
            </Button>
          ) : (
            <Button
              disabled={names.length === 0 || create.isPending}
              onClick={async () => {
                const created = await create.mutateAsync({ stockClass, names, gstRate: Number(gstRate), jewelleryTypeId: jewelleryTypeId ? Number(jewelleryTypeId) : undefined, ...extra })
                onCreated?.(created)
                onClose()
              }}
            >
              Create {names.length || ''} group{names.length === 1 ? '' : 's'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Create/edit an item name. Exported for New Stock's inline 'New item'; `stockClass` seeds the inline new-group dialog. */
export function ItemNameDialog({ groups, item, stockClass, onCreated, onClose }: { groups: ItemGroupDto[]; item?: ItemNameDto; stockClass?: string; onCreated?: (item: ItemNameDto) => void; onClose: () => void }) {
  const editing = !!item
  const create = useCreateItemName()
  const update = useUpdateItemName()
  const { data: karats } = useKarats()
  const [groupId, setGroupId] = useState(str(item?.group.id))
  const [name, setName] = useState(item?.name ?? '')
  const [method, setMethod] = useState<string>(item?.method ?? 'BOTH')
  const [tagPrefix, setTagPrefix] = useState(item?.tagPrefix ?? '')
  const [tagDigits, setTagDigits] = useState(str(item?.tagDigits ?? 4))
  const [hsnId, setHsnId] = useState(str(item?.hsn?.id))
  const [taxValue, setTaxValue] = useState(str(item?.taxValue))
  const [taxUnit, setTaxUnit] = useState<string>(item?.taxUnit ?? 'PERCENT')
  const [limits, setLimits] = useState<Limits>({ minWeight: str(item?.minWeight), maxWeight: str(item?.maxWeight), minPcs: str(item?.minPcs), maxPcs: str(item?.maxPcs) })
  const [def, setDef] = useState<Record<'karat' | 'tunch' | 'wastage' | 'labour' | 'labourUnit', string>>({ karat: item?.defKaratCode ?? '', tunch: str(item?.defTunch), wastage: str(item?.defWastage), labour: str(item?.defLabour), labourUnit: item?.defLabourUnit ?? '' })
  const needsTag = method === 'TAG' || method === 'BOTH'
  const [newGroup, setNewGroup] = useState(false)

  // Active groups only, but keep the current group visible when editing.
  const groupOpts = groups.filter((g) => g.isActive || String(g.id) === groupId)
  const groupClass = groups.find((g) => String(g.id) === groupId)?.stockClass
  const karatOpts = [...new Map((karats ?? []).filter((k) => groupClass !== 'GOLD' && groupClass !== 'SILVER' ? true : k.metal === groupClass).map((k) => [k.code, k])).values()]

  const empty = editing ? null : undefined
  const body = () => ({
    name: name.trim(),
    method,
    tagPrefix: needsTag && tagPrefix ? tagPrefix : undefined,
    tagDigits: needsTag ? Number(tagDigits) : undefined,
    hsnId: hsnId ? Number(hsnId) : empty,
    taxValue: optNum(taxValue, empty),
    taxUnit: taxValue.trim() !== '' ? taxUnit : empty,
    ...limitsBody(limits, empty),
    defKaratCode: def.karat || empty,
    defTunch: optNum(def.tunch, empty),
    defWastage: optNum(def.wastage, empty),
    defLabour: optNum(def.labour, empty),
    defLabourUnit: def.labourUnit || empty,
  })

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? `Edit item name · ${item.name}` : 'New item name'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Group</Label>
            <div className="flex gap-2">
              <Select value={groupId} disabled={editing} onValueChange={setGroupId}>
                <SelectTrigger aria-label="Group">
                  <SelectValue placeholder="Select group" />
                </SelectTrigger>
                <SelectContent>
                  {groupOpts.map((g) => (
                    <SelectItem key={g.id} value={String(g.id)}>
                      {CLASS_LABEL[g.stockClass]} · {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!editing && (
                <Button type="button" variant="outline" className="shrink-0" onClick={() => setNewGroup(true)}>
                  <Plus className="size-4" aria-hidden />
                  New group
                </Button>
              )}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="n-name">Item name</Label>
            <Input id="n-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Method</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger aria-label="Method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ENTRY_METHODS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {needsTag && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="n-prefix">Tag prefix</Label>
                  <Input id="n-prefix" value={tagPrefix} onChange={(e) => setTagPrefix(e.target.value.toUpperCase())} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="n-digits">Tag digits</Label>
                  <Input id="n-digits" type="number" min={3} max={8} value={tagDigits} onChange={(e) => setTagDigits(e.target.value)} />
                </div>
              </>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>HSN code</Label>
              <HsnSelect value={hsnId} onChange={setHsnId} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="n-tax">GST value</Label>
              <Input id="n-tax" type="number" min={0} step="0.01" placeholder="Group rate" value={taxValue} onChange={(e) => setTaxValue(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>GST unit</Label>
              <Select value={taxUnit} onValueChange={setTaxUnit}>
                <SelectTrigger aria-label="GST unit">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PERCENT">Percent</SelectItem>
                  <SelectItem value="FIXED">Fixed amount</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <LimitFields prefix="n" value={limits} onChange={setLimits} />
          <fieldset className="space-y-3 rounded-xl border p-4">
            <legend className="px-1 text-sm font-medium">Default sale values</legend>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
              <div className="space-y-1.5">
                <Label>Default karat</Label>
                <Select value={def.karat || 'none'} onValueChange={(v) => setDef({ ...def, karat: v === 'none' ? '' : v })}>
                  <SelectTrigger aria-label="Default karat">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {karatOpts.map((k) => (
                      <SelectItem key={k.code} value={k.code}>
                        {k.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="n-def-tunch">Tunch %</Label>
                <Input id="n-def-tunch" type="number" min={0} max={100} step="0.01" value={def.tunch} onChange={(e) => setDef({ ...def, tunch: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="n-def-wastage">Wastage %</Label>
                <Input id="n-def-wastage" type="number" min={0} max={100} step="0.01" value={def.wastage} onChange={(e) => setDef({ ...def, wastage: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="n-def-labour">Labour</Label>
                <Input id="n-def-labour" type="number" min={0} step="0.01" value={def.labour} onChange={(e) => setDef({ ...def, labour: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Labour unit</Label>
                <Select value={def.labourUnit || 'none'} onValueChange={(v) => setDef({ ...def, labourUnit: v === 'none' ? '' : v })}>
                  <SelectTrigger aria-label="Default labour unit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {CHARGE_UNITS.map((u) => (
                      <SelectItem key={u} value={u}>
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </fieldset>
        </div>
        <DialogFooter>
          {editing ? (
            <Button
              disabled={!name.trim() || (needsTag && !tagPrefix) || update.isPending}
              onClick={async () => {
                await update.mutateAsync({ id: item.id, body: body() })
                onClose()
              }}
            >
              Save item name
            </Button>
          ) : (
            <>
              {/* 'Continue?': save and keep the dialog open with the same group and settings for the next name. */}
              {!onCreated && (
                <Button
                  variant="outline"
                  disabled={!groupId || !name.trim() || (needsTag && !tagPrefix) || create.isPending}
                  onClick={async () => {
                    await create.mutateAsync({ groupId: Number(groupId), ...body() })
                    setName('')
                    setTagPrefix('')
                  }}
                >
                  Save and add another
                </Button>
              )}
              <Button
                disabled={!groupId || !name.trim() || (needsTag && !tagPrefix) || create.isPending}
                onClick={async () => {
                  const created = await create.mutateAsync({ groupId: Number(groupId), ...body() })
                  onCreated?.(created)
                  onClose()
                }}
              >
                Create
              </Button>
            </>
          )}
        </DialogFooter>
        {newGroup && <GroupDialog defaultClass={groupClass ?? stockClass} onCreated={(gs) => gs[0] && setGroupId(String(gs[0].id))} onClose={() => setNewGroup(false)} />}
      </DialogContent>
    </Dialog>
  )
}

const ALL = 'all'

export function ItemMasters() {
  const { can } = useAuth()
  const canEdit = can('inventory.item_masters', 'edit')
  // Group tab filters + page
  const [gQ, setGQ] = useState('')
  const [gClass, setGClass] = useState('')
  const [gType, setGType] = useState('')
  const [gPage, setGPage] = useState(1)
  const [gSize, setGSize] = useState(20)
  const { data: gTypes } = useJewelleryTypes(gClass || undefined)
  // Name tab filters + page
  const [nQ, setNQ] = useState('')
  const [nClass, setNClass] = useState('')
  const [nGroup, setNGroup] = useState('')
  const [nPage, setNPage] = useState(1)
  const [nSize, setNSize] = useState(20)

  const groupsQ = useItemGroups({ page: gPage, pageSize: gSize, q: gQ || undefined, stockClass: gClass || undefined, jewelleryTypeId: gType ? Number(gType) : undefined })
  const namesQ = useItemNames({ page: nPage, pageSize: nSize, q: nQ || undefined, stockClass: nClass || undefined, groupId: nGroup ? Number(nGroup) : undefined })
  // Unfiltered: every group (contract max 100) for pickers + the catalogue totals.
  const allGroupsQ = useItemGroups({ page: 1, pageSize: 100 })
  const allNamesCount = useItemNames({ page: 1, pageSize: 1 })
  const allGroups = allGroupsQ.data?.items ?? []
  const updateGroup = useUpdateItemGroup()
  const updateName = useUpdateItemName()

  const [newGroup, setNewGroup] = useState(false)
  const [newName, setNewName] = useState(false)
  const [editGroup, setEditGroup] = useState<ItemGroupDto | null>(null)
  const [editName, setEditName] = useState<ItemNameDto | null>(null)

  const statusBadge = (active: boolean) => <Badge variant={active ? 'default' : 'secondary'}>{active ? 'Active' : 'Inactive'}</Badge>
  const limitText = (minW: string | null, maxW: string | null, minP: number | null, maxP: number | null) =>
    minW == null && maxW == null && minP == null && maxP == null ? '—' : `${minW ?? '—'}–${maxW ?? '—'} g · ${minP ?? '—'}–${maxP ?? '—'} pcs`

  const groupCols: ColumnDef<ItemGroupDto, unknown>[] = [
    { accessorKey: 'name', header: 'Group' },
    { accessorKey: 'stockClass', header: 'Class', cell: ({ row }) => CLASS_LABEL[row.original.stockClass] },
    { header: 'Type', cell: ({ row }) => row.original.jewelleryType?.name ?? '—' },
    { id: 'hsn', header: 'HSN', cell: ({ row }) => row.original.hsn?.code ?? '—' },
    { accessorKey: 'gstRate', header: 'GST %' },
    { id: 'limits', header: 'Min / Max stock', cell: ({ row }) => <span className="whitespace-nowrap tabular-nums text-muted-foreground">{limitText(row.original.minWeight, row.original.maxWeight, row.original.minPcs, row.original.maxPcs)}</span> },
    { accessorKey: 'itemCount', header: 'Items' },
    { id: 'status', header: 'Status', cell: ({ row }) => statusBadge(row.original.isActive) },
    ...(canEdit
      ? [{
          id: 'actions',
          header: '',
          cell: ({ row }: { row: { original: ItemGroupDto } }) => (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditGroup(row.original)}>Edit</Button>
              <Button variant="ghost" size="sm" disabled={updateGroup.isPending} onClick={() => updateGroup.mutate({ id: row.original.id, body: { isActive: !row.original.isActive } })}>
                {row.original.isActive ? 'Deactivate' : 'Activate'}
              </Button>
            </div>
          ),
        } as ColumnDef<ItemGroupDto, unknown>]
      : []),
  ]
  const nameCols: ColumnDef<ItemNameDto, unknown>[] = [
    { accessorKey: 'name', header: 'Item name' },
    { header: 'Group', cell: ({ row }) => `${CLASS_LABEL[row.original.group.stockClass]} · ${row.original.group.name}` },
    { accessorKey: 'method', header: 'Method' },
    { header: 'Tag', cell: ({ row }) => (row.original.tagPrefix ? `${row.original.tagPrefix} (${row.original.tagDigits})` : '—') },
    { id: 'hsn', header: 'HSN', cell: ({ row }) => row.original.hsn?.code ?? '—' },
    { id: 'purity', header: 'Purity', cell: ({ row }) => [row.original.defKaratCode, row.original.defTunch != null ? `${row.original.defTunch}%` : null].filter(Boolean).join(' · ') || '—' },
    {
      id: 'defaults',
      header: 'Defaults',
      cell: ({ row }) => {
        const n = row.original
        const parts = [n.defWastage != null ? `Wst ${n.defWastage}%` : null, n.defLabour != null ? `Lbr ${n.defLabour}${n.defLabourUnit ? ` ${n.defLabourUnit}` : ''}` : null].filter(Boolean)
        return <span className="whitespace-nowrap text-muted-foreground">{parts.join(' · ') || '—'}</span>
      },
    },
    { id: 'status', header: 'Status', cell: ({ row }) => statusBadge(row.original.isActive) },
    ...(canEdit
      ? [{
          id: 'actions',
          header: '',
          cell: ({ row }: { row: { original: ItemNameDto } }) => (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditName(row.original)}>Edit</Button>
              <Button variant="ghost" size="sm" disabled={updateName.isPending} onClick={() => updateName.mutate({ id: row.original.id, body: { isActive: !row.original.isActive } })}>
                {row.original.isActive ? 'Deactivate' : 'Activate'}
              </Button>
            </div>
          ),
        } as ColumnDef<ItemNameDto, unknown>]
      : []),
  ]

  // Summary numbers derived from the pages already fetched.
  const groupItems = groupsQ.data?.items ?? []
  const nameItems = namesQ.data?.items ?? []
  const linkedTotal = groupItems.reduce((sum, g) => sum + g.itemCount, 0)
  const numbered = nameItems.filter((n) => n.tagPrefix).length

  const tile = (label: string, value: string, sub: string | undefined, Icon: LucideIcon) => (
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

  const classSelect = (value: string, onChange: (v: string) => void, label: string) => (
    <Select value={value || ALL} onValueChange={(v) => onChange(v === ALL ? '' : v)}>
      <SelectTrigger className="w-36" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>All classes</SelectItem>
        {STOCK_CLASSES.map((c) => (
          <SelectItem key={c} value={c}>
            {CLASS_LABEL[c]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )

  return (
    <div className="space-y-8">
      <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tile('Categories', allGroupsQ.data ? String(allGroupsQ.data.total) : '—', 'All master categories', Layers)}
        {tile('Product names', allNamesCount.data ? String(allNamesCount.data.total) : '—', 'Across all categories', Gem)}
        {tile('Linked entries', groupsQ.data ? String(linkedTotal) : '—', 'Across categories on this page', Boxes)}
        {tile('Auto-numbered', namesQ.data ? String(numbered) : '—', namesQ.data ? `of ${nameItems.length} products on this page` : undefined, Hash)}
      </div>

      <Tabs defaultValue="groups">
        <TabsList>
          <TabsTrigger value="groups">Item Groups</TabsTrigger>
          <TabsTrigger value="names">Item Names</TabsTrigger>
        </TabsList>
        <TabsContent value="groups" className="space-y-4 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl">Category catalogue</h2>
              <p className="text-sm text-muted-foreground">Organise products by metal, jewellery family and GST rate.</p>
            </div>
            <Button onClick={() => setNewGroup(true)}>New group</Button>
          </div>
          <Card>
            <CardContent className="flex flex-wrap items-end gap-3 pt-6">
              <Input className="max-w-xs" placeholder="Search groups…" aria-label="Search groups" value={gQ} onChange={(e) => { setGQ(e.target.value); setGPage(1) }} />
              {classSelect(gClass, (v) => { setGClass(v); setGType(''); setGPage(1) }, 'Filter by class')}
              <Select value={gType || ALL} onValueChange={(v) => { setGType(v === ALL ? '' : v); setGPage(1) }}>
                <SelectTrigger className="w-44" aria-label="Filter by jewellery type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All jewellery types</SelectItem>
                  {gTypes?.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
          <Card className="p-4">
            <DataTable
              columns={groupCols}
              data={groupItems}
              isLoading={groupsQ.isLoading}
              emptyText="No item groups"
              pagination={groupsQ.data ? { page: groupsQ.data.page, pageSize: groupsQ.data.pageSize, total: groupsQ.data.total, onPage: setGPage, onPageSize: setGSize } : undefined}
            />
          </Card>
        </TabsContent>
        <TabsContent value="names" className="space-y-4 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl">Product catalogue</h2>
              <p className="text-sm text-muted-foreground">Set how each product is entered and labelled for printing.</p>
            </div>
            <Button onClick={() => setNewName(true)} disabled={!allGroups.length}>
              New item name
            </Button>
          </div>
          <Card>
            <CardContent className="flex flex-wrap items-end gap-3 pt-6">
              <Input className="max-w-xs" placeholder="Search item names…" aria-label="Search item names" value={nQ} onChange={(e) => { setNQ(e.target.value); setNPage(1) }} />
              {classSelect(nClass, (v) => { setNClass(v); setNGroup(''); setNPage(1) }, 'Filter item names by class')}
              <Select value={nGroup || ALL} onValueChange={(v) => { setNGroup(v === ALL ? '' : v); setNPage(1) }}>
                <SelectTrigger className="w-44" aria-label="Filter by group">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All groups</SelectItem>
                  {allGroups.filter((g) => !nClass || g.stockClass === nClass).map((g) => (
                    <SelectItem key={g.id} value={String(g.id)}>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
          <Card className="p-4">
            <DataTable
              columns={nameCols}
              data={nameItems}
              isLoading={namesQ.isLoading}
              emptyText="No item names"
              pagination={namesQ.data ? { page: namesQ.data.page, pageSize: namesQ.data.pageSize, total: namesQ.data.total, onPage: setNPage, onPageSize: setNSize } : undefined}
            />
          </Card>
        </TabsContent>
        {newGroup && <GroupDialog onClose={() => setNewGroup(false)} />}
        {editGroup && <GroupDialog group={editGroup} onClose={() => setEditGroup(null)} />}
        {newName && <ItemNameDialog groups={allGroups} onClose={() => setNewName(false)} />}
        {editName && <ItemNameDialog groups={allGroups} item={editName} onClose={() => setEditName(null)} />}
      </Tabs>
    </div>
  )
}
