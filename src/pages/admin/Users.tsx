import type { ColumnDef } from '@tanstack/react-table'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'

import { DataTable } from '@/components/DataTable'
import { PermissionMatrix, grantsToMap, mapToGrants, type GrantMap } from '@/components/PermissionMatrix'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  useBranches,
  useCreateUser,
  usePermissionCatalog,
  useResetUserPassword,
  useRoles,
  useSaveUserPermissions,
  useSetUserStatus,
  useUpdateUser,
  useUserPermissions,
  useUsers,
} from '@/lib/queries'
import type { BranchNodeDto, UserDto } from '@/shared'

const flatten = (n: BranchNodeDto, out: BranchNodeDto[] = []): BranchNodeDto[] => {
  out.push(n)
  n.children.forEach((c) => flatten(c, out))
  return out
}

type UserForm = {
  name: string
  username?: string
  password?: string
  email?: string
  mobile?: string
  level: 'ADMIN' | 'BRANCH_USER'
  branchId: number
  roleId?: number
  viewDaysLimit?: number | null
}

function UserDialog({ user, onClose }: { user?: UserDto; onClose: () => void }) {
  const { data: root } = useBranches()
  const { data: roles } = useRoles()
  const create = useCreateUser()
  const update = useUpdateUser()
  const branches = root ? flatten(root) : []

  const { register, handleSubmit, watch, setValue, formState } = useForm<UserForm>({
    defaultValues: user
      ? { name: user.name, email: user.email ?? undefined, mobile: user.mobile ?? undefined, level: user.level, branchId: user.branch.id, roleId: user.role?.id, viewDaysLimit: user.viewDaysLimit }
      : { level: 'BRANCH_USER', viewDaysLimit: null },
  })

  const onSubmit = handleSubmit(async (v) => {
    const common = {
      name: v.name,
      email: v.email || undefined,
      mobile: v.mobile || undefined,
      level: v.level,
      branchId: Number(v.branchId),
      roleId: v.roleId ? Number(v.roleId) : undefined,
      viewDaysLimit: v.viewDaysLimit ? Number(v.viewDaysLimit) : null,
    }
    if (user) await update.mutateAsync({ id: user.id, body: common })
    else await create.mutateAsync({ ...common, username: v.username, password: v.password })
    onClose()
  })

  const adminAllowed = branches.find((b) => b.id === Number(watch('branchId')))?.isAdminNode

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{user ? `Edit ${user.name}` : 'New user'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="u-name">Full name</Label>
            <Input id="u-name" {...register('name', { required: true })} />
          </div>
          {!user && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="u-user">Username</Label>
                <Input id="u-user" {...register('username', { required: true })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="u-pass">Password</Label>
                <Input id="u-pass" type="text" {...register('password', { required: true, minLength: 8 })} />
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="u-email">Email</Label>
              <Input id="u-email" type="email" {...register('email')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="u-mobile">Mobile</Label>
              <Input id="u-mobile" {...register('mobile')} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Branch</Label>
              <Select value={watch('branchId') ? String(watch('branchId')) : ''} onValueChange={(v) => setValue('branchId', Number(v), { shouldValidate: true })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select branch" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={String(b.id)}>
                      {'— '.repeat(b.depth)}
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Level</Label>
              <Select value={watch('level')} onValueChange={(v) => setValue('level', v as UserForm['level'])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BRANCH_USER">Branch user</SelectItem>
                  <SelectItem value="ADMIN" disabled={!adminAllowed}>
                    Admin {adminAllowed ? '' : '(needs admin-node branch)'}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={watch('roleId') ? String(watch('roleId')) : ''} onValueChange={(v) => setValue('roleId', Number(v))}>
                <SelectTrigger>
                  <SelectValue placeholder="No role" />
                </SelectTrigger>
                <SelectContent>
                  {roles?.map((r) => (
                    <SelectItem key={r.id} value={String(r.id)}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="u-days">View-days limit</Label>
              <Input id="u-days" type="number" placeholder="Unlimited" {...register('viewDaysLimit')} />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={!formState.isValid && formState.isSubmitted}>
              {user ? 'Save changes' : 'Create user'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ResetPasswordDialog({ user, onClose }: { user: UserDto; onClose: () => void }) {
  const reset = useResetUserPassword()
  const [password, setPassword] = useState('')
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset password · {user.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="r-pass">New password</Label>
          <Input id="r-pass" type="text" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <DialogFooter>
          <Button
            disabled={password.length < 8 || reset.isPending}
            onClick={async () => {
              await reset.mutateAsync({ id: user.id, password })
              onClose()
            }}
          >
            Reset
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function PermissionsDialog({ user, onClose }: { user: UserDto; onClose: () => void }) {
  const { data: catalog } = usePermissionCatalog()
  const { data: perms, isLoading } = useUserPermissions(user.id)
  const save = useSaveUserPermissions()
  const [map, setMap] = useState<GrantMap>({})

  useEffect(() => {
    if (perms) setMap(grantsToMap(perms.effective))
  }, [perms])

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Permissions · {user.name}</DialogTitle>
          <DialogDescription>Effective access (role defaults + per-user overrides). Edit/Delete imply View.</DialogDescription>
        </DialogHeader>
        {isLoading || !catalog ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <PermissionMatrix catalog={catalog} value={map} onChange={setMap} overriddenKeys={perms?.overriddenKeys} />
        )}
        <DialogFooter>
          <Button
            disabled={save.isPending}
            onClick={async () => {
              await save.mutateAsync({ id: user.id, grants: mapToGrants(map) })
              onClose()
            }}
          >
            Save permissions
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const statusVariant = (s: UserDto['status']) => (s === 'ACTIVE' ? 'default' : s === 'BLOCKED' ? 'destructive' : 'secondary')

export function Users() {
  const [page, setPage] = useState(1)
  const { data, isLoading } = useUsers({ page })
  const setStatus = useSetUserStatus()
  const [editing, setEditing] = useState<UserDto | null>(null)
  const [creating, setCreating] = useState(false)
  const [resetting, setResetting] = useState<UserDto | null>(null)
  const [permsFor, setPermsFor] = useState<UserDto | null>(null)

  const columns: ColumnDef<UserDto, unknown>[] = [
    { accessorKey: 'name', header: 'Name', cell: ({ row }) => <span className="font-medium">{row.original.name}{row.original.isOwner && <Badge className="ml-2" variant="secondary">owner</Badge>}</span> },
    { accessorKey: 'username', header: 'Username' },
    { accessorKey: 'level', header: 'Level' },
    { header: 'Branch', cell: ({ row }) => row.original.branch.name },
    { header: 'Role', cell: ({ row }) => row.original.role?.name ?? '—' },
    { accessorKey: 'status', header: 'Status', cell: ({ row }) => <Badge variant={statusVariant(row.original.status)}>{row.original.status}</Badge> },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const u = row.original
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">Actions</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setEditing(u)}>Edit</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setPermsFor(u)}>Permissions</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setResetting(u)}>Reset password</DropdownMenuItem>
              {!u.isOwner &&
                (u.status === 'BLOCKED' ? (
                  <DropdownMenuItem onClick={() => setStatus.mutate({ id: u.id, action: 'unblock' })}>Unblock</DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => setStatus.mutate({ id: u.id, action: 'block' })}>Block</DropdownMenuItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Users</h1>
        <Button onClick={() => setCreating(true)}>New user</Button>
      </div>
      <DataTable
        columns={columns}
        data={data?.items ?? []}
        isLoading={isLoading}
        pagination={data ? { page: data.page, pageSize: data.pageSize, total: data.total, onPage: setPage } : undefined}
      />
      {creating && <UserDialog onClose={() => setCreating(false)} />}
      {editing && <UserDialog user={editing} onClose={() => setEditing(null)} />}
      {resetting && <ResetPasswordDialog user={resetting} onClose={() => setResetting(null)} />}
      {permsFor && <PermissionsDialog user={permsFor} onClose={() => setPermsFor(null)} />}
    </div>
  )
}
