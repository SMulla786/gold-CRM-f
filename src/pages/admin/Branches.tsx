import { zodResolver } from '@hookform/resolvers/zod'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAuth } from '@/lib/auth'
import { useAddBranch, useAdminOverview, useBranches, useDistricts, useMoveBranch, useStates, useUpdateBranch } from '@/lib/queries'
import { BranchOverviewTable } from '@/pages/admin/AdminDashboard'
import { branchBody, type BranchNodeDto } from '@/shared'

const flatten = (n: BranchNodeDto, out: BranchNodeDto[] = []): BranchNodeDto[] => {
  out.push(n)
  n.children.forEach((c) => flatten(c, out))
  return out
}

const branchForm = branchBody.omit({ parentId: true }).extend({ isActive: z.boolean().optional() })
type BranchForm = z.input<typeof branchForm>
// Empty optional inputs must reach zod as undefined, or the mobile/GSTIN regexes reject ''.
const opt = { setValueAs: (v: string) => v?.trim() || undefined }
// Tree node -> dialog defaults (the API returns null for unset details).
const branchInitial = (n: BranchNodeDto): BranchForm => ({
  name: n.name,
  code: n.code ?? undefined,
  isAdminNode: n.isAdminNode,
  isActive: n.isActive,
  inchargeName: n.inchargeName ?? undefined,
  countryCode: n.countryCode ?? '+91',
  mobile: n.mobile ?? undefined,
  gstin: n.gstin ?? undefined,
  stateId: n.stateId ?? undefined,
  districtId: n.districtId ?? undefined,
  address: n.address ?? undefined,
  disclaimer: n.disclaimer ?? undefined,
})

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
  const { register, handleSubmit, watch, setValue, formState } = useForm<BranchForm>({
    resolver: zodResolver(branchForm),
    defaultValues: { isAdminNode: false, isActive: true, countryCode: '+91', ...initial },
  })
  const { data: states } = useStates()
  const stateId = watch('stateId')
  const { data: districts } = useDistricts(stateId ? Number(stateId) : undefined)
  const err = (k: keyof BranchForm) => formState.errors[k] && <p className="text-xs text-destructive">{formState.errors[k]?.message}</p>
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
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
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="b-name">Branch name</Label>
              <Input id="b-name" {...register('name')} />
              {err('name')}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="b-code">Code</Label>
              <Input id="b-code" {...register('code', opt)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="b-incharge">Incharge name</Label>
              <Input id="b-incharge" {...register('inchargeName', opt)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="b-mobile">Mobile</Label>
              <div className="flex gap-2">
                <Select value={watch('countryCode') ?? '+91'} onValueChange={(v) => setValue('countryCode', v)}>
                  <SelectTrigger className="w-24" aria-label="Country code">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {/* original branch form's list; keep an unlisted stored code selectable */}
                    {[...new Set(['+91', '+1', '+44', '+971', '+966', '+965', '+968', '+974', watch('countryCode') ?? '+91'])].map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input id="b-mobile" inputMode="numeric" {...register('mobile', opt)} />
              </div>
              {err('mobile')}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="b-gstin">GSTIN</Label>
            <Input id="b-gstin" {...register('gstin', { setValueAs: (v: string) => v?.trim().toUpperCase() || undefined })} />
            {err('gstin')}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>State</Label>
              <Select value={stateId ? String(stateId) : ''} onValueChange={(v) => { setValue('stateId', Number(v)); setValue('districtId', undefined) }}>
                <SelectTrigger aria-label="State">
                  <SelectValue placeholder="Select state" />
                </SelectTrigger>
                <SelectContent>
                  {states?.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>District</Label>
              <Select value={watch('districtId') ? String(watch('districtId')) : ''} onValueChange={(v) => setValue('districtId', Number(v))} disabled={!stateId}>
                <SelectTrigger aria-label="District">
                  <SelectValue placeholder="Select district" />
                </SelectTrigger>
                <SelectContent>
                  {districts?.map((d) => (
                    <SelectItem key={d.id} value={String(d.id)}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="b-address">Address</Label>
            <Input id="b-address" {...register('address', opt)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="b-disclaimer">Disclaimer</Label>
            <textarea id="b-disclaimer" rows={2} className="w-full rounded-md border bg-transparent px-3 py-2 text-sm" placeholder="Printed on this branch's bills" {...register('disclaimer', opt)} />
            {err('disclaimer')}
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

// Ids of nodes whose name matches `q`, plus every ancestor of a match (so the tree path stays visible).
const matchTree = (n: BranchNodeDto, q: string, out: Set<number>): boolean => {
  let hit = n.name.toLowerCase().includes(q)
  for (const c of n.children) if (matchTree(c, q, out)) hit = true
  if (hit) out.add(n.id)
  return hit
}

function TreeRow({
  node,
  all,
  collapsed,
  toggle,
  visible,
  stateName,
}: {
  node: BranchNodeDto
  all: BranchNodeDto[]
  collapsed: Set<number>
  toggle: (id: number) => void
  visible?: Set<number> | null
  stateName?: Map<number, string>
}) {
  const { me } = useAuth()
  const add = useAddBranch()
  const update = useUpdateBranch()
  const [dialog, setDialog] = useState<'add' | 'edit' | 'move' | null>(null)
  const hasChildren = node.children.length > 0
  // While searching, matches are always expanded so they can't hide under a collapsed parent.
  const isCollapsed = !visible && collapsed.has(node.id)
  const kids = visible ? node.children.filter((c) => visible.has(c.id)) : node.children
  const contact = [
    node.inchargeName,
    node.mobile ? `${node.countryCode ?? ''} ${node.mobile}`.trim() : null,
    node.stateId != null ? stateName?.get(node.stateId) : null,
  ].filter(Boolean)
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
        {contact.length > 0 && <span className="text-xs text-muted-foreground">· {contact.join(' · ')}</span>}
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

      {!isCollapsed && kids.map((c) => <TreeRow key={c.id} node={c} all={all} collapsed={collapsed} toggle={toggle} visible={visible} stateName={stateName} />)}

      {dialog === 'add' && (
        <BranchDialog
          title={`Add sub-branch under ${node.name}`}
          onClose={() => setDialog(null)}
          onSubmit={(v) => add.mutateAsync({ ...v, parentId: node.id, isActive: undefined }).then(() => {})}
        />
      )}
      {dialog === 'edit' && (
        <BranchDialog
          title={`Edit ${node.name}`}
          showActive
          initial={branchInitial(node)}
          onClose={() => setDialog(null)}
          onSubmit={(v) => update.mutateAsync({ id: node.id, body: v }).then(() => {})}
        />
      )}
      {dialog === 'move' && <MoveDialog node={node} all={all} onClose={() => setDialog(null)} />}
    </>
  )
}

export function Branches() {
  const { data: root, isLoading } = useBranches()
  const [showOverview, setShowOverview] = useState(false)
  const { data: overview } = useAdminOverview()
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set())
  const [search, setSearch] = useState('')
  const { data: states } = useStates()
  const stateName = new Map((states ?? []).map((s) => [s.id, s.name]))
  const toggle = (id: number) =>
    setCollapsed((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  if (isLoading || !root) return <p className="text-sm text-muted-foreground">Loading…</p>
  const all = flatten(root)
  const q = search.trim().toLowerCase()
  const visible = q ? new Set<number>() : null
  const anyMatch = visible ? matchTree(root, q, visible) : true

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1>Branches</h1>
          <p className="mt-1 text-sm text-muted-foreground">Your branch tree — create branches, set the main branch and see each one’s stock.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowOverview((v) => !v)}>
          {showOverview ? 'Hide overview' : 'Branch overview'}
        </Button>
      </div>
      {showOverview && overview && <BranchOverviewTable rows={overview.branches} />}
      <Input className="max-w-xs" placeholder="Search branch name…" aria-label="Search branch name" value={search} onChange={(e) => setSearch(e.target.value)} />
      <div className="rounded-md border">
        {anyMatch ? (
          <TreeRow node={root} all={all} collapsed={collapsed} toggle={toggle} visible={visible} stateName={stateName} />
        ) : (
          <p className="py-6 text-center text-sm text-muted-foreground">No branch matches “{search.trim()}”</p>
        )}
      </div>
    </div>
  )
}
