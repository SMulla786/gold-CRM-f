import type { ColumnDef } from '@tanstack/react-table'
import { useState } from 'react'

import { ConfirmDialog } from '@/components/ConfirmDialog'
import { DataTable } from '@/components/DataTable'
import { NewPartyDialog } from '@/components/NewPartyDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useDeleteParty, useParties, useParty } from '@/lib/appQueries'
import { useAuth } from '@/lib/auth'
import { PARTY_TYPES, type PartyListItemDto, type PartyType } from '@/shared'

export function Parties() {
  const { can } = useAuth()
  const canEdit = can('settings.parties', 'edit')
  const canDelete = can('settings.parties', 'delete')
  const [type, setType] = useState('')
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
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
        {canEdit && (
          <Button className="ml-auto" onClick={() => setCreating(true)}>
            New party
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        isLoading={isLoading}
        emptyText="No parties"
        pagination={data ? { page: data.page, pageSize: data.pageSize, total: data.total, onPage: setPage } : undefined}
      />

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
