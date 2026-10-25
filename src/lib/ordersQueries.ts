// Phase 8 — customer orders + karigar job work. Routes /app/orders*, /app/karigar-issues*.
import { useQuery } from '@tanstack/react-query'

import { api } from '@/lib/api'
import { qs, useApiMutation } from '@/lib/queries'
import type { KarigarIssueDto, OrderDto, Paged } from '@/shared'

const ORDER_KEYS = [['orders'], ['karigar-issues'], ['stock'], ['ledger'], ['day-book'], ['party-balance'], ['dashboard']]

export const useOrders = (params: Record<string, string | number | undefined>) =>
  useQuery({ queryKey: ['orders', params], queryFn: () => api.get<Paged<OrderDto>>(`/app/orders${qs(params)}`) })
export const useOrder = (id?: number) =>
  useQuery({ queryKey: ['order', id], queryFn: () => api.get<OrderDto>(`/app/orders/${id}`), enabled: !!id })
export const useCreateOrder = () =>
  useApiMutation((body: Record<string, unknown>) => api.post<OrderDto>('/app/orders', body), { invalidate: ORDER_KEYS, success: 'Order created' })
export const useAddOrderAdvance = () =>
  useApiMutation(({ id, body }: { id: number; body: Record<string, unknown> }) => api.post<OrderDto>(`/app/orders/${id}/advance`, body), { invalidate: ORDER_KEYS, success: 'Advance added' })
export const useCancelOrder = () =>
  useApiMutation(({ id, mpin }: { id: number; mpin: string }) => api.post(`/app/orders/${id}/cancel`, undefined, { mpin }), { invalidate: ORDER_KEYS, success: 'Order cancelled' })

export const useKarigarIssues = (params: Record<string, string | number | undefined>) =>
  useQuery({ queryKey: ['karigar-issues', params], queryFn: () => api.get<Paged<KarigarIssueDto>>(`/app/karigar-issues${qs(params)}`) })
export const useCreateKarigarIssue = () =>
  useApiMutation((body: Record<string, unknown>) => api.post<KarigarIssueDto>('/app/karigar-issues', body), { invalidate: ORDER_KEYS, success: 'Issued to karigar' })
export const useReceiveKarigarIssue = () =>
  useApiMutation(({ id, body }: { id: number; body: Record<string, unknown> }) => api.post<KarigarIssueDto>(`/app/karigar-issues/${id}/receive`, body), { invalidate: ORDER_KEYS, success: 'Received from karigar' })
