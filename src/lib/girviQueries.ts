// Phase 9 — girvi (pledge loans). Routes /app/girvi* (girvi.entry create/pay/release; girvi.ledger lists).
import { useQuery } from '@tanstack/react-query'

import { api } from '@/lib/api'
import { qs, useApiMutation } from '@/lib/queries'
import type { GirviBatchDto, GirviListItemDto, GirviTransferDto, Paged } from '@/shared'

const GIRVI_KEYS = [['girvi'], ['girvi-batch'], ['ledger'], ['day-book'], ['dashboard']]

export const useGirviList = (params: Record<string, string | number | undefined>) =>
  useQuery({ queryKey: ['girvi', params], queryFn: () => api.get<Paged<GirviListItemDto>>(`/app/girvi${qs(params)}`) })

export const useGirvi = (id?: number, asOf?: string) =>
  useQuery({ queryKey: ['girvi-batch', id, asOf], queryFn: () => api.get<GirviBatchDto>(`/app/girvi/${id}${qs({ asOf })}`), enabled: !!id })

export const useCreateGirvi = () =>
  useApiMutation((body: Record<string, unknown>) => api.post<GirviBatchDto>('/app/girvi', body), { invalidate: GIRVI_KEYS, success: 'Loan created' })

export const useGirviInterest = () =>
  useApiMutation(({ id, body }: { id: number; body: Record<string, unknown> }) => api.post<GirviBatchDto>(`/app/girvi/${id}/interest`, body), { invalidate: GIRVI_KEYS, success: 'Interest paid' })

export const useGirviTopup = () =>
  useApiMutation(({ id, body }: { id: number; body: Record<string, unknown> }) => api.post<GirviBatchDto>(`/app/girvi/${id}/topup`, body), { invalidate: GIRVI_KEYS, success: 'Top-up added' })

export const useGirviRelease = () =>
  useApiMutation(({ id, body }: { id: number; body: Record<string, unknown> }) => api.post<GirviBatchDto>(`/app/girvi/${id}/release`, body), { invalidate: GIRVI_KEYS, success: 'Items released' })

export const useDeleteGirvi = () =>
  useApiMutation(({ id, mpin }: { id: number; mpin: string }) => api.del(`/app/girvi/${id}`, { mpin }), { invalidate: GIRVI_KEYS, success: 'Loan deleted' })
export const useReplaceGirviItem = () =>
  useApiMutation(
    ({ id, itemId, body, mpin }: { id: number; itemId: number; body: Record<string, unknown>; mpin: string }) => api.patch<GirviBatchDto>(`/app/girvi/${id}/items/${itemId}`, body, { mpin }),
    { invalidate: GIRVI_KEYS, success: 'Item updated' },
  )

// Phase 9b — transfers (re-pledge to a lender): girvi.transfer view/edit
export const useGirviTransfers = (params: Record<string, string | number | undefined>) =>
  useQuery({ queryKey: ['girvi-transfers', params], queryFn: () => api.get<Paged<GirviTransferDto>>(`/app/girvi/transfers${qs(params)}`) })
export const useCreateGirviTransfer = () =>
  useApiMutation((body: Record<string, unknown>) => api.post<GirviTransferDto>('/app/girvi/transfers', body), { invalidate: [['girvi-transfers'], ...GIRVI_KEYS], success: 'Items transferred to lender' })
export const useReturnGirviTransfer = () =>
  useApiMutation(({ id, body }: { id: number; body: Record<string, unknown> }) => api.post<GirviTransferDto>(`/app/girvi/transfers/${id}/return`, body), {
    invalidate: [['girvi-transfers'], ...GIRVI_KEYS],
    success: 'Items received back',
  })
