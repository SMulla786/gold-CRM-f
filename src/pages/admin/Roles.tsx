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
import { useCreateRole, usePermissionCatalog, useRoles, useSaveRolePermissions } from '@/lib/queries'
import type { RoleDto } from '@/shared'

function CreateRoleDialog({ onClose }: { onClose: () => void }) {
  const create = useCreateRole()
  const [name, setName] = useState('')
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New role</DialogTitle>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="role-name">Role name</Label>
          <Input id="role-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <DialogFooter>
          <Button
            disabled={name.trim().length < 2 || create.isPending}
            onClick={async () => {
              await create.mutateAsync(name.trim())
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
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<RoleDto | null>(null)

  const columns: ColumnDef<RoleDto, unknown>[] = [
    { accessorKey: 'name', header: 'Role' },
    { accessorKey: 'isSystem', header: 'Type', cell: ({ row }) => <Badge variant={row.original.isSystem ? 'secondary' : 'default'}>{row.original.isSystem ? 'System' : 'Business'}</Badge> },
    { accessorKey: 'userCount', header: 'Users' },
    { id: 'actions', header: '', cell: ({ row }) => <Button variant="outline" size="sm" onClick={() => setEditing(row.original)}>Permissions</Button> },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Roles & Permissions</h1>
        {canManage && <Button onClick={() => setCreating(true)}>New role</Button>}
      </div>
      <DataTable columns={columns} data={data ?? []} isLoading={isLoading} />
      {creating && <CreateRoleDialog onClose={() => setCreating(false)} />}
      {editing && <RolePermissionsDialog role={editing} canManage={canManage} onClose={() => setEditing(null)} />}
    </div>
  )
}
