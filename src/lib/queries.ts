import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query'
import { toast } from 'sonner'

import { api } from '@/lib/api'
import { ApiException } from '@/lib/errors'
import type {
  AdminOverviewDto,
  BranchNodeDto,
  BusinessDetailDto,
  BusinessListItemDto,
  CounterDto,
  GeoDto,
  MeDto,
  ModuleDef,
  Paged,
  PaymentDto,
  PermissionEnquiryDto,
  PlanDto,
  RoleDto,
  SignupRequestDto,
  SubscriptionDto,
  SubscriptionViewDto,
  UserDto,
  UserPermissionsDto,
} from '@/shared'
import type { BusinessProfileDto } from '@/shared'

export const qs = (params: Record<string, string | number | undefined>) => {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') sp.set(k, String(v))
  const s = sp.toString()
  return s ? `?${s}` : ''
}

/** Fetch every page of a Paged endpoint (pageSize caps at 100), for client-side CSV export. */
export async function fetchAllPaged<T>(path: string, params: Record<string, string | number | undefined>): Promise<T[]> {
  const out: T[] = []
  for (let page = 1; ; page++) {
    const res = await api.get<Paged<T>>(`${path}${qs({ ...params, page, pageSize: 100 })}`)
    out.push(...res.items)
    if (res.items.length === 0 || out.length >= res.total) return out
  }
}

/** Mutation helper: run, invalidate query prefixes, toast success/error. */
export function useApiMutation<TArgs, TOut>(
  fn: (args: TArgs) => Promise<TOut>,
  opts: { invalidate?: QueryKey[]; success?: string } = {},
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      opts.invalidate?.forEach((key) => qc.invalidateQueries({ queryKey: key }))
      if (opts.success) toast.success(opts.success)
    },
    onError: (e) => toast.error(e instanceof ApiException ? e.message : 'Something went wrong'),
  })
}

// ───── Geo ─────
export const useStates = () => useQuery({ queryKey: ['states'], queryFn: () => api.get<GeoDto[]>('/public/states'), staleTime: Infinity })
export const useDistricts = (stateId?: number) =>
  useQuery({
    queryKey: ['districts', stateId],
    queryFn: () => api.get<GeoDto[]>(`/public/states/${stateId}/districts`),
    enabled: !!stateId,
  })

// ───── Platform ─────
export interface PlatformDashboard {
  businesses: { total: number; active: number; suspended: number; expired: number; expiringIn15Days: number }
  pendingSignups: number
  revenue: { thisMonth: number; thisYear: number }
  branches: number
  users: number
}
export const usePlatformDashboard = () =>
  useQuery({ queryKey: ['platform-dashboard'], queryFn: () => api.get<PlatformDashboard>('/platform/dashboard') })

export const useSignups = (status?: string) =>
  useQuery({ queryKey: ['signups', status], queryFn: () => api.get<Paged<SignupRequestDto>>(`/platform/signups${qs({ status })}`) })

export const useApproveSignup = () =>
  useApiMutation(
    ({ id, planId, owner }: { id: number; planId: number; owner: Record<string, unknown> }) =>
      api.post<BusinessDetailDto>(`/platform/signups/${id}/approve`, { planId, owner }),
    { invalidate: [['signups'], ['businesses'], ['platform-dashboard']], success: 'Business created' },
  )
export const useRejectSignup = () =>
  useApiMutation(({ id, reason }: { id: number; reason: string }) => api.post(`/platform/signups/${id}/reject`, { reason }), {
    invalidate: [['signups'], ['platform-dashboard']],
    success: 'Sign-up rejected',
  })

export const useBusinesses = (params: { page?: number; q?: string; status?: string; subscription?: string }) =>
  useQuery({ queryKey: ['businesses', params], queryFn: () => api.get<Paged<BusinessListItemDto>>(`/platform/businesses${qs(params)}`) })
export const useBusiness = (id: number) =>
  useQuery({ queryKey: ['business', id], queryFn: () => api.get<BusinessDetailDto>(`/platform/businesses/${id}`), enabled: !!id })

export const useCreateBusiness = () =>
  useApiMutation((body: Record<string, unknown>) => api.post<BusinessDetailDto>('/platform/businesses', body), {
    invalidate: [['businesses'], ['platform-dashboard']],
    success: 'Business created',
  })
