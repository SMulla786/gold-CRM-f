import { useState } from 'react'
import { Layers, Target, Users, UsersRound, type LucideIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAuth } from '@/lib/auth'
import { useCreateGroup, useSchemeGroups, useSchemes } from '@/lib/schemesQueries'
import { ClientPager, useClientPage } from './ClientPager'

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
        <div className="grid gap-4">
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
  const [nameQ, setNameQ] = useState('')
  const { data: schemes } = useSchemes({ active: 'true', pageSize: 100 })
  // names for the Scheme column — groups of inactive schemes are listed too
  const { data: allSchemes } = useSchemes({ pageSize: 100 })
  const { data: allGroups, isLoading } = useSchemeGroups(schemeId ? Number(schemeId) : undefined)
  const schemeOpts = schemes?.items.map((s) => ({ id: s.id, name: s.name })) ?? []
  const schemeName = new Map((allSchemes?.items ?? []).map((s) => [s.id, s.name]))
  // group-name filter is client-side: the groups endpoint returns the full (unpaged) list
  const groups = allGroups?.filter((g) => g.name.toLowerCase().includes(nameQ.trim().toLowerCase()))
  const { pageRows, pager } = useClientPage(groups)

  const groupCount = groups?.length ?? 0
  const memberTotal = groups?.reduce((sum, g) => sum + g.memberCount, 0) ?? 0
  const limited = groups?.filter((g) => g.memberLimit != null) ?? []
  const capacity = limited.reduce((sum, g) => sum + (g.memberLimit ?? 0), 0)

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
          <h2 className="text-xl">Scheme groups</h2>
          <p className="text-sm text-muted-foreground">Batches of members enrolled together under a scheme.</p>
        </div>
        {canEdit && <NewGroupDialog schemeId={schemeId ? Number(schemeId) : 0} schemes={schemeOpts} />}
      </div>

      <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tile('Total groups', String(groupCount), schemeId ? 'In selected scheme' : 'Across all schemes', Layers)}
        {tile('Members enrolled', String(memberTotal), 'Across listed groups', Users)}
        {tile('Member capacity', limited.length ? String(capacity) : '—', `${limited.length} group${limited.length === 1 ? '' : 's'} with a limit`, Target)}
        {tile('Active schemes', String(schemeOpts.length), undefined, UsersRound)}
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 pt-6">
          <Select value={schemeId || 'all'} onValueChange={(v) => setSchemeId(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-56" aria-label="Scheme filter"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All schemes</SelectItem>{schemeOpts.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
          </Select>
          <Input className="max-w-xs" placeholder="Search group name…" aria-label="Group name" value={nameQ} onChange={(e) => setNameQ(e.target.value)} />
        </CardContent>
      </Card>

      <div className="overflow-x-auto rounded-3xl border bg-card shadow-sm">
        <Table>
          <TableHeader><TableRow><TableHead>Group</TableHead><TableHead>Scheme</TableHead><TableHead>Members</TableHead><TableHead>Limit</TableHead></TableRow></TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={4} className="h-16 text-center text-muted-foreground">Loading…</TableCell></TableRow>
              : groups?.length ? pageRows.map((g) => (
                <TableRow key={g.id}><TableCell className="font-medium">{g.name}</TableCell><TableCell>{schemeName.get(g.schemeId) ?? `#${g.schemeId}`}</TableCell><TableCell className="tabular-nums">{g.memberCount}</TableCell><TableCell className="tabular-nums">{g.memberLimit ?? '—'}</TableCell></TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={4} className="py-10">
                    <div className="flex flex-col items-center justify-center gap-3 text-center text-sm text-muted-foreground">
                      <span className="icon-chip"><Layers className="size-5" aria-hidden /></span>
                      {nameQ.trim() ? 'No groups match that name' : schemeId ? 'No groups' : 'No groups yet'}
                    </div>
                  </TableCell>
                </TableRow>
              )}
          </TableBody>
        </Table>
        <ClientPager {...pager} />
      </div>
    </div>
  )
}
