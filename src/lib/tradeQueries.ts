// Phase 10 — exchange, kacha processing, bullion buy-sell, bhav booking. Routes /app/exchange|kacha|buy-sell|bhav-booking.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { api } from '@/lib/api'
import { ApiException } from '@/lib/errors'
import { qs, useApiMutation } from '@/lib/queries'
import type { BhavBookingDto, BuySellDto, ExchangeDto, KachaBalanceDto, KachaProcessDto, Paged, TradeHistoryDto } from '@/shared'

const TRADE_KEYS = [['exchange'], ['kacha'], ['kacha-balance'], ['buy-sell'], ['bhav-booking'], ['ledger'], ['day-book'], ['party-balance'], ['dashboard']]

// ── Exchange ──
export const useExchanges = (params: Record<string, string | number | undefined>) =>
  useQuery({ queryKey: ['exchange', params], queryFn: () => api.get<Paged<ExchangeDto>>(`/app/exchange${qs(params)}`) })
/** One exchange (GET /app/exchange/:id) — receipt print view. */
export const useExchange = (id: number) =>
  useQuery({ queryKey: ['exchange', 'one', id], queryFn: () => api.get<ExchangeDto>(`/app/exchange/${id}`), enabled: Number.isInteger(id) && id > 0 })
export const useCreateExchange = () =>
  useApiMutation((body: Record<string, unknown>) => api.post<ExchangeDto>('/app/exchange', body), { invalidate: TRADE_KEYS, success: 'Exchange saved' })
export const useUpdateExchange = () =>
  useApiMutation(({ id, mpin, body }: { id: number; mpin: string; body: Record<string, unknown> }) => api.put<ExchangeDto>(`/app/exchange/${id}`, body, { mpin }), { invalidate: TRADE_KEYS, success: 'Exchange updated' })
export const useDeleteExchange = () =>
  useApiMutation(({ id, mpin }: { id: number; mpin: string }) => api.del(`/app/exchange/${id}`, { mpin }), { invalidate: TRADE_KEYS, success: 'Exchange deleted' })

// ── Kacha pool ──
export const useKachaList = (params: Record<string, string | number | undefined>) =>
  useQuery({ queryKey: ['kacha', params], queryFn: () => api.get<Paged<KachaProcessDto>>(`/app/kacha${qs(params)}`) })
export const useKachaBalance = (metal: string) =>
  useQuery({ queryKey: ['kacha-balance', metal], queryFn: () => api.get<KachaBalanceDto>(`/app/kacha/balance${qs({ metal: metal || undefined })}`) })
export const useKachaProcess = () =>
  useApiMutation(({ body, mpin }: { body: Record<string, unknown>; mpin: string }) => api.post<KachaProcessDto>('/app/kacha/process', body, { mpin }), { invalidate: TRADE_KEYS, success: 'Processed' })
export const useRevertKacha = () =>
  useApiMutation(({ id, mpin }: { id: number; mpin: string }) => api.post(`/app/kacha/${id}/revert`, undefined, { mpin }), { invalidate: TRADE_KEYS, success: 'Reverted' })

// ── Buy-sell ──
export const useBuySells = (params: Record<string, string | number | undefined>) =>
  useQuery({ queryKey: ['buy-sell', params], queryFn: () => api.get<Paged<BuySellDto>>(`/app/buy-sell${qs(params)}`) })
/** One trade (GET /app/buy-sell/:id) — slip print view. */
export const useBuySell = (id: number) =>
  useQuery({ queryKey: ['buy-sell', 'one', id], queryFn: () => api.get<BuySellDto>(`/app/buy-sell/${id}`), enabled: Number.isInteger(id) && id > 0 })
export const useCreateBuySell = () =>
  useApiMutation((body: Record<string, unknown>) => api.post<BuySellDto>('/app/buy-sell', body), { invalidate: TRADE_KEYS, success: 'Trade saved' })
export const useUpdateBuySell = () =>
  useApiMutation(({ id, mpin, body }: { id: number; mpin: string; body: Record<string, unknown> }) => api.put<BuySellDto>(`/app/buy-sell/${id}`, body, { mpin }), { invalidate: TRADE_KEYS, success: 'Trade updated' })
export const useDeleteBuySell = () =>
  useApiMutation(({ id, mpin }: { id: number; mpin: string }) => api.del(`/app/buy-sell/${id}`, { mpin }), { invalidate: TRADE_KEYS, success: 'Trade deleted' })

// ── Bhav booking ──
export const useBhavBookings = (params: Record<string, string | number | undefined>) =>
  useQuery({ queryKey: ['bhav-booking', params], queryFn: () => api.get<Paged<BhavBookingDto>>(`/app/bhav-booking${qs(params)}`) })
export const useBhavBooking = (id?: number) =>
  useQuery({ queryKey: ['bhav-booking', 'one', id], queryFn: () => api.get<BhavBookingDto>(`/app/bhav-booking/${id}`), enabled: !!id })
