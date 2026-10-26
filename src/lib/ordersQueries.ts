// Phase 8 — customer orders + karigar job work. Routes /app/orders*, /app/karigar-issues*.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { api } from '@/lib/api'
import { ApiException } from '@/lib/errors'
import { qs, useApiMutation } from '@/lib/queries'
import type { BulkCancelOrdersResultDto, KarigarIssueDto, OrderDto, OrderNextNoDto, Paged } from '@/shared'

const ORDER_KEYS = [['orders'], ['order'], ['karigar-issues'], ['stock'], ['ledger'], ['day-book'], ['party-balance'], ['dashboard']]

export const useOrders = (params: Record<string, string | number | undefined>, enabled = true) =>
  useQuery({ queryKey: ['orders', params], queryFn: () => api.get<Paged<OrderDto>>(`/app/orders${qs(params)}`), enabled })
export const useOrder = (id?: number) =>
  useQuery({ queryKey: ['order', id], queryFn: () => api.get<OrderDto>(`/app/orders/${id}`), enabled: !!id })
export const useCreateOrder = () =>
  useApiMutation((body: Record<string, unknown>) => api.post<OrderDto>('/app/orders', body), { invalidate: ORDER_KEYS, success: 'Order created' })
export const useAddOrderAdvance = () =>
  useApiMutation(({ id, body }: { id: number; body: Record<string, unknown> }) => api.post<OrderDto>(`/app/orders/${id}/advance`, body), { invalidate: ORDER_KEYS, success: 'Advance added' })
export const useCancelOrder = () =>
  useApiMutation(({ id, mpin }: { id: number; mpin: string }) => api.post(`/app/orders/${id}/cancel`, undefined, { mpin }), { invalidate: ORDER_KEYS, success: 'Order cancelled' })
/** TASK-98: next order no. for the active branch. A peek, not a reservation (a concurrent create may take it). */
export const useNextOrderNo = (enabled = true, branch?: string) =>
  useQuery({ queryKey: ['orders', 'next-no', branch], queryFn: () => api.get<OrderNextNoDto>('/app/orders/next-no'), enabled, refetchOnWindowFocus: true, staleTime: 0 })
/**
 * TASK-98 bulk cancel: POST /orders/bulk-cancel (MPIN, 1..100 ids, one tx per order on the server).
 * A wrong MPIN throws so MpinDialog stays open; per-order failures come back in `failed`.
 */
export const useBulkCancelOrders = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ ids, mpin }: { ids: number[]; mpin: string }) => api.post<BulkCancelOrdersResultDto>('/app/orders/bulk-cancel', { ids }, { mpin }),
    onSuccess: ({ cancelled, failed }) => {
      const msg = `Cancelled ${cancelled.length}, failed ${failed.length}`
      if (failed.length) toast.warning(msg)
      else toast.success(msg)
    },
    onSettled: () => ORDER_KEYS.forEach((key) => qc.invalidateQueries({ queryKey: key })),
  })
}

export const useKarigarIssues = (params: Record<string, string | number | undefined>) =>
  useQuery({ queryKey: ['karigar-issues', params], queryFn: () => api.get<Paged<KarigarIssueDto>>(`/app/karigar-issues${qs(params)}`) })
export const useKarigarIssue = (id?: number) =>
  useQuery({ queryKey: ['karigar-issues', 'one', id], queryFn: () => api.get<KarigarIssueDto>(`/app/karigar-issues/${id}`), enabled: !!id })
export const useCreateKarigarIssue = () =>
  useApiMutation((body: Record<string, unknown>) => api.post<KarigarIssueDto>('/app/karigar-issues', body), { invalidate: [...ORDER_KEYS, ['samples'], ['sample'], ['sample-search']], success: 'Issued to karigar' })
export const useReceiveKarigarIssue = () =>
  useApiMutation(({ id, body }: { id: number; body: Record<string, unknown> }) => api.post<KarigarIssueDto>(`/app/karigar-issues/${id}/receive`, body), { invalidate: ORDER_KEYS, success: 'Received from karigar' })

/** TASK-97 order design file (POST multipart field "file", JPEG/PNG/WebP/PDF, 2 MB); GET streams it (fetch via api.blob). */
export const orderDesignPath = (id: number) => `/app/orders/${id}/design`
export const DESIGN_MAX_BYTES = 2 * 1024 * 1024
export const useUploadOrderDesign = () =>
  useApiMutation(({ id, file }: { id: number; file: File }) => {
    if (file.size > DESIGN_MAX_BYTES) return Promise.reject(new ApiException(400, 'VALIDATION', 'Design file must be 2 MB or smaller'))
    const fd = new FormData()
    fd.append('file', file)
    return api.post<{ url: string }>(orderDesignPath(id), fd)
  }, { invalidate: [['order'], ['orders']], success: 'Design saved' })
export const useRemoveOrderDesign = () =>
  useApiMutation((id: number) => api.del(orderDesignPath(id)), { invalidate: [['order'], ['orders']], success: 'Design removed' })
