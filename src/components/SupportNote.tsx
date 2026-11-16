import { useAuth } from '@/lib/auth'

// G7 review 4 + closure: impersonating, a Super Admin may not change who controls the business or its access; the API
// refuses every such call, so the UI switches those actions off and says why here.
const TEXT = {
  users: "Support session: user accounts and access are the owner's to change, so this list is view-only.",
  roles: "Support session: role permissions and deleting a role are the owner's to change. Creating and renaming roles stays open.",
  enquiries: 'Support session: approving grants access, so only the owner can approve. Rejecting stays open.',
  contacts: "Support session: the business email and mobile numbers are the owner's to change.",
  security: "Support session: only the owner can change the owner's own password and MPIN.",
} as const

/** Why actions are switched off for an impersonating Super Admin; renders nothing outside a support session. */
export function SupportNote({ what }: { what: keyof typeof TEXT }) {
  const { me } = useAuth()
  return me?.impersonatedBy ? <p role="note" className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">{TEXT[what]}</p> : null
}
