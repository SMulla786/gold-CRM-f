import { useAuth } from '@/lib/auth'

/** Transactions (bills, udhar) post to one branch (X-Branch-Id); when the admin is on "All branches",
 *  force a concrete choice. Sets the active branch like BranchSwitcher (no "all" option here). */
export function SelectBranchForTxn({ note }: { note: string }) {
  const { me, setBranch } = useAuth()
  return (
    <div className="space-y-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
      <p>{note}</p>
      <select
        className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        aria-label="Branch for this transaction"
        defaultValue=""
        onChange={(e) => e.target.value && setBranch(e.target.value)}
      >
        <option value="" disabled>Select a branch…</option>
        {me?.accessibleBranches.map((b) => (
          <option key={b.id} value={String(b.id)}>{b.name}</option>
        ))}
      </select>
    </div>
  )
}
