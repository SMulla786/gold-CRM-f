// Phase 11 — saving schemes + Anjuman. Routes under /app/schemes. Balances live on the enrollment; no udhar until redeem.
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'

import { api } from '@/lib/api'
import { ApiException } from '@/lib/errors'
import { qs, useApiMutation } from '@/lib/queries'
import type {
  EnrollmentDetailDto, EnrollmentDto, Paged, SchemeDayBookDto, SchemeDto,
  SchemeDueRowDto, SchemeGroupDto, SchemeTxnRowDto,
} from '@/shared'

const KEYS = [['schemes'], ['scheme-groups'], ['enrollments'], ['enrollment'], ['scheme-dues'], ['scheme-txns'], ['scheme-daybook'], ['ledger'], ['day-book'], ['party-balance'], ['dashboard']]

// ── Schemes ──
export const useSchemes = (params: Record<string, string | number | undefined>) =>
  useQuery({ queryKey: ['schemes', params], queryFn: () => api.get<Paged<SchemeDto>>(`/app/schemes${qs(params)}`) })
export const useScheme = (id: number) =>
  useQuery({ queryKey: ['scheme', id], queryFn: () => api.get<SchemeDto>(`/app/schemes/${id}`), enabled: !!id })
export const useCreateScheme = () =>
  useApiMutation((body: Record<string, unknown>) => api.post<SchemeDto>('/app/schemes', body), { invalidate: KEYS, success: 'Scheme created' })
export const usePatchScheme = () =>
  useApiMutation(({ id, body }: { id: number; body: Record<string, unknown> }) => api.patch<SchemeDto>(`/app/schemes/${id}`, body), { invalidate: KEYS, success: 'Scheme updated' })

// ── Groups ──
export const useSchemeGroups = (schemeId?: number) =>
  useQuery({ queryKey: ['scheme-groups', schemeId], queryFn: () => api.get<SchemeGroupDto[]>(`/app/schemes/groups${qs({ schemeId })}`) })
export const useCreateGroup = () =>
  useApiMutation((body: Record<string, unknown>) => api.post<SchemeGroupDto>('/app/schemes/groups', body), { invalidate: KEYS, success: 'Group created' })

// ── Enrollments ──
export const useEnrollments = (params: Record<string, string | number | undefined>) =>
  useQuery({ queryKey: ['enrollments', params], queryFn: () => api.get<Paged<EnrollmentDto>>(`/app/schemes/enrollments${qs(params)}`) })
export const useEnrollment = (id: number) =>
  useQuery({ queryKey: ['enrollment', id], queryFn: () => api.get<EnrollmentDetailDto>(`/app/schemes/enrollments/${id}`), enabled: !!id })
export const useEnroll = () =>
  useApiMutation((body: Record<string, unknown>) => api.post<EnrollmentDetailDto>('/app/schemes/enrollments', body), { invalidate: KEYS, success: 'Member enrolled' })
/** Bulk enrol: one independent POST per member (no bulk endpoint needed); each succeeds or fails on its own. */
export interface BulkEnrollResult { ok: boolean; error?: string }
export const useBulkEnroll = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (bodies: Record<string, unknown>[]): Promise<BulkEnrollResult[]> => {
      const settled = await Promise.allSettled(bodies.map((b) => api.post<EnrollmentDto>('/app/schemes/enrollments', b)))
      return settled.map((r) => (r.status === 'fulfilled' ? { ok: true } : { ok: false, error: r.reason instanceof ApiException ? r.reason.message : 'Failed' }))
    },
    onSettled: () => KEYS.forEach((k) => qc.invalidateQueries({ queryKey: k })),
  })
}
export const useMarkWon = () =>
  useApiMutation(({ id, mpin, remark }: { id: number; mpin: string; remark?: string }) => api.post(`/app/schemes/enrollments/${id}/won`, { remark }, { mpin }), { invalidate: KEYS, success: 'Marked as won' })
export const useRedeem = () =>
  useApiMutation(({ id, mpin, body }: { id: number; mpin: string; body: Record<string, unknown> }) => api.post(`/app/schemes/enrollments/${id}/redeem`, body, { mpin }), { invalidate: KEYS, success: 'Redeemed' })

// ── Payments ──
export const useAddSchemePayment = () =>
  useApiMutation((body: Record<string, unknown>) => api.post<EnrollmentDetailDto>('/app/schemes/payments', body), { invalidate: KEYS, success: 'Payment added' })
export const useReversePayment = () =>
  useApiMutation(({ id, mpin }: { id: number; mpin: string }) => api.post(`/app/schemes/payments/${id}/reverse`, undefined, { mpin }), { invalidate: KEYS, success: 'Payment reversed' })

// ── Reports ──
export const useSchemeDues = (params: Record<string, string | number | undefined>) =>
  useQuery({ queryKey: ['scheme-dues', params], queryFn: () => api.get<SchemeDueRowDto[]>(`/app/schemes/dues${qs(params)}`) })
export const useSchemeTransactions = (params: Record<string, string | number | undefined>) =>
  useQuery({ queryKey: ['scheme-txns', params], queryFn: () => api.get<Paged<SchemeTxnRowDto>>(`/app/schemes/transactions${qs(params)}`) })
export const useSchemeDayBook = (params: Record<string, string | number | undefined>) =>
  useQuery({ queryKey: ['scheme-daybook', params], queryFn: () => api.get<SchemeDayBookDto>(`/app/schemes/day-book${qs(params)}`) })
