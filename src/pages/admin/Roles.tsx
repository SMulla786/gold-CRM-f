import type { ColumnDef } from '@tanstack/react-table'
import { useState } from 'react'

import { DataTable } from '@/components/DataTable'
import { PermissionMatrix, grantsToMap, mapToGrants, type GrantMap } from '@/components/PermissionMatrix'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/lib/auth'
import { useCreateRole, useDeleteRole, usePermissionCatalog, useRenameRole, useRoles, useSaveRolePermissions } from '@/lib/queries'
import type { RoleDto } from '@/shared'

/** New role, or rename when `role` is given. */
function RoleNameDialog({ role, onClose }: { role?: RoleDto; onClose: () => void }) {
  const create = useCreateRole()
  const rename = useRenameRole()
  const [name, setName] = useState(role?.name ?? '')
  const pending = create.isPending || rename.isPending
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{role ? `Rename ${role.name}` : 'New role'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="role-name">Role name</Label>
          <Input id="role-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <DialogFooter>
          <Button
            disabled={name.trim().length < 2 || pending}
            onClick={async () => {
              if (role) await rename.mutateAsync({ id: role.id, name: name.trim() })
              else await create.mutateAsync(name.trim())
              onClose()
            }}
          >
            {role ? 'Save' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function RolePermissionsDialog({ role, canManage, onClose }: { role: RoleDto; canManage: boolean; onClose: () => void }) {
  const { data: catalog } = usePermissionCatalog()
  const save = useSaveRolePermissions()
  const [map, setMap] = useState<GrantMap>(grantsToMap(role.grants))

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{role.name} · permissions</DialogTitle>
          <DialogDescription>
            {!canManage
              ? 'View only — role defaults are managed by the business owner or root admin.'
              : role.isSystem
                ? 'System template — saving creates an editable copy for this business.'
                : 'Business role defaults.'}
          </DialogDescription>
        </DialogHeader>
        {catalog ? <PermissionMatrix catalog={catalog} value={map} onChange={setMap} disabled={!canManage} /> : <p className="text-sm text-muted-foreground">Loading…</p>}
        {canManage && (
          <DialogFooter>
            <Button
              disabled={save.isPending}
              onClick={async () => {
                await save.mutateAsync({ id: role.id, grants: mapToGrants(map) })
                onClose()
              }}
            >
              Save role defaults
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}

export function Roles() {
  const { me } = useAuth()
  const canManage = !!me && (me.isOwner || me.branch?.parentId === null)
  const { data, isLoading } = useRoles()
  const del = useDeleteRole()
  const [creating, setCreating] = useState(false)
  const [renaming, setRenaming] = useState<RoleDto | null>(null)
  const [editing, setEditing] = useState<RoleDto | null>(null)
  const [q, setQ] = useState('')
  const needle = q.trim().toLowerCase()
  const rows = (data ?? []).filter((r) => !needle || r.name.toLowerCase().includes(needle))

  const columns: ColumnDef<RoleDto, unknown>[] = [
    { accessorKey: 'name', header: 'Role' },
    { accessorKey: 'isSystem', header: 'Type', cell: ({ row }) => <Badge variant={row.original.isSystem ? 'secondary' : 'default'}>{row.original.isSystem ? 'System' : 'Business'}</Badge> },
    { accessorKey: 'userCount', header: 'Users' },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const r = row.original
        return (
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditing(r)}>Permissions</Button>
            {canManage && !r.isSystem && (
              <>
                <Button variant="ghost" size="sm" onClick={() => setRenaming(r)}>Rename</Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  disabled={r.userCount > 0 || del.isPending}
                  title={r.userCount > 0 ? 'Move its users to another role first' : undefined}
                  onClick={() => {
                    if (window.confirm(`Delete role ${r.name}?`)) del.mutate(r.id)
                  }}
                >
                  Delete
                </Button>
              </>
            )}
          </div>
        )
      },
    },
  ]

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1>Roles & Permissions</h1>
          <p className="mt-1 text-sm text-muted-foreground">Define what each role can view, add, edit and delete.</p>
        </div>
        {canManage && <Button onClick={() => setCreating(true)}>New role</Button>}
      </div>
      <Input className="max-w-xs" aria-label="Search roles" placeholder="Search role name…" value={q} onChange={(e) => setQ(e.target.value)} />
      <DataTable columns={columns} data={rows} isLoading={isLoading} />
      {creating && <RoleNameDialog onClose={() => setCreating(false)} />}
      {renaming && <RoleNameDialog role={renaming} onClose={() => setRenaming(null)} />}
      {editing && <RolePermissionsDialog role={editing} canManage={canManage} onClose={() => setEditing(null)} />}
    </div>
  )
}
