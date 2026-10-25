import { ChevronDown, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAuth } from '@/lib/auth'
import { useAddBranch, useBranches, useMoveBranch, useUpdateBranch } from '@/lib/queries'
import type { BranchNodeDto } from '@/shared'

const flatten = (n: BranchNodeDto, out: BranchNodeDto[] = []): BranchNodeDto[] => {
  out.push(n)
  n.children.forEach((c) => flatten(c, out))
  return out
}

type BranchForm = { name: string; code?: string; isAdminNode: boolean; isActive?: boolean }

function BranchDialog({
  title,
  initial,
  onSubmit,
  onClose,
  showActive,
}: {
  title: string
  initial?: Partial<BranchForm>
  onSubmit: (v: BranchForm) => Promise<void>
  onClose: () => void
  showActive?: boolean
}) {
  const { register, handleSubmit, watch, setValue } = useForm<BranchForm>({
    defaultValues: { isAdminNode: false, isActive: true, ...initial },
  })
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={handleSubmit(async (v) => {
            await onSubmit(v)
            onClose()
          })}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="b-name">Branch name</Label>
            <Input id="b-name" {...register('name', { required: true, minLength: 2 })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="b-code">Code</Label>
            <Input id="b-code" {...register('code')} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={watch('isAdminNode')} onCheckedChange={(v) => setValue('isAdminNode', Boolean(v))} />
            Branch-admin node (can manage sub-branches & users)
          </label>
          {showActive && (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={watch('isActive')} onCheckedChange={(v) => setValue('isActive', Boolean(v))} />
              Active
            </label>
          )}
          <DialogFooter>
            <Button type="submit">Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function MoveDialog({ node, all, onClose }: { node: BranchNodeDto; all: BranchNodeDto[]; onClose: () => void }) {
  const move = useMoveBranch()
  const [parentId, setParentId] = useState('')
  // Cannot move under itself or its own descendants.
  const candidates = all.filter((b) => b.id !== node.id && !b.path.startsWith(node.path))
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move “{node.name}”</DialogTitle>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label>New parent branch</Label>
          <Select value={parentId} onValueChange={setParentId}>
            <SelectTrigger aria-label="New parent branch">
              <SelectValue placeholder="Select parent" />
            </SelectTrigger>
            <SelectContent>
              {candidates.map((b) => (
                <SelectItem key={b.id} value={String(b.id)}>
                  {'— '.repeat(b.depth)}
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button
            disabled={!parentId || move.isPending}
            onClick={async () => {
              await move.mutateAsync({ id: node.id, newParentId: Number(parentId) })
              onClose()
            }}
          >
            Move
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function TreeRow({ node, all, collapsed, toggle }: { node: BranchNodeDto; all: BranchNodeDto[]; collapsed: Set<number>; toggle: (id: number) => void }) {
  const { me } = useAuth()
  const add = useAddBranch()
  const update = useUpdateBranch()
  const [dialog, setDialog] = useState<'add' | 'edit' | 'move' | null>(null)
  const hasChildren = node.children.length > 0
  const isCollapsed = collapsed.has(node.id)
  // Can't toggle admin-node on the business root or on the caller's own node (API rejects both).
  const canToggleAdmin = node.parentId !== null && node.id !== me?.branch?.id

  return (
    <>
      <div className="flex items-center gap-2 border-b py-2" style={{ paddingLeft: `${node.depth * 1.5 + 0.5}rem` }}>
        {hasChildren ? (
          <button onClick={() => toggle(node.id)} className="text-muted-foreground" aria-label={isCollapsed ? 'Expand' : 'Collapse'}>
            {isCollapsed ? <ChevronRight className="size-4" /> : <ChevronDown className="size-4" />}
          </button>
        ) : (
          <span className="inline-block size-4" />
        )}
        <span className="font-medium">{node.name}</span>
        {node.code && <span className="text-xs text-muted-foreground">{node.code}</span>}
        {node.isAdminNode && <Badge variant="secondary">admin node</Badge>}
        {!node.isActive && <Badge variant="destructive">inactive</Badge>}
        <span className="text-xs text-muted-foreground">· {node.userCount} users</span>
        <div className="ml-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                Actions
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setDialog('add')}>Add sub-branch</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setDialog('edit')}>Edit</DropdownMenuItem>
              {canToggleAdmin && (
                <DropdownMenuItem onClick={() => update.mutate({ id: node.id, body: { isAdminNode: !node.isAdminNode } })}>
                  {node.isAdminNode ? 'Revoke admin node' : 'Make admin node'}
                </DropdownMenuItem>
              )}
              {node.parentId !== null && <DropdownMenuItem onClick={() => setDialog('move')}>Move…</DropdownMenuItem>}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {!isCollapsed && node.children.map((c) => <TreeRow key={c.id} node={c} all={all} collapsed={collapsed} toggle={toggle} />)}

      {dialog === 'add' && (
        <BranchDialog
          title={`Add sub-branch under ${node.name}`}
          onClose={() => setDialog(null)}
          onSubmit={(v) => add.mutateAsync({ parentId: node.id, name: v.name, code: v.code || undefined, isAdminNode: v.isAdminNode }).then(() => {})}
        />
      )}
      {dialog === 'edit' && (
        <BranchDialog
          title={`Edit ${node.name}`}
          showActive
          initial={{ name: node.name, code: node.code ?? undefined, isAdminNode: node.isAdminNode, isActive: node.isActive }}
          onClose={() => setDialog(null)}
          onSubmit={(v) => update.mutateAsync({ id: node.id, body: { name: v.name, code: v.code || undefined, isAdminNode: v.isAdminNode, isActive: v.isActive } }).then(() => {})}
        />
      )}
      {dialog === 'move' && <MoveDialog node={node} all={all} onClose={() => setDialog(null)} />}
    </>
  )
}

export function Branches() {
  const { data: root, isLoading } = useBranches()
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set())
  const toggle = (id: number) =>
    setCollapsed((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  if (isLoading || !root) return <p className="text-sm text-muted-foreground">Loading…</p>
  const all = flatten(root)

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Branches</h1>
      <div className="rounded-md border">
        <TreeRow node={root} all={all} collapsed={collapsed} toggle={toggle} />
      </div>
    </div>
  )
}
