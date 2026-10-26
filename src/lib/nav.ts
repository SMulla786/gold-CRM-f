import { MODULES } from '@/shared'
import { useAuth } from '@/lib/auth'

export interface NavItem {
  to: string
  label: string
}

export const PLATFORM_NAV: NavItem[] = [
  { to: '/platform', label: 'Dashboard' },
  { to: '/platform/signups', label: 'Sign-up Requests' },
  { to: '/platform/businesses', label: 'Businesses' },
  { to: '/platform/plans', label: 'Plans' },
  { to: '/platform/payments', label: 'Payments' },
]

/** Admin menu; owner-only items are dropped for branch-admin nodes. */
export function useAdminNav(): NavItem[] {
  const { me } = useAuth()
  const items: NavItem[] = [
    { to: '/admin', label: 'Dashboard' },
    { to: '/admin/branches', label: 'Branches' },
    { to: '/admin/counters', label: 'Counters' },
    { to: '/admin/users', label: 'Users' },
    { to: '/admin/roles', label: 'Roles & Permissions' },
    { to: '/admin/permission-enquiries', label: 'Permission Requests' },
  ]
  if (me?.isOwner) {
    items.push({ to: '/admin/business', label: 'Business Settings' })
    items.push({ to: '/admin/subscription', label: 'Subscription' })
  }
  return items
}

/** Store menu built from MODULES, filtered by enabled modules + view permission. */
export function useAppNav(): NavItem[] {
  const { can, hasModule } = useAuth()
  const items = MODULES.filter(
    (m) => hasModule(m.key, m.core) && m.pages.some((pg) => can(pg.key, 'view')),
  ).map((m) => ({ to: `/app/${m.key}`, label: m.label }))
  // Self-service: any store user can ask for access they don't have (TASK-87).
  items.push({ to: '/app/access-requests', label: 'Access requests' })
  return items
}
