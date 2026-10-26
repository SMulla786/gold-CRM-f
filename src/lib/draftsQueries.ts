// Phase 7 — showroom drafts. Routes /app/drafts* (billing.showroom_drafts; decide = billing.draft_approvals).
import { useQuery } from '@tanstack/react-query'

import { api } from '@/lib/api'
import { qs, useApiMutation } from '@/lib/queries'
import type { Paged, SalesDraftDto } from '@/shared'

const DRAFT_KEYS = [['drafts']]

export const useDrafts = (params: Record<string, string | number | undefined>) =>
  useQuery({ queryKey: ['drafts', params], queryFn: () => api.get<Paged<SalesDraftDto>>(`/app/drafts${qs(params)}`) })

export const useDraft = (id?: number) =>
  useQuery({ queryKey: ['drafts', 'one', id], queryFn: () => api.get<SalesDraftDto>(`/app/drafts/${id}`), enabled: !!id })

export const useCreateDraft = () =>
  useApiMutation((body: Record<string, unknown>) => api.post<SalesDraftDto>('/app/drafts', body), { invalidate: DRAFT_KEYS, success: 'Sent for approval' })

export const useDraftDecision = () =>
  useApiMutation(({ id, body }: { id: number; body: Record<string, unknown> }) => api.post(`/app/drafts/${id}/decision`, body), { invalidate: DRAFT_KEYS, success: 'Draft updated' })

export const useCancelDraft = () =>
  useApiMutation(({ id }: { id: number }) => api.post(`/app/drafts/${id}/cancel`), { invalidate: DRAFT_KEYS, success: 'Draft cancelled' })

export const useDeleteDraft = () =>
  useApiMutation(({ id, mpin }: { id: number; mpin: string }) => api.del(`/app/drafts/${id}`, { mpin }), { invalidate: DRAFT_KEYS, success: 'Draft deleted' })

/** Imperative retrieval for the Sell Bill "Retrieve draft" box (409 unless APPROVED and not expired). */
export const fetchDraftByNo = (draftNo: number) => api.get<SalesDraftDto>(`/app/drafts/by-no/${draftNo}`)
