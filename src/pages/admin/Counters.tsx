import { Building2, Pencil, Store, type LucideIcon } from 'lucide-react'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useT } from '@/lib/i18n'
import { useBranches, useCounters, useCreateCounter, useRenameCounter } from '@/lib/queries'
import type { BranchNodeDto, CounterDto } from '@/shared'

const flatten = (n: BranchNodeDto, out: BranchNodeDto[] = []): BranchNodeDto[] => {
  out.push(n)
  n.children.forEach((c) => flatten(c, out))
  return out
}

function RenameDialog({ counter, onClose }: { counter: CounterDto; onClose: () => void }) {
  const t = useT()
  const rename = useRenameCounter()
  const [name, setName] = useState(counter.name)
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('counters.rename_title', { name: counter.name })}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault()
            await rename.mutateAsync({ id: counter.id, name: name.trim() })
            onClose()
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="c-rename">{t('counters.name_label')}</Label>
            <Input id="c-rename" autoFocus maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={!name.trim() || rename.isPending}>{t('common.save')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** Billing counters per branch (TASK-94a): list, add, rename. The API has no delete/deactivate. */
export function Counters() {
  const t = useT()
  const { data: root } = useBranches()
  const branches = root ? flatten(root) : []
  const [filter, setFilter] = useState('')
  const { data: counters, isLoading } = useCounters(filter ? Number(filter) : undefined)
  const create = useCreateCounter()
  const [branchId, setBranchId] = useState('')
  const [name, setName] = useState('')
  const [editing, setEditing] = useState<CounterDto | null>(null)

  const rows = counters ?? []
  const branchCount = new Set(rows.map((c) => c.branchId)).size
  const branchSelect = (value: string, onChange: (v: string) => void, label: string, withAll: boolean) => (
    <Select value={value || (withAll ? 'all' : '')} onValueChange={(v) => onChange(v === 'all' ? '' : v)}>
      <SelectTrigger className="w-52" aria-label={label}>
        <SelectValue placeholder={t('counters.select_branch')} />
      </SelectTrigger>
      <SelectContent>
        {withAll && <SelectItem value="all">{t('counters.all_branches')}</SelectItem>}
        {branches.map((b) => (
          <SelectItem key={b.id} value={String(b.id)}>
            {'— '.repeat(b.depth)}
            {b.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
  const tile = (label: string, value: string, Icon: LucideIcon) => (
    <Card className="gap-2 hover:-translate-y-1">
      <CardHeader className="flex flex-row items-center justify-between pb-1">
        <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</CardTitle>
        <span className="icon-chip"><Icon className="size-5" aria-hidden /></span>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-extrabold tracking-tight tabular-nums">{value}</div>
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-8">
      <div>
        <h1>{t('counters.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('counters.subtitle')}</p>
      </div>

      <div className="stagger grid gap-4 sm:grid-cols-2">
        {tile(t('counters.title'), counters ? String(rows.length) : '—', Store)}
        {tile(t('counters.tile_branches'), counters ? String(branchCount) : '—', Building2)}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('counters.add')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={async (e) => {
              e.preventDefault()
              await create.mutateAsync({ branchId: Number(branchId), name: name.trim() })
              setName('')
            }}
          >
            <div className="space-y-1.5">
              <Label>{t('dash.branch')}</Label>
              {branchSelect(branchId, setBranchId, 'Counter branch', false)}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-name">{t('counters.name_label')}</Label>
              <Input id="c-name" className="w-56" maxLength={60} placeholder={t('counters.name_placeholder')} value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <Button type="submit" disabled={!branchId || !name.trim() || create.isPending}>
              {create.isPending ? t('counters.adding') : t('counters.add')}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle>{t('counters.all')}</CardTitle>
          {branchSelect(filter, setFilter, 'Filter by branch', true)}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
          ) : rows.length ? (
            <ul className="divide-y">
              {rows.map((c) => (
                <li key={c.id} className="flex items-center gap-3 py-2">
                  <span className="font-medium">{c.name}</span>
                  <span className="text-sm text-muted-foreground">{c.branchName}</span>
                  {!c.isActive && <Badge variant="destructive">{t('counters.inactive')}</Badge>}
                  <Button className="ml-auto" variant="ghost" size="sm" aria-label={`Rename ${c.name}`} onClick={() => setEditing(c)}>
                    <Pencil className="size-4" aria-hidden /> {t('counters.rename')}
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">{t('counters.empty')}</p>
          )}
        </CardContent>
      </Card>

      {editing && <RenameDialog counter={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}
