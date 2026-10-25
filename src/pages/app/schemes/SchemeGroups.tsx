import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAuth } from '@/lib/auth'
import { useCreateGroup, useSchemeGroups, useSchemes } from '@/lib/schemesQueries'

const n = (s: string) => Number(s) || 0

function NewGroupDialog({ schemeId, schemes }: { schemeId: number; schemes: { id: number; name: string }[] }) {
  const create = useCreateGroup()
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ schemeId: schemeId ? String(schemeId) : '', name: '', memberLimit: '' })
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }))
  const valid = !!f.schemeId && f.name.trim().length >= 1
  const submit = async () => {
    await create.mutateAsync({ schemeId: Number(f.schemeId), name: f.name.trim(), memberLimit: f.memberLimit ? n(f.memberLimit) : undefined })
    setOpen(false); setF({ schemeId: f.schemeId, name: '', memberLimit: '' })
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button>New group</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New group</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>Scheme</Label>
            <Select value={f.schemeId} onValueChange={(v) => set('schemeId', v)}><SelectTrigger aria-label="Scheme"><SelectValue placeholder="Select scheme" /></SelectTrigger>
              <SelectContent>{schemes.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="space-y-1.5"><Label htmlFor="gr-name">Group name</Label><Input id="gr-name" value={f.name} onChange={(e) => set('name', e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="gr-limit">Member limit (optional)</Label><Input id="gr-limit" type="number" value={f.memberLimit} onChange={(e) => set('memberLimit', e.target.value)} /></div>
        </div>
        <DialogFooter><Button disabled={!valid || create.isPending} onClick={() => void submit().catch(() => {})}>{create.isPending ? 'Saving…' : 'Create'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function SchemeGroups() {
  const { can } = useAuth()
  const canEdit = can('schemes.groups', 'edit')
  const [schemeId, setSchemeId] = useState('')
  const { data: schemes } = useSchemes({ active: 'true', pageSize: 100 })
  const { data: groups, isLoading } = useSchemeGroups(schemeId ? Number(schemeId) : undefined)
  const schemeOpts = schemes?.items.map((s) => ({ id: s.id, name: s.name })) ?? []

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={schemeId || 'all'} onValueChange={(v) => setSchemeId(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-56" aria-label="Scheme filter"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All schemes</SelectItem>{schemeOpts.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
        </Select>
        {canEdit && <div className="ml-auto"><NewGroupDialog schemeId={schemeId ? Number(schemeId) : 0} schemes={schemeOpts} /></div>}
      </div>
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader><TableRow><TableHead>Group</TableHead><TableHead>Members</TableHead><TableHead>Limit</TableHead></TableRow></TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={3} className="h-16 text-center text-muted-foreground">Loading…</TableCell></TableRow>
              : groups?.length ? groups.map((g) => (
                <TableRow key={g.id}><TableCell className="font-medium">{g.name}</TableCell><TableCell>{g.memberCount}</TableCell><TableCell>{g.memberLimit ?? '—'}</TableCell></TableRow>
              )) : <TableRow><TableCell colSpan={3} className="h-16 text-center text-muted-foreground">{schemeId ? 'No groups' : 'Pick a scheme to see its groups'}</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