export const useCreateBhav = () =>
  useApiMutation((body: Record<string, unknown>) => api.post<BhavBookingDto>('/app/bhav-booking', body), { invalidate: TRADE_KEYS, success: 'Booking saved' })
export const useUpdateBhav = () =>
  useApiMutation(({ id, mpin, body }: { id: number; mpin: string; body: Record<string, unknown> }) => api.put<BhavBookingDto>(`/app/bhav-booking/${id}`, body, { mpin }), { invalidate: TRADE_KEYS, success: 'Booking updated' })
export const useUndeliverBhav = () =>
  useApiMutation(({ id, mpin }: { id: number; mpin: string }) => api.post(`/app/bhav-booking/${id}/undeliver`, undefined, { mpin }), { invalidate: TRADE_KEYS, success: 'Marked undelivered' })
export const useVerifyBhav = () =>
  useApiMutation(({ id, verified }: { id: number; verified: boolean }) => api.post(`/app/bhav-booking/${id}/${verified ? 'verify' : 'unverify'}`), { invalidate: [['bhav-booking']], success: 'Saved' })
export const useCancelBhav = () =>
  useApiMutation(({ id, mpin }: { id: number; mpin: string }) => api.post(`/app/bhav-booking/${id}/cancel`, undefined, { mpin }), { invalidate: TRADE_KEYS, success: 'Booking cancelled' })
export const useDeleteBhav = () =>
  useApiMutation(({ id, mpin }: { id: number; mpin: string }) => api.del(`/app/bhav-booking/${id}`, { mpin }), { invalidate: TRADE_KEYS, success: 'Booking deleted' })
/**
 * Bulk delete = the single delete endpoint called once per booking with the same MPIN (no bulk endpoint).
 * A wrong MPIN rethrows so MpinDialog stays open; any other per-booking failure is collected and reported.
 */
export const useBulkDeleteBhav = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ bookings, mpin }: { bookings: Array<{ id: number; bookingNo: number }>; mpin: string }) => {
      const failed: string[] = []
      let done = 0
      for (const b of bookings) {
        try {
          await api.del(`/app/bhav-booking/${b.id}`, { mpin })
          done++
        } catch (e) {
          if (e instanceof ApiException && e.code === 'MPIN_REQUIRED') throw e
          failed.push(`#${b.bookingNo}: ${e instanceof ApiException ? e.message : 'failed'}`)
        }
      }
      return { done, failed }
    },
    onSuccess: ({ done, failed }) => {
      if (done) toast.success(`${done} booking${done === 1 ? '' : 's'} deleted`)
      if (failed.length) toast.error(`Not deleted: ${failed.join('; ')}`)
    },
    onSettled: () => TRADE_KEYS.forEach((key) => qc.invalidateQueries({ queryKey: key })),
  })
}

/** Audit trail of one trade document (GET /app/{exchange|buy-sell|bhav-booking}/:id/history). */
export const useTradeHistory = (kind: 'exchange' | 'buy-sell' | 'bhav-booking', id?: number) =>
  useQuery({ queryKey: [kind, 'history', id], queryFn: () => api.get<TradeHistoryDto[]>(`/app/${kind}/${id}/history`), enabled: !!id })

/**
 * Run one existing per-item call for each item with the same MPIN, one after another (there is no bulk endpoint).
 * A wrong MPIN rethrows so MpinDialog stays open; any other failure is collected as "#<no>: <message>".
 */
async function loopWithMpin<T extends { no: number }>(items: T[], run: (item: T) => Promise<unknown>): Promise<{ done: number; failed: string[] }> {
  const failed: string[] = []
  let done = 0
  for (const item of items) {
    try {
      await run(item)
      done++
    } catch (e) {
      if (e instanceof ApiException && e.code === 'MPIN_REQUIRED') throw e
      failed.push(`#${item.no}: ${e instanceof ApiException ? e.message : 'failed'}`)
    }
  }
  return { done, failed }
}

/** Bulk "send to melt" = POST /app/kacha/process once per exchange (same body the row dialog sends). Caller toasts the result. */
export const useBulkKachaProcess = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ items, mpin }: { items: Array<{ no: number; body: Record<string, unknown> }>; mpin: string }) =>
      loopWithMpin(items, (x) => api.post<KachaProcessDto>('/app/kacha/process', x.body, { mpin })),
    onSettled: () => TRADE_KEYS.forEach((key) => qc.invalidateQueries({ queryKey: key })),
  })
}

/** Bulk revert = POST /app/kacha/:id/revert once per process. `no` labels a failure (the S.No shown in the list). Caller toasts the result. */
export const useBulkRevertKacha = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ items, mpin }: { items: Array<{ id: number; no: number }>; mpin: string }) =>
      loopWithMpin(items, (x) => api.post(`/app/kacha/${x.id}/revert`, undefined, { mpin })),
    onSettled: () => TRADE_KEYS.forEach((key) => qc.invalidateQueries({ queryKey: key })),
  })
}
