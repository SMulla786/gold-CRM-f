import { useAuth } from '@/lib/auth'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'

// Admin branch context -> X-Branch-Id. Hidden when the user has a single fixed branch.
export function BranchSwitcher() {
  const { me, activeBranch, setBranch } = useAuth()
  const t = useT()
  if (!me) return null
  const canSwitch = me.level === 'ADMIN' || me.accessibleBranches.length > 1
  if (!canSwitch) return null

  return (
    <select
      value={activeBranch}
      onChange={(e) => setBranch(e.target.value)}
      className={cn('h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring')}
      aria-label="Active branch"
    >
      {me.level === 'ADMIN' && <option value="all">{t('counters.all_branches')}</option>}
      {me.accessibleBranches.map((b) => (
        <option key={b.id} value={String(b.id)}>
          {' '.repeat(b.depth * 2)}
          {b.name}
        </option>
      ))}
    </select>
  )
}
