// Mock router for public/platform/admin endpoints. /auth/* is NOT mocked — it hits the real backend.
import { ApiException } from '@/lib/errors'
import { MODULES, type BranchRef, type LoginResponse, type MeDto, type Paged } from '@/shared'
import type {
  BusinessDetailDto,
  PlanDto,
  RoleDto,
  SignupRequestDto,
  SubscriptionDto,
  UserDto,
  UserPermissionsDto,
} from '@/shared'
import * as db from '@/mocks/store'

// Everything except /auth/* is served from the mock until backend TASK-5 lands.
export const mockSupports = (path: string) => !path.startsWith('/auth/')

type Body = Record<string, unknown>
const asBody = (b: unknown): Body => (b ?? {}) as Body

function paged<T>(items: T[], sp: URLSearchParams): Paged<T> {
  const page = Math.max(1, Number(sp.get('page') ?? 1))
  const pageSize = Math.min(100, Math.max(1, Number(sp.get('pageSize') ?? 20)))
  return { items: items.slice((page - 1) * pageSize, page * pageSize), total: items.length, page, pageSize }
}

const notFound = (what = 'Not found') => new ApiException(404, 'NOT_FOUND', what)

export async function mockHandle<T>(method: string, rawPath: string, body?: unknown): Promise<T> {
  await new Promise((r) => setTimeout(r, 120)) // feel like a network hop
  const url = new URL(`http://m${rawPath}`)
  const path = url.pathname
  const sp = url.searchParams
  const seg = path.split('/').filter(Boolean) // e.g. ['platform','businesses','2']
  const m = `${method} ${path}`

  // ───── Public ─────
  if (m === 'GET /public/states') return db.states as T
  if (method === 'GET' && seg[0] === 'public' && seg[1] === 'states' && seg[3] === 'districts') {
    return (db.districtsByState[Number(seg[2])] ?? []) as T
  }
  if (m === 'POST /public/signup') return { id: db.nextId(), status: 'PENDING' } as T

  // ───── Platform ─────
  if (m === 'GET /platform/dashboard') return db.dashboardCounts() as T

  if (m === 'GET /platform/signups') {
    const status = sp.get('status')
    const items = db.signups.filter((s) => !status || s.status === status)
    return paged(items, sp) as T
  }
  if (method === 'POST' && seg[0] === 'platform' && seg[1] === 'signups' && seg[3]) {
    const s = db.signups.find((x) => x.id === Number(seg[2]))
    if (!s) throw notFound('Sign-up not found')
    if (seg[3] === 'approve') {
      s.status = 'APPROVED'
      s.reviewedAt = new Date().toISOString()
      const biz = createBusinessFromSignup(s, asBody(body))
      s.businessId = biz.id
      return biz as T
    }
    if (seg[3] === 'reject') {
      s.status = 'REJECTED'
      s.reviewedAt = new Date().toISOString()
      s.rejectReason = String(asBody(body).reason ?? '')
      return s as T
    }
  }

  if (m === 'GET /platform/businesses') {
    const status = sp.get('status')
    const subState = sp.get('subscription')
    const q = (sp.get('q') ?? '').toLowerCase()
    const items = db.businesses
      .filter((b) => !status || b.status === status)
      .filter((b) => !subState || b.subscriptionState === subState)
      .filter((b) => !q || b.name.toLowerCase().includes(q) || b.ownerName.toLowerCase().includes(q))
      .map(db.toListItem)
    return paged(items, sp) as T
  }
  if (m === 'POST /platform/businesses') return createBusiness(asBody(body)) as T
  if (method === 'GET' && seg[0] === 'platform' && seg[1] === 'businesses' && seg[2] && !seg[3]) {
    const b = db.businesses.find((x) => x.id === Number(seg[2]))
    if (!b) throw notFound('Business not found')
    return b as T
  }
  if (method === 'PATCH' && seg[0] === 'platform' && seg[1] === 'businesses' && seg[2] && !seg[3]) {
    const b = db.businesses.find((x) => x.id === Number(seg[2]))
    if (!b) throw notFound('Business not found')
    Object.assign(b, asBody(body))
    return b as T
  }
  if (method === 'POST' && seg[0] === 'platform' && seg[1] === 'businesses' && (seg[3] === 'suspend' || seg[3] === 'activate')) {
    const b = db.businesses.find((x) => x.id === Number(seg[2]))
    if (!b) throw notFound('Business not found')
    b.status = seg[3] === 'suspend' ? 'SUSPENDED' : 'ACTIVE'
    return b as T
  }
  if (method === 'POST' && seg[0] === 'platform' && seg[1] === 'businesses' && seg[3] === 'subscriptions') {
    const b = db.businesses.find((x) => x.id === Number(seg[2]))
    if (!b) throw notFound('Business not found')
    return assignSubscription(b, asBody(body)) as T
  }
  if (method === 'POST' && seg[0] === 'platform' && seg[1] === 'businesses' && seg[3] === 'payments') {
    const b = db.businesses.find((x) => x.id === Number(seg[2]))
    if (!b) throw notFound('Business not found')
    return recordPayment(b, asBody(body)) as T
  }
  if (method === 'POST' && seg[0] === 'platform' && seg[1] === 'businesses' && seg[3] === 'impersonate') {
    const b = db.businesses.find((x) => x.id === Number(seg[2]))
    if (!b) throw notFound('Business not found')
    return impersonate(b) as T
  }
  if (method === 'PATCH' && seg[0] === 'platform' && seg[1] === 'subscriptions' && seg[2]) {
    for (const b of db.businesses) {
      const s = b.subscriptions.find((x) => x.id === Number(seg[2]))
      if (s) {
        Object.assign(s, asBody(body))
        if (s.status === 'ACTIVE') b.subscriptionState = 'active'
        return s as T
      }
    }
    throw notFound('Subscription not found')
  }
  if (m === 'POST /platform/impersonation/end') return undefined as T
  if (m === 'GET /platform/payments') return paged(db.allPayments(), sp) as T

  if (m === 'GET /platform/plans') return db.plans as T
  if (m === 'POST /platform/plans') {
    const p: PlanDto = { id: db.nextId(), activeSubscriptions: 0, ...(asBody(body) as Omit<PlanDto, 'id' | 'activeSubscriptions'>) }
    db.plans.push(p)
    return p as T
  }
  if (method === 'PATCH' && seg[0] === 'platform' && seg[1] === 'plans' && seg[2]) {
    const p = db.plans.find((x) => x.id === Number(seg[2]))
    if (!p) throw notFound('Plan not found')
    Object.assign(p, asBody(body))
    return p as T
  }

  // ───── Admin ─────
  if (m === 'GET /admin/branches') return db.branchTree() as T
  if (m === 'POST /admin/branches') return addBranch(asBody(body)) as T
  if (method === 'PATCH' && seg[0] === 'admin' && seg[1] === 'branches' && seg[2] && !seg[3]) {
    const b = db.branches.find((x) => x.id === Number(seg[2]))
    if (!b) throw notFound('Branch not found')
    Object.assign(b, asBody(body))
    return db.branchTree() as T
  }
  if (method === 'POST' && seg[0] === 'admin' && seg[1] === 'branches' && seg[3] === 'move') {
    moveBranch(Number(seg[2]), Number(asBody(body).newParentId))
    return db.branchTree() as T
  }

  if (m === 'GET /admin/counters') {
    const branchId = sp.get('branchId')
    return db.counters.filter((c) => !branchId || c.branchId === Number(branchId)) as T
  }

  if (m === 'GET /admin/users') {
    const status = sp.get('status')
    const branchId = sp.get('branchId')
    const q = (sp.get('q') ?? '').toLowerCase()
    const items = db.users
      .filter((u) => (status ? u.status === status : u.status !== 'DELETED'))
      .filter((u) => !branchId || u.branch.id === Number(branchId))
      .filter((u) => !q || u.name.toLowerCase().includes(q) || u.username.includes(q))
    return paged(items, sp) as T
  }
  if (m === 'POST /admin/users') return createUser(asBody(body)) as T
  if (method === 'PATCH' && seg[0] === 'admin' && seg[1] === 'users' && seg[2] && !seg[3]) {
    const u = db.users.find((x) => x.id === Number(seg[2]))
    if (!u) throw notFound('User not found')
    applyUserPatch(u, asBody(body))
    return u as T
  }
  if (method === 'POST' && seg[0] === 'admin' && seg[1] === 'users' && (seg[3] === 'block' || seg[3] === 'unblock')) {
    const u = db.users.find((x) => x.id === Number(seg[2]))
    if (!u) throw notFound('User not found')
    u.status = seg[3] === 'block' ? 'BLOCKED' : 'ACTIVE'
    return u as T
  }
  if (method === 'POST' && seg[0] === 'admin' && seg[1] === 'users' && seg[3] === 'reset-password') return undefined as T
  if (method === 'GET' && seg[0] === 'admin' && seg[1] === 'users' && seg[3] === 'permissions') {
    return userPermissions(Number(seg[2])) as T
  }
  if (method === 'PUT' && seg[0] === 'admin' && seg[1] === 'users' && seg[3] === 'permissions') return undefined as T

  if (m === 'GET /admin/permissions') return MODULES as T
  if (m === 'GET /admin/roles') return db.roles as T
  if (m === 'POST /admin/roles') {
    const r: RoleDto = { id: db.nextId(), name: String(asBody(body).name ?? 'Role'), isSystem: false, userCount: 0, grants: [] }
    db.roles.push(r)
    return r as T
  }
  if (method === 'PUT' && seg[0] === 'admin' && seg[1] === 'roles' && seg[3] === 'permissions') return undefined as T

  if (m === 'GET /admin/business') return db.adminProfile as T
  if (m === 'PATCH /admin/business') {
    Object.assign(db.adminProfile, asBody(body))
    return db.adminProfile as T
  }
  if (m === 'GET /admin/subscription') {
    const b = db.businesses[0]
    const s = b.subscriptions[0]
    return {
      planName: s.planName, startsAt: s.startsAt, endsAt: s.endsAt, readOnly: b.status === 'SUSPENDED',
      maxBranches: s.maxBranches, maxUsers: s.maxUsers, usedBranches: db.branches.length,
      usedUsers: db.users.filter((u) => u.status !== 'DELETED').length, modules: s.modules,
    } as T
  }

  throw notFound(`No mock for ${m}`)
}

