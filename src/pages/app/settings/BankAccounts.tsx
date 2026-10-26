import { zodResolver } from '@hookform/resolvers/zod'
import { Building2, CircleCheck, CircleOff, Landmark, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useBankAccounts, useDeleteBankAccount, useSaveBankAccount } from '@/lib/appQueries'
import { useAuth } from '@/lib/auth'
import { useBranches } from '@/lib/queries'
import { BANK_APPLY_TO, bankAccountBody, type BankAccountDto, type BranchNodeDto } from '@/shared'

const flatten = (n: BranchNodeDto, out: BranchNodeDto[] = []): BranchNodeDto[] => (out.push(n), n.children.forEach((c) => flatten(c, out)), out)
const APPLY_LABEL: Record<string, string> = { ALL: 'All sections', SYSTEM: 'System use', JUST_BILL: 'Just Bill', STOCK_BILL: 'Stock Bill', STOCK_AND_JUST_BILL: 'Stock + Just Bill' }

type BankIn = z.input<typeof bankAccountBody>
type BankOut = z.output<typeof bankAccountBody>

function BankDialog({ account, onClose }: { account?: BankAccountDto; onClose: () => void }) {
  const save = useSaveBankAccount()
  const { data: root } = useBranches()
  const branches = root ? flatten(root) : []
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<BankIn, unknown, BankOut>({
    resolver: zodResolver(bankAccountBody),
    defaultValues: account
      ? { branchId: account.branchId, bankName: account.bankName, branchName: account.bankBranchName ?? undefined, accountNo: account.accountNo, ifsc: account.ifsc, applyTo: account.applyTo, isActive: account.isActive }
      : { branchId: 0, applyTo: 'ALL', isActive: true },
  })

  const onSubmit = handleSubmit(async (v) => {
    await save.mutateAsync({ id: account?.id, body: v })
    onClose()
  })

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{account ? 'Edit bank account' : 'New bank account'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Applies to branch</Label>
            <Select value={String(watch('branchId') ?? 0)} onValueChange={(v) => setValue('branchId', Number(v))}>
              <SelectTrigger aria-label="Applies to branch">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">All branches</SelectItem>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={String(b.id)}>
                    {'— '.repeat(b.depth)}
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="bank">Bank name</Label>
              <Input id="bank" {...register('bankName')} />
              {errors.bankName && <p className="text-xs text-destructive">{errors.bankName.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bbranch">Bank branch</Label>
              <Input id="bbranch" {...register('branchName')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="acc">Account no.</Label>
              <Input id="acc" {...register('accountNo')} />
              {errors.accountNo && <p className="text-xs text-destructive">{errors.accountNo.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ifsc">IFSC</Label>
              <Input id="ifsc" {...register('ifsc')} />
              {errors.ifsc && <p className="text-xs text-destructive">{errors.ifsc.message}</p>}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Apply to</Label>
            <Select value={watch('applyTo')} onValueChange={(v) => setValue('applyTo', v as BankOut['applyTo'])}>
              <SelectTrigger aria-label="Apply to">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BANK_APPLY_TO.map((a) => (
                  <SelectItem key={a} value={a}>
                    {APPLY_LABEL[a]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={save.isPending}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function BankAccounts() {
  const { can } = useAuth()
  const canEdit = can('settings.misc', 'edit')
  const canDelete = can('settings.misc', 'delete')
  const { data, isLoading } = useBankAccounts()
  const del = useDeleteBankAccount()
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<BankAccountDto | null>(null)
  const [removing, setRemoving] = useState<BankAccountDto | null>(null)

  // Summary numbers derived from the list already fetched (no extra requests).
  const accounts = data ?? []
  const activeCount = accounts.filter((a) => a.isActive).length
  const allBranchCount = accounts.filter((a) => a.branchId === 0).length

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
          <h2 className="text-xl">Your banks</h2>
          <p className="text-sm text-muted-foreground">Accounts used to receive and record payments</p>
        </div>
        {canEdit && <Button onClick={() => setCreating(true)}>New bank account</Button>}
      </div>

      <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tile('Accounts on file', data ? String(accounts.length) : '—', 'Including deactivated', Landmark)}
        {tile('In use', data ? String(activeCount) : '—', data ? `of ${accounts.length} accounts` : undefined, CircleCheck)}
        {tile('Deactivated', data ? String(accounts.length - activeCount) : '—', 'Kept for history', CircleOff)}
        {tile('Every branch', data ? String(allBranchCount) : '—', 'Shared across all branches', Building2)}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <Card className="p-2">
          {data?.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <span className="icon-chip"><Landmark className="size-5" aria-hidden /></span>
              <p className="text-sm text-muted-foreground">No bank accounts</p>
            </div>
          )}
          <div className="divide-y">
            {data?.map((a) => (
              <div key={a.id} className="flex flex-wrap items-center gap-3 rounded-xl p-3 text-sm transition-colors hover:bg-muted/50">
                <span className="font-medium">{a.bankName}</span>
                <span className="text-muted-foreground tabular-nums">{a.accountNo} · {a.ifsc}</span>
                <Badge variant="secondary">{APPLY_LABEL[a.applyTo]}</Badge>
                <span className="text-muted-foreground">{a.branchId === 0 ? 'All branches' : a.branchName ?? `Branch ${a.branchId}`}</span>
                {!a.isActive && <Badge variant="destructive">Inactive</Badge>}
                <div className="ml-auto flex gap-2">
                  {canEdit && (
                    <Button variant="outline" size="sm" onClick={() => setEditing(a)}>
                      Edit
                    </Button>
                  )}
                  {canDelete && (
                    <Button variant="ghost" size="sm" onClick={() => setRemoving(a)}>
                      Remove
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
      {creating && <BankDialog onClose={() => setCreating(false)} />}
      {editing && <BankDialog account={editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={!!removing}
        title={`Remove ${removing?.bankName ?? ''}?`}
        description="The account is deactivated, not deleted."
        confirmLabel="Remove"
        destructive
        onConfirm={async () => { if (removing) await del.mutateAsync(removing.id) }}
        onClose={() => setRemoving(null)}
      />
    </div>
  )
}
