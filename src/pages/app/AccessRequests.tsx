import { KeyRound } from 'lucide-react'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useT } from '@/lib/i18n'
import { useCreateEnquiry, useMyEnquiries } from '@/lib/queries'
import { MODULES, type PermissionEnquiryDto } from '@/shared'

const date = (s: string) => new Date(s).toLocaleDateString('en-IN')
// Flat page catalogue for the picker (module · page) — pages with actions can be requested for V/E/D.
const PAGES = MODULES.flatMap((m) => m.pages.filter((p) => p.actions).map((p) => ({ key: p.key, label: `${m.label} · ${p.label}` })))
const acts = (e: PermissionEnquiryDto, t: (k: string) => string) =>
  [e.view && t('access.view'), e.edit && t('common.edit'), e.delete && t('common.delete')].filter(Boolean).join(' · ') || '—'
const statusVariant = (s: string) => (s === 'APPROVED' ? 'default' : s === 'REJECTED' ? 'destructive' : 'secondary')

function RequestAccessDialog({ defaultKey, onClose }: { defaultKey?: string; onClose: () => void }) {
  const t = useT()
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
        <DialogHeader><DialogTitle>{t('access.request')}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t('access.page')}</Label>
            <Select value={permissionKey} onValueChange={setPermissionKey}>
              <SelectTrigger aria-label="Page"><SelectValue placeholder={t('access.select_page')} /></SelectTrigger>
              <SelectContent>{PAGES.map((p) => <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm has-[[data-state=checked]]:border-brand has-[[data-state=checked]]:bg-brand/10"><Checkbox checked={view} onCheckedChange={(v) => setView(v === true)} aria-label="View" /> {t('access.view')}</label>
            <label className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm has-[[data-state=checked]]:border-brand has-[[data-state=checked]]:bg-brand/10"><Checkbox checked={edit} onCheckedChange={(v) => setEdit(v === true)} aria-label="Edit" /> {t('common.edit')}</label>
            <label className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm has-[[data-state=checked]]:border-brand has-[[data-state=checked]]:bg-brand/10"><Checkbox checked={del} onCheckedChange={(v) => setDel(v === true)} aria-label="Delete" /> {t('common.delete')}</label>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ar-reason">{t('access.reason')}</Label>
            <Input id="ar-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button disabled={!valid || create.isPending} onClick={submit}>{create.isPending ? t('access.sending') : t('access.send')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function AccessRequests() {
  const t = useT()
  const { data, isLoading } = useMyEnquiries()
  const [open, setOpen] = useState(false)
  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1>{t('access.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('access.subtitle')}</p>
        </div>
        <Button onClick={() => setOpen(true)}><KeyRound aria-hidden />{t('access.request')}</Button>
      </header>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow><TableHead className="pl-6">{t('access.page')}</TableHead><TableHead>{t('access.col_requested')}</TableHead><TableHead>{t('stock.col_status')}</TableHead><TableHead>{t('access.col_decision')}</TableHead><TableHead>{t('udhari.date')}</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={5} className="h-16 text-center text-muted-foreground">{t('common.loading')}</TableCell></TableRow>
              : data?.length ? data.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="pl-6 font-medium">{e.permissionLabel}</TableCell>
                  <TableCell>{acts(e, t)}</TableCell>
                  <TableCell><Badge variant={statusVariant(e.status)}>{e.status}</Badge></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{e.decidedBy ? `${e.decidedBy}${e.decisionNote ? ` — ${e.decisionNote}` : ''}` : '—'}</TableCell>
                  <TableCell>{date(e.createdAt)}</TableCell>
                </TableRow>
              )) : <TableRow><TableCell colSpan={5} className="h-16 text-center text-muted-foreground">{t('access.empty')}</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>

      {open && <RequestAccessDialog onClose={() => setOpen(false)} />}
    </div>
  )
}
