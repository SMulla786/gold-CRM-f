import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useCreateEnquiry, useMyEnquiries } from '@/lib/queries'
import { MODULES, type PermissionEnquiryDto } from '@/shared'

const date = (s: string) => new Date(s).toLocaleDateString('en-IN')
// Flat page catalogue for the picker (module · page) — pages with actions can be requested for V/E/D.
const PAGES = MODULES.flatMap((m) => m.pages.filter((p) => p.actions).map((p) => ({ key: p.key, label: `${m.label} · ${p.label}` })))
const acts = (e: PermissionEnquiryDto) => [e.view && 'View', e.edit && 'Edit', e.delete && 'Delete'].filter(Boolean).join(' · ') || '—'
const statusVariant = (s: string) => (s === 'APPROVED' ? 'default' : s === 'REJECTED' ? 'destructive' : 'secondary')

function RequestAccessDialog({ defaultKey, onClose }: { defaultKey?: string; onClose: () => void }) {
  const create = useCreateEnquiry()
  const [permissionKey, setPermissionKey] = useState(defaultKey ?? '')
  const [view, setView] = useState(true)
  const [edit, setEdit] = useState(false)
  const [del, setDel] = useState(false)
  const [reason, setReason] = useState('')
  const valid = !!permissionKey && (view || edit || del)

  const submit = async () => {
    await create.mutateAsync({ permissionKey, view, edit, delete: del, reason: reason.trim() || undefined })
    onClose()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Request access</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Page</Label>
            <Select value={permissionKey} onValueChange={setPermissionKey}>
              <SelectTrigger aria-label="Page"><SelectValue placeholder="Select a page" /></SelectTrigger>
              <SelectContent>{PAGES.map((p) => <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={view} onCheckedChange={(v) => setView(v === true)} aria-label="View" /> View</label>
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={edit} onCheckedChange={(v) => setEdit(v === true)} aria-label="Edit" /> Edit</label>
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={del} onCheckedChange={(v) => setDel(v === true)} aria-label="Delete" /> Delete</label>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ar-reason">Reason (optional)</Label>
            <Input id="ar-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button disabled={!valid || create.isPending} onClick={submit}>{create.isPending ? 'Sending…' : 'Send request'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function AccessRequests() {
  const { data, isLoading } = useMyEnquiries()
  const [open, setOpen] = useState(false)
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Access requests</h1>
        <Button onClick={() => setOpen(true)}>Request access</Button>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow><TableHead>Page</TableHead><TableHead>Requested</TableHead><TableHead>Status</TableHead><TableHead>Decision</TableHead><TableHead>Date</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={5} className="h-16 text-center text-muted-foreground">Loading…</TableCell></TableRow>
              : data?.length ? data.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{e.permissionLabel}</TableCell>
                  <TableCell>{acts(e)}</TableCell>
                  <TableCell><Badge variant={statusVariant(e.status)}>{e.status}</Badge></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{e.decidedBy ? `${e.decidedBy}${e.decisionNote ? ` — ${e.decisionNote}` : ''}` : '—'}</TableCell>
                  <TableCell>{date(e.createdAt)}</TableCell>
                </TableRow>
              )) : <TableRow><TableCell colSpan={5} className="h-16 text-center text-muted-foreground">No requests yet.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>

      {open && <RequestAccessDialog onClose={() => setOpen(false)} />}
    </div>
  )
}
