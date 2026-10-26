import { zodResolver } from '@hookform/resolvers/zod'
import type { ColumnDef } from '@tanstack/react-table'
import { Copy, Wand2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm, type Resolver } from 'react-hook-form'
import { toast } from 'sonner'

import { DataTable } from '@/components/DataTable'
import { PermissionMatrix, grantsToMap, mapToGrants, type GrantMap } from '@/components/PermissionMatrix'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/lib/auth'
import { createUserBody, updateUserBody } from '@/shared'
import {
  useBranches,
  useCreateUser,
  usePermissionCatalog,
  useResetUserMpin,
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

// No 0/O/1/l/I so credentials read back cleanly over the phone.
const CHARS = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const randomString = (len: number, chars = CHARS) => Array.from(crypto.getRandomValues(new Uint32Array(len)), (n) => chars[n % chars.length]).join('')

/** Username must match the contract (/^[a-z0-9._-]{3,40}$/, unique across all shops), hence the random suffix. */
function generateCredentials(name: string) {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '').slice(0, 30) || 'user'
  return { username: `${base}.${randomString(4, '23456789')}`, password: randomString(10) }
}

async function copyLoginDetails(shop: string, username: string, password: string) {
  const text = `Shop: ${shop}\nUsername: ${username}\nPassword: ${password}\nLogin: ${window.location.origin}/login`
  try {
    await navigator.clipboard.writeText(text)
    toast.success('Login details copied')
  } catch {
    toast.error('Could not copy - select and copy the details manually')
  }
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
  mpin?: string
}

