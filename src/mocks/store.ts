// In-memory mock data for platform + admin screens (used until backend TASK-5 lands).
// Shapes match the published shared DTOs exactly; money/amounts are strings, dates ISO.
import { MODULE_KEYS } from '@/shared'
import type {
  BranchNodeDto,
  BusinessDetailDto,
  BusinessListItemDto,
  CounterDto,
  GeoDto,
  PaymentDto,
  PlanDto,
  RoleDto,
  SignupRequestDto,
  SubscriptionDto,
  UserDto,
} from '@/shared'

const now = Date.now()
const iso = (daysFromNow: number) => new Date(now + daysFromNow * 86_400_000).toISOString()

let seq = 1000
export const nextId = () => ++seq

export const states: GeoDto[] = [
  { id: 27, name: 'MAHARASHTRA' },
  { id: 24, name: 'GUJARAT' },
  { id: 29, name: 'KARNATAKA' },
  { id: 9, name: 'UTTAR PRADESH' },
  { id: 7, name: 'DELHI' },
]
export const districtsByState: Record<number, GeoDto[]> = {
  27: [
    { id: 2701, name: 'Pune' },
    { id: 2702, name: 'Mumbai' },
    { id: 2703, name: 'Nagpur' },
  ],
  24: [
    { id: 2401, name: 'Ahmedabad' },
    { id: 2402, name: 'Surat' },
  ],
  29: [{ id: 2901, name: 'Bengaluru Urban' }],
}

export const plans: PlanDto[] = [
  {
    id: 1, name: 'Starter', description: 'Single branch, core billing', durationDays: 365, price: '4999.00',
    maxBranches: 1, maxUsers: 3, modules: ['dashboard', 'billing', 'inventory', 'udhari', 'settings', 'daybook'],
    isActive: true, activeSubscriptions: 1,
  },
  {
    id: 2, name: 'Growth', description: 'Multi-branch + schemes', durationDays: 365, price: '9999.00',
    maxBranches: 5, maxUsers: 15,
    modules: ['dashboard', 'billing', 'orders', 'inventory', 'udhari', 'girvi', 'schemes', 'settings', 'daybook', 'stock_summary'],
    isActive: true, activeSubscriptions: 1,
  },
  {
    id: 3, name: 'Enterprise', description: 'All modules, unlimited-ish', durationDays: 365, price: '19999.00',
    maxBranches: 50, maxUsers: 200, modules: [...MODULE_KEYS], isActive: true, activeSubscriptions: 0,
  },
]

export const signups: SignupRequestDto[] = [
  {
    id: 501, shopName: 'Shree Gold Palace', ownerName: 'Ramesh Shah', countryCode: '+91', whatsapp: '9820012345',
    email: 'ramesh@shreegold.in', address: 'MG Road, Pune', state: { id: 27, name: 'MAHARASHTRA' },
    district: { id: 2701, name: 'Pune' }, status: 'PENDING', businessId: null, rejectReason: null, reviewedAt: null, createdAt: iso(-2),
  },
  {
    id: 502, shopName: 'Krishna Jewellers', ownerName: 'Anita Patel', countryCode: '+91', whatsapp: '9898007766',
    email: null, address: 'Ring Road, Surat', state: { id: 24, name: 'GUJARAT' }, district: { id: 2402, name: 'Surat' },
    status: 'PENDING', businessId: null, rejectReason: null, reviewedAt: null, createdAt: iso(-1),
  },
]

function subFor(planId: number, days: number): SubscriptionDto {
  const plan = plans.find((p) => p.id === planId)!
  return {
    id: nextId(), planId, planName: plan.name, startsAt: iso(-365 + days), endsAt: iso(days), status: 'ACTIVE',
    maxBranches: plan.maxBranches, maxUsers: plan.maxUsers, modules: plan.modules, notes: null, createdAt: iso(-365 + days),
  }
}
function payFor(businessId: number, businessName: string, amount: string, days: number): PaymentDto {
  return {
    id: nextId(), businessId, businessName, subscriptionId: null, amount, method: 'UPI', utr: `UTR${nextId()}`,
    status: 'CONFIRMED', paidAt: iso(days), createdAt: iso(days), hasProof: false,
  }
}