export const useSetBusinessStatus = () =>
  useApiMutation(({ id, action }: { id: number; action: 'suspend' | 'activate' }) => api.post(`/platform/businesses/${id}/${action}`), {
    invalidate: [['businesses'], ['business'], ['platform-dashboard']],
    success: 'Status updated',
  })
export const useAssignSubscription = () =>
  useApiMutation(({ id, body }: { id: number; body: Record<string, unknown> }) => api.post<SubscriptionDto>(`/platform/businesses/${id}/subscriptions`, body), {
    invalidate: [['business'], ['businesses']],
    success: 'Subscription assigned',
  })
export const useUpdateSubscription = () =>
  useApiMutation(({ id, body }: { id: number; body: Record<string, unknown> }) => api.patch<SubscriptionDto>(`/platform/subscriptions/${id}`, body), {
    invalidate: [['business'], ['businesses']],
    success: 'Subscription updated',
  })
export const useRecordPayment = () =>
  useApiMutation(({ id, body }: { id: number; body: Record<string, unknown> }) => api.post<PaymentDto>(`/platform/businesses/${id}/payments`, body), {
    invalidate: [['business'], ['payments']],
    success: 'Payment recorded',
  })

export const usePlans = () => useQuery({ queryKey: ['plans'], queryFn: () => api.get<PlanDto[]>('/platform/plans') })
export const useSavePlan = () =>
  useApiMutation(({ id, body }: { id?: number; body: Record<string, unknown> }) => (id ? api.patch<PlanDto>(`/platform/plans/${id}`, body) : api.post<PlanDto>('/platform/plans', body)), {
    invalidate: [['plans']],
    success: 'Plan saved',
  })

export const usePayments = (page?: number) =>
  useQuery({ queryKey: ['payments', page], queryFn: () => api.get<Paged<PaymentDto>>(`/platform/payments${qs({ page })}`) })

// ───── Admin ─────
export const useBranches = () => useQuery({ queryKey: ['branches'], queryFn: () => api.get<BranchNodeDto>('/admin/branches') })
export const useAdminOverview = () => useQuery({ queryKey: ['admin-overview'], queryFn: () => api.get<AdminOverviewDto>('/admin/overview') })
export const useAddBranch = () =>
  useApiMutation((body: Record<string, unknown>) => api.post<BranchNodeDto>('/admin/branches', body), { invalidate: [['branches']], success: 'Branch added' })
export const useUpdateBranch = () =>
  useApiMutation(({ id, body }: { id: number; body: Record<string, unknown> }) => api.patch<BranchNodeDto>(`/admin/branches/${id}`, body), { invalidate: [['branches']], success: 'Branch updated' })
export const useMoveBranch = () =>
  useApiMutation(({ id, newParentId }: { id: number; newParentId: number }) => api.post(`/admin/branches/${id}/move`, { newParentId }), { invalidate: [['branches']], success: 'Branch moved' })

export const useCounters = (branchId?: number) =>
  useQuery({ queryKey: ['counters', branchId], queryFn: () => api.get<CounterDto[]>(`/admin/counters${qs({ branchId })}`) })

export const useUsers = (params: { page?: number; pageSize?: number; q?: string; status?: string; branchId?: number }) =>
  useQuery({ queryKey: ['users', params], queryFn: () => api.get<Paged<UserDto>>(`/admin/users${qs(params)}`) })
export const useCreateUser = () =>
  useApiMutation((body: Record<string, unknown>) => api.post<UserDto>('/admin/users', body), { invalidate: [['users']], success: 'User created' })
export const useUpdateUser = () =>
  useApiMutation(({ id, body }: { id: number; body: Record<string, unknown> }) => api.patch<UserDto>(`/admin/users/${id}`, body), { invalidate: [['users']], success: 'User updated' })
export const useSetUserStatus = () =>
  useApiMutation(({ id, action }: { id: number; action: 'block' | 'unblock' }) => api.post(`/admin/users/${id}/${action}`), { invalidate: [['users']], success: 'User updated' })
export const useResetUserPassword = () =>
  useApiMutation(({ id, password }: { id: number; password: string }) => api.post(`/admin/users/${id}/reset-password`, { password }), { success: 'Password reset' })

