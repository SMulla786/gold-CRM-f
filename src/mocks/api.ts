// Dev-only mock of the Phase-0 auth + public endpoints, used until backend TASK-3 lands.
// Flip VITE_USE_MOCK=false to hit the real API through the Vite proxy.
import { ApiException } from '@/lib/errors'
import { MODULE_KEYS, type BranchRef, type LoginResponse, type MeDto, type PermissionMap } from '@/shared'

const MOCK_PREFIXES = ['/auth', '/public']
export const mockSupports = (path: string) => MOCK_PREFIXES.some((p) => path.startsWith(p))

// Seed tree: Demo Jewellers HQ(1) -> Pune(2, admin node) -> Kothrud(3); HQ -> Mumbai(4).
const B: Record<number, BranchRef> = {
  1: { id: 1, name: 'HQ', parentId: null, path: '/1/', depth: 0, isAdminNode: true },
  2: { id: 2, name: 'Pune', parentId: 1, path: '/1/2/', depth: 1, isAdminNode: true },
  3: { id: 3, name: 'Kothrud', parentId: 2, path: '/1/2/3/', depth: 2, isAdminNode: false },
  4: { id: 4, name: 'Mumbai', parentId: 1, path: '/1/4/', depth: 1, isAdminNode: false },
}
const business = { id: 1, name: 'Demo Jewellers', status: 'ACTIVE' as const }
const subscription = { planName: 'Munim Jewellery — Yearly', endsAt: '2027-10-24T00:00:00.000Z', readOnly: false }
const allModules = [...MODULE_KEYS]

// Cashier (BRANCH_USER) needs an explicit permission map; admins are all-true by level.
const cashierPerms: PermissionMap = {
  'dashboard.home': { view: true },
  'billing.sell_bill': { view: true, edit: true },
  'billing.purchase_bill': { view: true },
  'udhari.entry': { view: true, edit: true },
  'udhari.ledger': { view: true },
  'settings.parties': { view: true, edit: true },
}

type MockUser = Omit<MeDto, 'impersonatedBy' | 'hasMpin'>
const USERS: Record<string, MockUser> = {
  superadmin: {
    id: 100, name: 'Platform Admin', username: 'superadmin', level: 'SUPER_ADMIN', isOwner: false,
    business: null, branch: null, accessibleBranches: [], permissions: {}, modules: allModules, subscription: null,
  },
  'demo.owner': {
    id: 1, name: 'Demo Owner', username: 'demo.owner', level: 'ADMIN', isOwner: true,
    business, branch: B[1], accessibleBranches: [B[1], B[2], B[3], B[4]], permissions: {}, modules: allModules, subscription,
  },
  'demo.pune': {
    id: 2, name: 'Pune Manager', username: 'demo.pune', level: 'ADMIN', isOwner: false,
    business, branch: B[2], accessibleBranches: [B[2], B[3]], permissions: {}, modules: allModules, subscription,
  },
  'demo.cashier': {
    id: 3, name: 'Kothrud Cashier', username: 'demo.cashier', level: 'BRANCH_USER', isOwner: false,
    business, branch: B[3], accessibleBranches: [B[3]], permissions: cashierPerms,
    modules: ['dashboard', 'billing', 'udhari', 'settings', 'daybook'], subscription,
  },
}

const SESSION_KEY = 'mock_user'
const meFor = (username: string): MeDto => ({ ...USERS[username], hasMpin: username === 'demo.cashier', impersonatedBy: null })

export async function mockHandle<T>(method: string, path: string, body?: unknown): Promise<T> {
  await new Promise((r) => setTimeout(r, 150)) // feel like a network hop
  const current = sessionStorage.getItem(SESSION_KEY)

  if (method === 'POST' && path === '/auth/login') {
    const { login, password } = (body ?? {}) as { login?: string; password?: string }
    const key = login?.trim().toLowerCase() ?? ''
    if (!USERS[key] || !password) throw new ApiException(401, 'INVALID_CREDENTIALS', 'Invalid username or password')
    sessionStorage.setItem(SESSION_KEY, key)
    return { accessToken: `mock.${key}`, user: meFor(key) } satisfies LoginResponse as T
  }
  if (method === 'POST' && path === '/auth/refresh') {
    if (!current) throw new ApiException(401, 'UNAUTHENTICATED', 'No session')
    return { accessToken: `mock.${current}` } as T
  }
  if (method === 'POST' && path === '/auth/logout') {
    sessionStorage.removeItem(SESSION_KEY)
    return undefined as T
  }
  if (method === 'GET' && path === '/auth/me') {
    if (!current) throw new ApiException(401, 'UNAUTHENTICATED', 'No session')
    return meFor(current) as T
  }
  if (method === 'POST' && path === '/auth/mpin/verify') {
    const { mpin } = (body ?? {}) as { mpin?: string }
    if (mpin !== '1234') throw new ApiException(403, 'MPIN_REQUIRED', 'Wrong MPIN')
    return undefined as T
  }
  if (method === 'GET' && path === '/public/states') {
    return [
      { id: 27, name: 'Maharashtra' },
      { id: 24, name: 'Gujarat' },
      { id: 29, name: 'Karnataka' },
    ] as T
  }
  throw new ApiException(404, 'NOT_FOUND', `No mock for ${method} ${path}`)
}
