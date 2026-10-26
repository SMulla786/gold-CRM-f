import type { ColumnDef } from '@tanstack/react-table'
import { Boxes, Gem, Hash, Layers, type LucideIcon } from 'lucide-react'
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
import { useCreateItemGroup, useCreateItemName, useItemGroups, useItemNames, useJewelleryTypes } from '@/lib/inventoryQueries'
import { ENTRY_METHODS, STOCK_CLASSES, type ItemGroupDto, type ItemNameDto } from '@/shared'

const CLASS_LABEL: Record<string, string> = { GOLD: 'Gold', SILVER: 'Silver', STONE: 'Stone', ARTIFICIAL: 'Artificial', FRANCHISE: 'Franchise' }

function GroupDialog({ onClose }: { onClose: () => void }) {
  const create = useCreateItemGroup()
  const [stockClass, setStockClass] = useState('GOLD')
  const { data: types } = useJewelleryTypes(stockClass)
  const [jewelleryTypeId, setJewelleryTypeId] = useState('')
  const [gstRate, setGstRate] = useState('3')
  const [names, setNames] = useState<string[]>([])
  const [draft, setDraft] = useState('')

  const addName = () => {
    const n = draft.trim()
    if (n && !names.includes(n)) setNames([...names, n])
    setDraft('')
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New item group(s)</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Stock class</Label>
              <Select value={stockClass} onValueChange={(v) => { setStockClass(v); setJewelleryTypeId('') }}>
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
              <Select value={jewelleryTypeId} onValueChange={setJewelleryTypeId}>
                <SelectTrigger aria-label="Jewellery type">
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  {types?.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
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
          <div className="space-y-1.5">
            <Label htmlFor="g-gst">GST %</Label>
            <Input id="g-gst" type="number" step="0.01" value={gstRate} onChange={(e) => setGstRate(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={names.length === 0 || create.isPending}
            onClick={async () => {
              await create.mutateAsync({ stockClass, names, gstRate: Number(gstRate), jewelleryTypeId: jewelleryTypeId ? Number(jewelleryTypeId) : undefined })
              onClose()
            }}
          >
            Create {names.length || ''} group{names.length === 1 ? '' : 's'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ItemNameDialog({ groups, onClose }: { groups: ItemGroupDto[]; onClose: () => void }) {
  const create = useCreateItemName()
  const [groupId, setGroupId] = useState('')
  const [name, setName] = useState('')
  const [method, setMethod] = useState('BOTH')
  const [tagPrefix, setTagPrefix] = useState('')
  const [tagDigits, setTagDigits] = useState('4')
  const needsTag = method === 'TAG' || method === 'BOTH'

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New item name</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Group</Label>
            <Select value={groupId} onValueChange={setGroupId}>
              <SelectTrigger aria-label="Group">
                <SelectValue placeholder="Select group" />
              </SelectTrigger>
              <SelectContent>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={String(g.id)}>
                    {CLASS_LABEL[g.stockClass]} · {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
        </div>
        <DialogFooter>
          <Button
            disabled={!groupId || !name.trim() || (needsTag && !tagPrefix) || create.isPending}
            onClick={async () => {
              await create.mutateAsync({ groupId: Number(groupId), name: name.trim(), method, tagPrefix: needsTag ? tagPrefix : undefined, tagDigits: needsTag ? Number(tagDigits) : undefined })
              onClose()
            }}
          >
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function ItemMasters() {
  const groupsQ = useItemGroups({ page: 1 })
  const namesQ = useItemNames({ page: 1 })
  const [newGroup, setNewGroup] = useState(false)
  const [newName, setNewName] = useState(false)

  const groupCols: ColumnDef<ItemGroupDto, unknown>[] = [
    { accessorKey: 'name', header: 'Group' },
    { accessorKey: 'stockClass', header: 'Class', cell: ({ row }) => CLASS_LABEL[row.original.stockClass] },
    { header: 'Type', cell: ({ row }) => row.original.jewelleryType?.name ?? '—' },
    { accessorKey: 'gstRate', header: 'GST %' },
    { accessorKey: 'itemCount', header: 'Items' },
  ]
  const nameCols: ColumnDef<ItemNameDto, unknown>[] = [
    { accessorKey: 'name', header: 'Item name' },
    { header: 'Group', cell: ({ row }) => `${CLASS_LABEL[row.original.group.stockClass]} · ${row.original.group.name}` },
    { accessorKey: 'method', header: 'Method' },
    { header: 'Tag', cell: ({ row }) => (row.original.tagPrefix ? `${row.original.tagPrefix} (${row.original.tagDigits})` : '—') },
  ]

  // Summary numbers derived from the pages already fetched (no extra requests).
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

  return (
    <div className="space-y-8">
      <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tile('Categories', groupsQ.data ? String(groupsQ.data.total) : '—', 'All master categories', Layers)}
        {tile('Product names', namesQ.data ? String(namesQ.data.total) : '—', 'Across all categories', Gem)}
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
          <Card className="p-4">
            <DataTable columns={groupCols} data={groupsQ.data?.items ?? []} isLoading={groupsQ.isLoading} emptyText="No item groups" />
          </Card>
        </TabsContent>
        <TabsContent value="names" className="space-y-4 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl">Product catalogue</h2>
              <p className="text-sm text-muted-foreground">Set how each product is entered and labelled for printing.</p>
            </div>
            <Button onClick={() => setNewName(true)} disabled={!groupsQ.data?.items.length}>
              New item name
            </Button>
          </div>
          <Card className="p-4">
            <DataTable columns={nameCols} data={namesQ.data?.items ?? []} isLoading={namesQ.isLoading} emptyText="No item names" />
          </Card>
        </TabsContent>
        {newGroup && <GroupDialog onClose={() => setNewGroup(false)} />}
        {newName && <ItemNameDialog groups={groupsQ.data?.items ?? []} onClose={() => setNewName(false)} />}
      </Tabs>
    </div>
  )
}