export const useUserPermissions = (id: number) =>
  useQuery({ queryKey: ['user-permissions', id], queryFn: () => api.get<UserPermissionsDto>(`/admin/users/${id}/permissions`), enabled: !!id })
export const useSaveUserPermissions = () =>
  useApiMutation(({ id, grants }: { id: number; grants: unknown[] }) => api.put(`/admin/users/${id}/permissions`, { grants }), { invalidate: [['user-permissions']], success: 'Permissions saved' })

export const usePermissionCatalog = () => useQuery({ queryKey: ['permission-catalog'], queryFn: () => api.get<ModuleDef[]>('/admin/permissions'), staleTime: Infinity })

export const useRoles = () => useQuery({ queryKey: ['roles'], queryFn: () => api.get<RoleDto[]>('/admin/roles') })
export const useCreateRole = () =>
  useApiMutation((name: string) => api.post<RoleDto>('/admin/roles', { name }), { invalidate: [['roles']], success: 'Role created' })
export const useSaveRolePermissions = () =>
  useApiMutation(({ id, grants }: { id: number; grants: unknown[] }) => api.put(`/admin/roles/${id}/permissions`, { grants }), { invalidate: [['roles']], success: 'Role permissions saved' })

export const useAdminBusiness = () => useQuery({ queryKey: ['admin-business'], queryFn: () => api.get<BusinessProfileDto>('/admin/business') })
export const useUpdateAdminBusiness = () =>
  useApiMutation((body: Record<string, unknown>) => api.patch<BusinessProfileDto>('/admin/business', body), { invalidate: [['admin-business']], success: 'Business updated' })
export const useChangePassword = () =>
  useApiMutation((body: { current: string; next: string }) => api.post('/auth/password', body), { success: 'Password changed' })
export const useSetMpin = () => useApiMutation((body: { password: string; mpin: string }) => api.post('/auth/mpin', body), { success: 'MPIN saved' })
export const useAdminSubscription = () =>
  useQuery({ queryKey: ['admin-subscription'], queryFn: () => api.get<SubscriptionViewDto>('/admin/subscription') })
// TASK-95 — owner submits a payment (always PENDING), optionally with a screenshot; Super Admin confirms/rejects.
export const useSubmitSubscriptionPayment = () =>
  useApiMutation(
    async ({ body, file }: { body: Record<string, unknown>; file?: File | null }) => {
      const { id } = await api.post<{ id: number }>('/admin/subscription/payments', body)
      if (file) {
        const fd = new FormData()
        fd.append('file', file)
        await api.post(`/admin/subscription/payments/${id}/proof`, fd)
      }
      return id
    },
    { invalidate: [['admin-subscription']], success: 'Payment submitted for confirmation' },
  )
export const useReviewPayment = () =>
  useApiMutation(({ id, status }: { id: number; status: 'CONFIRMED' | 'REJECTED' }) => api.patch<PaymentDto>(`/platform/payments/${id}`, { status }), {
    invalidate: [['payments']],
    success: 'Payment updated',
  })

// TASK-87 permission enquiries — staff (/app) request + mine; admin (/admin) inbox + approve/reject.
export const useMyEnquiries = () =>
  useQuery({ queryKey: ['my-enquiries'], queryFn: () => api.get<PermissionEnquiryDto[]>('/app/permission-enquiries/mine') })
export const useCreateEnquiry = () =>
  useApiMutation((body: Record<string, unknown>) => api.post<PermissionEnquiryDto>('/app/permission-enquiries', body), { invalidate: [['my-enquiries']], success: 'Request sent' })
export const useEnquiries = (params: { page?: number; status?: string }) =>
  useQuery({ queryKey: ['enquiries', params], queryFn: () => api.get<Paged<PermissionEnquiryDto>>(`/admin/permission-enquiries${qs(params)}`) })
export const useApproveEnquiry = () =>
  useApiMutation((id: number) => api.post(`/admin/permission-enquiries/${id}/approve`), { invalidate: [['enquiries'], ['users'], ['user-permissions']], success: 'Approved' })
export const useRejectEnquiry = () =>
  useApiMutation(({ id, note }: { id: number; note?: string }) => api.post(`/admin/permission-enquiries/${id}/reject`, { note }), { invalidate: [['enquiries']], success: 'Rejected' })

export type { MeDto }
