// Phase 8 — customer orders + karigar job work. Routes /app/orders*, /app/karigar-issues*.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { api } from '@/lib/api'
import { ApiException } from '@/lib/errors'
import { qs, useApiMutation } from '@/lib/queries'
import type { KarigarIssueDto, OrderDto, Paged } from '@/shared'

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
/**
 * Bulk cancel = the single cancel endpoint called once per order with the same MPIN (no bulk endpoint).
 * A wrong MPIN rethrows so MpinDialog stays open; any other per-order failure is collected and reported.
 */
export const useBulkCancelOrders = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ orders, mpin }: { orders: Array<{ id: number; orderNo: number }>; mpin: string }) => {
      const failed: string[] = []
      let done = 0
      for (const o of orders) {
        try {
          await api.post(`/app/orders/${o.id}/cancel`, undefined, { mpin })
          done++
        } catch (e) {
          if (e instanceof ApiException && e.code === 'MPIN_REQUIRED') throw e
          failed.push(`#${o.orderNo}: ${e instanceof ApiException ? e.message : 'failed'}`)
        }
      }
      return { done, failed }
    },
    onSuccess: ({ done, failed }) => {
      if (done) toast.success(`${done} order${done === 1 ? '' : 's'} cancelled`)
      if (failed.length) toast.error(`Not cancelled: ${failed.join('; ')}`)
    },
    onSettled: () => ORDER_KEYS.forEach((key) => qc.invalidateQueries({ queryKey: key })),
  })
}

export const useKarigarIssues = (params: Record<string, string | number | undefined>) =>
  useQuery({ queryKey: ['karigar-issues', params], queryFn: () => api.get<Paged<KarigarIssueDto>>(`/app/karigar-issues${qs(params)}`) })
export const useKarigarIssue = (id?: number) =>
  useQuery({ queryKey: ['karigar-issues', 'one', id], queryFn: () => api.get<KarigarIssueDto>(`/app/karigar-issues/${id}`), enabled: !!id })
export const useCreateKarigarIssue = () =>
  useApiMutation((body: Record<string, unknown>) => api.post<KarigarIssueDto>('/app/karigar-issues', body), { invalidate: ORDER_KEYS, success: 'Issued to karigar' })
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