export const businesses: BusinessDetailDto[] = [
  {
    id: 1, name: 'Demo Jewellers', ownerName: 'Demo Owner', mobile: '9000000001', status: 'ACTIVE',
    subscriptionState: 'active', planName: 'Growth', endsAt: iso(200), branchCount: 4, userCount: 3, createdAt: iso(-180),
    alternateMobile: null,
    email: 'owner@demo.in', gstin: '27ABCDE1234F1Z5', address: 'FC Road, Pune', state: { id: 27, name: 'MAHARASHTRA' },
    district: { id: 2701, name: 'Pune' },
    owner: { id: 1, name: 'Demo Owner', username: 'demo.owner', mobile: '9000000001', email: 'owner@demo.in', lastLoginAt: iso(0) },
    subscriptions: [subFor(2, 200)], payments: [payFor(1, 'Demo Jewellers', '9999.00', -180)],
  },
  {
    id: 2, name: 'Sunrise Gold', ownerName: 'Vikram Rao', mobile: '9000000002', status: 'ACTIVE',
    subscriptionState: 'expiring', planName: 'Starter', endsAt: iso(9), branchCount: 1, userCount: 2, createdAt: iso(-350),
    alternateMobile: null,
    email: null, gstin: null, address: 'Residency Road, Bengaluru', state: { id: 29, name: 'KARNATAKA' },
    district: { id: 2901, name: 'Bengaluru Urban' },
    owner: { id: 20, name: 'Vikram Rao', username: 'sunrise.owner', mobile: '9000000002', email: null, lastLoginAt: iso(-1) },
    subscriptions: [subFor(1, 9)], payments: [payFor(2, 'Sunrise Gold', '4999.00', -350)],
  },
  {
    id: 3, name: 'Heritage Ornaments', ownerName: 'Suresh Jain', mobile: '9000000003', status: 'SUSPENDED',
    subscriptionState: 'expired', planName: 'Starter', endsAt: iso(-20), branchCount: 2, userCount: 4, createdAt: iso(-400),
    alternateMobile: null,
    email: 'suresh@heritage.in', gstin: '24ABCDE5678G1Z2', address: 'CG Road, Ahmedabad', state: { id: 24, name: 'GUJARAT' },
    district: { id: 2401, name: 'Ahmedabad' },
    owner: { id: 30, name: 'Suresh Jain', username: 'heritage.owner', mobile: '9000000003', email: 'suresh@heritage.in', lastLoginAt: iso(-25) },
    subscriptions: [{ ...subFor(1, -20), status: 'CANCELLED' }], payments: [payFor(3, 'Heritage Ornaments', '4999.00', -400)],
  },
]

export const toListItem = (b: BusinessDetailDto): BusinessListItemDto => ({
  id: b.id, name: b.name, ownerName: b.ownerName, mobile: b.mobile, status: b.status,
  subscriptionState: b.subscriptionState, planName: b.planName, endsAt: b.endsAt,
  branchCount: b.branchCount, userCount: b.userCount, createdAt: b.createdAt,
})

export const allPayments = (): PaymentDto[] => businesses.flatMap((b) => b.payments).sort((a, z) => z.createdAt.localeCompare(a.createdAt))

// ───── Admin side (the logged-in business). Flat branch list; tree built on read. ─────
interface BranchRow {
  id: number
  parentId: number | null
  name: string
  code: string | null
  path: string
  depth: number
  isAdminNode: boolean
  isActive: boolean
}
export const branches: BranchRow[] = [
  { id: 1, parentId: null, name: 'HQ', code: 'HQ', path: '/1/', depth: 0, isAdminNode: true, isActive: true },
  { id: 2, parentId: 1, name: 'Pune', code: 'PN', path: '/1/2/', depth: 1, isAdminNode: true, isActive: true },
  { id: 3, parentId: 2, name: 'Kothrud', code: 'KT', path: '/1/2/3/', depth: 2, isAdminNode: false, isActive: true },
  { id: 4, parentId: 1, name: 'Mumbai', code: 'MB', path: '/1/4/', depth: 1, isAdminNode: false, isActive: true },
]