function UserDialog({ user, onClose }: { user?: UserDto; onClose: () => void }) {
  const { me } = useAuth()
  const selfEdit = !!user && user.id === me?.id // can't change your own level/branch (API rejects it)
  const { data: root } = useBranches()
  const { data: roles } = useRoles()
  const create = useCreateUser()
  const update = useUpdateUser()
  const branches = root ? flatten(root) : []
  const [created, setCreated] = useState<{ username: string; password: string } | null>(null)
  const [limitUnit, setLimitUnit] = useState<'DAYS' | 'MONTHS'>('DAYS')

  const { register, handleSubmit, watch, setValue, getValues, formState } = useForm<UserForm>({
    // runtime schema differs by mode (create needs username/password); cast bridges the two typed resolvers.
    resolver: zodResolver(user ? updateUserBody : createUserBody) as Resolver<UserForm>,
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
      // Stored in days; the Months unit is 30 days each.
      viewDaysLimit: v.viewDaysLimit ? Number(v.viewDaysLimit) * (limitUnit === 'MONTHS' ? 30 : 1) : null,
    }
    if (user) {
      await update.mutateAsync({ id: user.id, body: common })
      return onClose()
    }
    const u = await create.mutateAsync({ ...common, username: v.username, password: v.password, mpin: v.mpin })
    setCreated({ username: u.username, password: v.password ?? '' })
  })

  const autoGenerate = () => {
    const c = generateCredentials(getValues('name') ?? '')
    setValue('username', c.username, { shouldValidate: formState.isSubmitted })
    setValue('password', c.password, { shouldValidate: formState.isSubmitted })
  }

  const adminAllowed = branches.find((b) => b.id === Number(watch('branchId')))?.isAdminNode

  if (created) {
    const shop = me?.business?.name ?? ''
    return (
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>User created</DialogTitle>
            <DialogDescription>Share these login details with the user. The password is not shown again.</DialogDescription>
          </DialogHeader>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-2xl border bg-muted/40 p-4 text-sm">
            <dt className="text-muted-foreground">Shop</dt>
            <dd className="font-medium">{shop}</dd>
            <dt className="text-muted-foreground">Username</dt>
            <dd className="font-mono">{created.username}</dd>
            <dt className="text-muted-foreground">Password</dt>
            <dd className="font-mono">{created.password}</dd>
            <dt className="text-muted-foreground">Login</dt>
            <dd className="break-all">{window.location.origin}/login</dd>
          </dl>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Done</Button>
            <Button onClick={() => copyLoginDetails(shop, created.username, created.password)}>
              <Copy className="size-4" aria-hidden /> Copy login details
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{user ? `Edit ${user.name}` : 'New user'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="u-name">Full name</Label>
            <Input id="u-name" {...register('name')} />
            {formState.errors.name && <p className="text-xs text-destructive">{formState.errors.name.message}</p>}
          </div>
          {!user && (
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium">Login credentials</p>
              <Button type="button" variant="outline" size="sm" onClick={autoGenerate}>
                <Wand2 className="size-4" aria-hidden /> Auto-generate
              </Button>
            </div>
          )}
          {!user && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="u-user">Username</Label>
                <Input id="u-user" {...register('username')} />
                {formState.errors.username && <p className="text-xs text-destructive">{formState.errors.username.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="u-pass">Password</Label>
                <Input id="u-pass" type="text" {...register('password')} />
                {formState.errors.password && <p className="text-xs text-destructive">{formState.errors.password.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="u-mpin">MPIN (optional)</Label>
                <Input id="u-mpin" inputMode="numeric" maxLength={4} placeholder="4 digits" autoComplete="off" {...register('mpin', { setValueAs: (v: string) => v?.trim() || undefined })} />
                {formState.errors.mpin && <p className="text-xs text-destructive">{formState.errors.mpin.message}</p>}
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
              <Select value={watch('branchId') ? String(watch('branchId')) : ''} onValueChange={(v) => setValue('branchId', Number(v), { shouldValidate: true })} disabled={selfEdit}>
                <SelectTrigger aria-label="Branch">
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
              <Select value={watch('level')} onValueChange={(v) => setValue('level', v as UserForm['level'])} disabled={selfEdit}>
                <SelectTrigger aria-label="Level">
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
                <SelectTrigger aria-label="Role">
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
              <Label htmlFor="u-days">View limit</Label>
              <div className="flex gap-2">
                <Input
                  id="u-days"
                  type="number"
                  min={1}
                  placeholder="Unlimited"
                  {...register('viewDaysLimit', { setValueAs: (v) => (v === '' || v == null ? null : Number(v)) })}
                />
                <Select value={limitUnit} onValueChange={(v) => setLimitUnit(v as 'DAYS' | 'MONTHS')}>
                  <SelectTrigger className="w-28" aria-label="View limit unit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DAYS">Days</SelectItem>
                    <SelectItem value="MONTHS">Months</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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

function ResetMpinDialog({ user, onClose }: { user: UserDto; onClose: () => void }) {
  const reset = useResetUserMpin()
  const [mpin, setMpin] = useState('')
  const valid = /^\d{4}$/.test(mpin)
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Set MPIN · {user.name}</DialogTitle>
          <DialogDescription>The user is asked for this PIN before sensitive edits and deletes. They can change it later from My account.</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="r-mpin">New MPIN</Label>
          <Input id="r-mpin" inputMode="numeric" maxLength={4} autoComplete="off" value={mpin} onChange={(e) => setMpin(e.target.value.replace(/\D/g, ''))} />
        </div>
        <DialogFooter>
          <Button
            disabled={!valid || reset.isPending}
            onClick={async () => {
              await reset.mutateAsync({ id: user.id, mpin })
              onClose()
            }}
          >
            Set MPIN
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
          {!!perms?.overriddenKeys.length && (
            <Button
              variant="outline"
              disabled={save.isPending}
              onClick={async () => {
                // Saving no overrides leaves the user on their role's defaults.
                if (!window.confirm(`Drop ${user.name}'s custom permissions and use the role defaults?`)) return
                await save.mutateAsync({ id: user.id, grants: [] })
                onClose()
              }}
            >
              Reset to role defaults
            </Button>
          )}
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

type StatusTab = 'ALL' | UserDto['status']
const STATUS_TABS: { value: StatusTab; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'BLOCKED', label: 'Blocked' },
  { value: 'DELETED', label: 'Trash' },
]
const statusParam = (t: StatusTab) => (t === 'ALL' ? undefined : t)

function useStatusCounts(): Record<StatusTab, number | undefined> {
  // pageSize 1: only `total` is read; the list endpoint has no separate counts route.
  const all = useUsers({ pageSize: 1 }).data?.total
  const active = useUsers({ pageSize: 1, status: 'ACTIVE' }).data?.total
  const blocked = useUsers({ pageSize: 1, status: 'BLOCKED' }).data?.total
  const deleted = useUsers({ pageSize: 1, status: 'DELETED' }).data?.total
  return { ALL: all, ACTIVE: active, BLOCKED: blocked, DELETED: deleted }
}

export function Users() {
  const { me } = useAuth()
  const [page, setPage] = useState(1)
  const [tab, setTab] = useState<StatusTab>('ALL')
  const [q, setQ] = useState('')
  const { data, isLoading } = useUsers({ page, status: statusParam(tab), q: q.trim() || undefined })
  const counts = useStatusCounts()
  const setStatus = useSetUserStatus()
  const [editing, setEditing] = useState<UserDto | null>(null)
  const [creating, setCreating] = useState(false)
  const [resetting, setResetting] = useState<UserDto | null>(null)
  const [mpinFor, setMpinFor] = useState<UserDto | null>(null)
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
        // Only the business owner may manage the owner row; nobody may block themselves.
        const canManage = !u.isOwner || me?.isOwner
        const canBlock = !u.isOwner && u.id !== me?.id
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">Actions</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {u.status === 'DELETED' ? (
                <DropdownMenuItem onClick={() => setStatus.mutate({ id: u.id, action: 'restore' })}>Restore</DropdownMenuItem>
              ) : (
                <>
                  {canManage && <DropdownMenuItem onClick={() => setEditing(u)}>Edit</DropdownMenuItem>}
                  {canManage && <DropdownMenuItem onClick={() => setPermsFor(u)}>Permissions</DropdownMenuItem>}
                  {canManage && <DropdownMenuItem onClick={() => setResetting(u)}>Reset password</DropdownMenuItem>}
                  {canManage && <DropdownMenuItem onClick={() => setMpinFor(u)}>Set MPIN</DropdownMenuItem>}
                  {canBlock &&
                    (u.status === 'BLOCKED' ? (
                      <DropdownMenuItem onClick={() => setStatus.mutate({ id: u.id, action: 'unblock' })}>Unblock</DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem onClick={() => setStatus.mutate({ id: u.id, action: 'block' })}>Block</DropdownMenuItem>
                    ))}
                  {canBlock && (
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => {
                        if (window.confirm(`Move ${u.name} to Trash? They are signed out and can't log in until restored.`)) setStatus.mutate({ id: u.id, action: 'delete' })
                      }}
                    >
                      Move to trash
                    </DropdownMenuItem>
                  )}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ]

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1>Users</h1>
          <p className="mt-1 text-sm text-muted-foreground">Staff logins, their roles and which branches they can work in.</p>
        </div>
        <Button onClick={() => setCreating(true)}>New user</Button>
      </div>
      <Tabs
        value={tab}
        onValueChange={(v) => {
          setTab(v as StatusTab)
          setPage(1)
        }}
      >
        <TabsList>
          {STATUS_TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value} className="gap-2">
              {t.label}
              <span className="rounded-full bg-muted px-2 text-xs tabular-nums text-muted-foreground">{counts[t.value] ?? '…'}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <Input
        className="max-w-xs"
        aria-label="Search users"
        placeholder="Search name or username…"
        value={q}
        onChange={(e) => {
          setQ(e.target.value)
          setPage(1)
        }}
      />
      <DataTable
        columns={columns}
        data={data?.items ?? []}
        isLoading={isLoading}
        pagination={data ? { page: data.page, pageSize: data.pageSize, total: data.total, onPage: setPage } : undefined}
      />
      {creating && <UserDialog onClose={() => setCreating(false)} />}
      {editing && <UserDialog user={editing} onClose={() => setEditing(null)} />}
      {resetting && <ResetPasswordDialog user={resetting} onClose={() => setResetting(null)} />}
      {mpinFor && <ResetMpinDialog user={mpinFor} onClose={() => setMpinFor(null)} />}
      {permsFor && <PermissionsDialog user={permsFor} onClose={() => setPermsFor(null)} />}
    </div>
  )
}
