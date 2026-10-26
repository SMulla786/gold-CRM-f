import type { ColumnDef } from '@tanstack/react-table'
import { Network, UserCheck, UserX, Users, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { ConfirmDialog } from '@/components/ConfirmDialog'
import { DataTable } from '@/components/DataTable'
import { NewPartyDialog } from '@/components/NewPartyDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useDeleteParty, useParties, useParty } from '@/lib/appQueries'
import { useAuth } from '@/lib/auth'
import { PARTY_TYPES, type PartyListItemDto, type PartyType } from '@/shared'

export function Parties() {
  const { can } = useAuth()
  const canEdit = can('settings.parties', 'edit')
  const canDelete = can('settings.parties', 'delete')
  // Type filter lives in the URL (?type=SUPPLIER) so Customers / Suppliers / Karigars can be deep-linked.
  const [params, setParams] = useSearchParams()
  const rawType = params.get('type')?.toUpperCase() ?? ''
  const type = (PARTY_TYPES as readonly string[]).includes(rawType) ? rawType : ''
  const setType = (t: string) =>
    setParams((p) => {
      const n = new URLSearchParams(p)
      if (t) n.set('type', t)
      else n.delete('type')
      return n
    }, { replace: true })
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const { data, isLoading } = useParties({ page, q: q || undefined, type: type || undefined })
  const del = useDeleteParty()
  const [creating, setCreating] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const { data: editParty } = useParty(editId ?? undefined)
  const [removing, setRemoving] = useState<PartyListItemDto | null>(null)

  const columns: ColumnDef<PartyListItemDto, unknown>[] = [
    { accessorKey: 'name', header: 'Name', cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
    { accessorKey: 'mobile', header: 'Mobile' },
    { accessorKey: 'type', header: 'Type' },
    { header: 'Shop', cell: ({ row }) => row.original.shopName ?? '—' },
    { header: 'Family', cell: ({ row }) => (row.original.parent ? `under ${row.original.parent.name}` : row.original.memberCount ? `${row.original.memberCount} members` : '—') },
    { accessorKey: 'isActive', header: 'Status', cell: ({ row }) => <Badge variant={row.original.isActive ? 'default' : 'secondary'}>{row.original.isActive ? 'Active' : 'Inactive'}</Badge> },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex gap-2">
          {canEdit && (
            <Button variant="outline" size="sm" onClick={() => setEditId(row.original.id)}>
              Edit
            </Button>
          )}
          {canDelete && (
            <Button variant="ghost" size="sm" onClick={() => setRemoving(row.original)}>
              Remove
            </Button>
          )}
        </div>
      ),
    },
  ]

  // Summary numbers derived from the page already fetched (no extra requests).
  const items = data?.items ?? []
  const activeRows = items.filter((p) => p.isActive).length
  const inactiveRows = items.length - activeRows
  const familyHeads = items.filter((p) => p.memberCount > 0)
  const linkedMembers = familyHeads.reduce((sum, p) => sum + p.memberCount, 0)

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl">Contact directory</h2>
          <p className="text-sm text-muted-foreground">Customers, suppliers, karigars and wholesalers in one place</p>
        </div>
        {canEdit && (
          <Button onClick={() => setCreating(true)}>
            New party
          </Button>
        )}
      </div>

      <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tile('Contacts', data ? String(data.total) : '—', 'Matching current filters', Users)}
        {tile('Active on this page', data ? String(activeRows) : '—', data ? `of ${items.length} shown` : undefined, UserCheck)}
        {tile('Inactive on this page', data ? String(inactiveRows) : '—', 'Deactivated, can be re-added', UserX)}
        {tile('Family heads on this page', data ? String(familyHeads.length) : '—', data ? `${linkedMembers} linked sub-profiles` : undefined, Network)}
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 pt-6">
          <Input className="max-w-xs" placeholder="Search name / mobile / shop…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} />
          <Select value={type || 'all'} onValueChange={(v) => { setType(v === 'all' ? '' : v); setPage(1) }}>
            <SelectTrigger className="w-40" aria-label="Filter by type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {PARTY_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t.charAt(0) + t.slice(1).toLowerCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card className="p-4">
        <DataTable
          columns={columns}
          data={data?.items ?? []}
          isLoading={isLoading}
          emptyText="No parties"
          pagination={data ? { page: data.page, pageSize: data.pageSize, total: data.total, onPage: setPage } : undefined}
        />
      </Card>

      {creating && <NewPartyDialog open onClose={() => setCreating(false)} defaultType={(type || 'CUSTOMER') as PartyType} />}
      {editId && editParty && <NewPartyDialog open party={editParty} onClose={() => setEditId(null)} />}
      <ConfirmDialog
        open={!!removing}
        title={`Remove ${removing?.name ?? ''}?`}
        description="The party is deactivated, not deleted. You can re-add it later."
        confirmLabel="Remove"
        destructive
        onConfirm={async () => { if (removing) await del.mutateAsync(removing.id) }}
        onClose={() => setRemoving(null)}
      />
    </div>
  )
}