export function branchTree(): BranchNodeDto {
  const node = (r: BranchRow): BranchNodeDto => ({
    id: r.id, parentId: r.parentId, name: r.name, code: r.code, path: r.path, depth: r.depth,
    isAdminNode: r.isAdminNode, isActive: r.isActive,
    userCount: users.filter((u) => u.branch.id === r.id && u.status !== 'DELETED').length,
    children: branches.filter((c) => c.parentId === r.id).map(node),
  })
  return node(branches.find((b) => b.parentId === null)!)
}

export const branchName = (id: number) => branches.find((b) => b.id === id)?.name ?? `#${id}`

export const roles: RoleDto[] = [
  { id: 1, name: 'Showroom Manager', isSystem: true, userCount: 0, grants: [] },
  { id: 2, name: 'Billing Operator / Cashier', isSystem: true, userCount: 1, grants: [] },
  { id: 3, name: 'Sales Executive', isSystem: true, userCount: 0, grants: [] },
  { id: 4, name: 'Stock Manager', isSystem: true, userCount: 0, grants: [] },
]

export const users: UserDto[] = [
  {
    id: 1, name: 'Demo Owner', username: 'demo.owner', email: 'owner@demo.in', mobile: '9000000001', level: 'ADMIN',
    isOwner: true, status: 'ACTIVE', branch: { id: 1, name: 'HQ' }, role: null, extraBranchIds: [], viewDaysLimit: null, lastLoginAt: iso(0),
  },
  {
    id: 2, name: 'Pune Manager', username: 'demo.pune', email: null, mobile: '9000000012', level: 'ADMIN',
    isOwner: false, status: 'ACTIVE', branch: { id: 2, name: 'Pune' }, role: null, extraBranchIds: [], viewDaysLimit: 365, lastLoginAt: iso(-1),
  },
  {
    id: 3, name: 'Kothrud Cashier', username: 'demo.cashier', email: null, mobile: '9000000033', level: 'BRANCH_USER',
    isOwner: false, status: 'ACTIVE', branch: { id: 3, name: 'Kothrud' }, role: { id: 2, name: 'Billing Operator / Cashier' },
    extraBranchIds: [], viewDaysLimit: 90, lastLoginAt: iso(-2),
  },
]

export const counters: CounterDto[] = [
  { id: 1, branchId: 3, branchName: 'Kothrud', name: 'Counter 1', isActive: true },
  { id: 2, branchId: 3, branchName: 'Kothrud', name: 'Counter 2', isActive: true },
]

export const adminProfile = {
  id: 1, name: 'Demo Jewellers', ownerName: 'Demo Owner', mobile: '9000000001', alternateMobile: null, email: 'owner@demo.in',
  gstin: '27ABCDE1234F1Z5', address: 'FC Road, Pune', stateId: 27, districtId: 2701,
}

export const dashboardCounts = () => {
  const active = businesses.filter((b) => b.status === 'ACTIVE').length
  return {
    businesses: {
      total: businesses.length,
      active,
      suspended: businesses.filter((b) => b.status === 'SUSPENDED').length,
      expired: businesses.filter((b) => b.subscriptionState === 'expired').length,
      expiringIn15Days: businesses.filter((b) => b.subscriptionState === 'expiring').length,
    },
    pendingSignups: signups.filter((s) => s.status === 'PENDING').length,
    revenue: { thisMonth: 24997, thisYear: 184963 },
    branches: businesses.reduce((n, b) => n + b.branchCount, 0),
    users: businesses.reduce((n, b) => n + b.userCount, 0),
  }
}
