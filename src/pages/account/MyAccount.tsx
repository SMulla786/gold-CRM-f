import { KeyRound, UserRound } from 'lucide-react'

import { ChangeMpinCard, ChangePasswordCard } from '@/components/SecurityCards'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/lib/auth'

const LEVEL_LABEL: Record<string, string> = { SUPER_ADMIN: 'Platform admin', ADMIN: 'Admin', BRANCH_USER: 'Staff' }

/** Signed-in user's own profile + password/MPIN — open to every level (TASK-97: staff had no way to set an MPIN). */
export function MyAccount() {
  const { me } = useAuth()
  if (!me) return null
  const rows: [string, string][] = [
    ['Name', me.name],
    ['Username', me.username],
    ['Role', me.isOwner ? 'Owner' : (LEVEL_LABEL[me.level] ?? me.level)],
    ['Business', me.business?.name ?? '—'],
    ['Branch', me.branch?.name ?? '—'],
    ['Branches you can use', String(me.accessibleBranches.length)],
    ['MPIN', me.hasMpin ? 'Set' : 'Not set'],
  ]
  return (
    <div className="max-w-xl space-y-8">
      <div>
        <h1>My account</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your login details, password and MPIN.</p>
      </div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-1">
          <CardTitle>Profile</CardTitle>
          <span className="icon-chip"><UserRound className="size-5" aria-hidden /></span>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            {rows.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="font-medium">{v}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
      <h2 className="flex items-center gap-2 pt-2">
        <KeyRound className="size-5 text-brand" aria-hidden /> Security
      </h2>
      <ChangePasswordCard />
      <ChangeMpinCard />
    </div>
  )
}