// ───── mutation helpers ─────
function createBusinessFromSignup(s: SignupRequestDto, body: Body): BusinessDetailDto {
  return buildBusiness({ name: s.shopName, ownerName: s.ownerName, mobile: s.whatsapp, email: s.email, planId: Number(body.planId) })
}
function createBusiness(body: Body): BusinessDetailDto {
  const owner = (body.owner ?? {}) as Body
  return buildBusiness({
    name: String(body.name), ownerName: String(body.ownerName), mobile: String(body.mobile),
    email: (body.email as string) ?? null, planId: Number(body.planId), ownerUsername: owner.username as string,
  })
}
function buildBusiness(a: { name: string; ownerName: string; mobile: string; email: string | null; planId: number; ownerUsername?: string }): BusinessDetailDto {
  const id = db.nextId()
  const plan = db.plans.find((p) => p.id === a.planId) ?? db.plans[0]
  const sub: SubscriptionDto = {
    id: db.nextId(), planId: plan.id, planName: plan.name, startsAt: new Date().toISOString(),
    endsAt: new Date(Date.now() + plan.durationDays * 86_400_000).toISOString(), status: 'ACTIVE',
    maxBranches: plan.maxBranches, maxUsers: plan.maxUsers, modules: plan.modules, notes: null, createdAt: new Date().toISOString(),
  }
  const biz: BusinessDetailDto = {
    id, name: a.name, ownerName: a.ownerName, mobile: a.mobile, status: 'ACTIVE', subscriptionState: 'active',
    planName: plan.name, endsAt: sub.endsAt, branchCount: 1, userCount: 1, createdAt: new Date().toISOString(),
    alternateMobile: null, email: a.email, gstin: null, address: null, state: null, district: null,
    owner: { id: db.nextId(), name: a.ownerName, username: a.ownerUsername ?? a.ownerName.toLowerCase().replace(/\s+/g, '.'), mobile: a.mobile, email: a.email, lastLoginAt: null },
    subscriptions: [sub], payments: [],
  }
  db.businesses.push(biz)
  return biz
}
function assignSubscription(b: BusinessDetailDto, body: Body): SubscriptionDto {
  const plan = db.plans.find((p) => p.id === Number(body.planId)) ?? db.plans[0]
  const days = Number(body.durationDays ?? plan.durationDays)
  const sub: SubscriptionDto = {
    id: db.nextId(), planId: plan.id, planName: plan.name, startsAt: new Date().toISOString(),
    endsAt: new Date(Date.now() + days * 86_400_000).toISOString(), status: 'ACTIVE',
    maxBranches: Number(body.maxBranches ?? plan.maxBranches), maxUsers: Number(body.maxUsers ?? plan.maxUsers),
    modules: (body.modules as string[]) ?? plan.modules, notes: (body.notes as string) ?? null, createdAt: new Date().toISOString(),
  }
  b.subscriptions.unshift(sub)
  b.planName = plan.name
  b.endsAt = sub.endsAt
  b.subscriptionState = 'active'
  if (b.status === 'SUSPENDED') b.status = 'ACTIVE'
  return sub
}
function recordPayment(b: BusinessDetailDto, body: Body) {
  const pay = {
    id: db.nextId(), businessId: b.id, businessName: b.name, subscriptionId: (body.subscriptionId as number) ?? null,
    amount: Number(body.amount).toFixed(2), method: (body.method as 'UPI' | 'CASH' | 'BANK' | 'GATEWAY') ?? 'UPI',
    utr: (body.utr as string) ?? null, status: (body.status as 'PENDING' | 'CONFIRMED' | 'REJECTED') ?? 'CONFIRMED',
    paidAt: (body.paidAt as string) ?? new Date().toISOString(), createdAt: new Date().toISOString(), hasProof: false,
  }
  b.payments.unshift(pay)
  return pay
}
function impersonate(b: BusinessDetailDto): LoginResponse {
  const branch: BranchRef = { id: 1, name: 'HQ', parentId: null, path: '/1/', depth: 0, isAdminNode: true }
  const user: MeDto = {
    id: b.owner?.id ?? 0, name: b.owner?.name ?? b.ownerName, username: b.owner?.username ?? 'owner', level: 'ADMIN', isOwner: true,
    business: { id: b.id, name: b.name, status: b.status }, branch, accessibleBranches: [branch],
    permissions: {}, modules: b.subscriptions[0]?.modules ?? [], hasMpin: false,
    subscription: { planName: b.planName ?? '—', endsAt: b.endsAt ?? '', readOnly: b.status === 'SUSPENDED', adEligible: false },
    impersonatedBy: { id: 100, name: 'Platform Admin' },
  }
  return { accessToken: `mock.impersonate.${b.id}`, user }
}
function addBranch(body: Body) {
  const parent = db.branches.find((x) => x.id === Number(body.parentId))
  if (!parent) throw notFound('Parent branch not found')
  const id = db.nextId()
  db.branches.push({
    id, parentId: parent.id, name: String(body.name), code: (body.code as string) ?? null,
    path: `${parent.path}${id}/`, depth: parent.depth + 1, isAdminNode: Boolean(body.isAdminNode), isActive: true,
  })
  return db.branchTree()
}
function moveBranch(branchId: number, newParentId: number) {
  const node = db.branches.find((x) => x.id === branchId)
  const parent = db.branches.find((x) => x.id === newParentId)
  if (!node || !parent) throw notFound('Branch not found')
  if (parent.path.startsWith(node.path)) throw new ApiException(409, 'CONFLICT', 'Cannot move under own descendant')
  const oldPath = node.path
  const newPath = `${parent.path}${node.id}/`
  const delta = parent.depth + 1 - node.depth
  for (const b of db.branches) {
    if (b.path.startsWith(oldPath)) {
      b.path = b.path.replace(oldPath, newPath)
      b.depth += delta
    }
  }
  node.parentId = parent.id
}
function createUser(body: Body): UserDto {
  const branch = db.branches.find((x) => x.id === Number(body.branchId))
  const role = db.roles.find((r) => r.id === Number(body.roleId))
  const u: UserDto = {
    id: db.nextId(), name: String(body.name), username: String(body.username), email: (body.email as string) ?? null,
    mobile: (body.mobile as string) ?? null, level: (body.level as 'ADMIN' | 'BRANCH_USER') ?? 'BRANCH_USER', isOwner: false,
    status: 'ACTIVE', branch: { id: branch?.id ?? 0, name: branch?.name ?? '—' }, role: role ? { id: role.id, name: role.name } : null,
    extraBranchIds: (body.extraBranchIds as number[]) ?? [], viewDaysLimit: (body.viewDaysLimit as number) ?? null, lastLoginAt: null,
  }
  db.users.push(u)
  return u
}
function applyUserPatch(u: UserDto, body: Body) {
  if (body.name !== undefined) u.name = String(body.name)
  if (body.email !== undefined) u.email = (body.email as string) ?? null
  if (body.mobile !== undefined) u.mobile = (body.mobile as string) ?? null
  if (body.level !== undefined) u.level = body.level as 'ADMIN' | 'BRANCH_USER'
  if (body.viewDaysLimit !== undefined) u.viewDaysLimit = (body.viewDaysLimit as number) ?? null
  if (body.branchId !== undefined) {
    const br = db.branches.find((x) => x.id === Number(body.branchId))
    if (br) u.branch = { id: br.id, name: br.name }
  }
  if (body.roleId !== undefined) {
    const role = db.roles.find((r) => r.id === Number(body.roleId))
    u.role = role ? { id: role.id, name: role.name } : null
  }
  if (body.extraBranchIds !== undefined) u.extraBranchIds = body.extraBranchIds as number[]
}
function userPermissions(userId: number): UserPermissionsDto {
  const u = db.users.find((x) => x.id === userId)
  // Default: cashier role gives billing+udhari view/edit; others view-only on a few pages.
  const effective = MODULES.flatMap((mod) =>
    mod.pages.map((pg) => {
      const on = u?.role?.name.includes('Cashier') && (pg.key.startsWith('billing') || pg.key.startsWith('udhari'))
      return { key: pg.key, view: Boolean(on) || pg.key === 'dashboard.home', edit: Boolean(on), delete: false }
    }),
  )
  return { effective, overriddenKeys: [], roleId: u?.role?.id ?? null }
}
