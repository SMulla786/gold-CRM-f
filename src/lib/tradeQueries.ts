// Phase 10 — exchange, kacha processing, bullion buy-sell, bhav booking. Routes /app/exchange|kacha|buy-sell|bhav-booking.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { api } from '@/lib/api'
import { ApiException } from '@/lib/errors'
import { qs, useApiMutation } from '@/lib/queries'
import type { BhavBookingDto, BuySellDto, ExchangeDto, KachaBalanceDto, KachaProcessDto, Paged } from '@/shared'

const TRADE_KEYS = [['exchange'], ['kacha'], ['kacha-balance'], ['buy-sell'], ['bhav-booking'], ['ledger'], ['day-book'], ['party-balance'], ['dashboard']]

// ── Exchange ──
export const useExchanges = (params: Record<string, string | number | undefined>) =>
  useQuery({ queryKey: ['exchange', params], queryFn: () => api.get<Paged<ExchangeDto>>(`/app/exchange${qs(params)}`) })
export const useCreateExchange = () =>
  useApiMutation((body: Record<string, unknown>) => api.post<ExchangeDto>('/app/exchange', body), { invalidate: TRADE_KEYS, success: 'Exchange saved' })
export const useDeleteExchange = () =>
  useApiMutation(({ id, mpin }: { id: number; mpin: string }) => api.del(`/app/exchange/${id}`, { mpin }), { invalidate: TRADE_KEYS, success: 'Exchange deleted' })

// ── Kacha pool ──
export const useKachaList = (params: Record<string, string | number | undefined>) =>
  useQuery({ queryKey: ['kacha', params], queryFn: () => api.get<Paged<KachaProcessDto>>(`/app/kacha${qs(params)}`) })
export const useKachaBalance = (metal: string) =>
  useQuery({ queryKey: ['kacha-balance', metal], queryFn: () => api.get<KachaBalanceDto>(`/app/kacha/balance${qs({ metal })}`) })
export const useKachaProcess = () =>
  useApiMutation(({ body, mpin }: { body: Record<string, unknown>; mpin: string }) => api.post<KachaProcessDto>('/app/kacha/process', body, { mpin }), { invalidate: TRADE_KEYS, success: 'Processed' })
export const useRevertKacha = () =>
  useApiMutation(({ id, mpin }: { id: number; mpin: string }) => api.post(`/app/kacha/${id}/revert`, undefined, { mpin }), { invalidate: TRADE_KEYS, success: 'Reverted' })

// ── Buy-sell ──
export const useBuySells = (params: Record<string, string | number | undefined>) =>
  useQuery({ queryKey: ['buy-sell', params], queryFn: () => api.get<Paged<BuySellDto>>(`/app/buy-sell${qs(params)}`) })
export const useCreateBuySell = () =>
  useApiMutation((body: Record<string, unknown>) => api.post<BuySellDto>('/app/buy-sell', body), { invalidate: TRADE_KEYS, success: 'Trade saved' })
export const useDeleteBuySell = () =>
  useApiMutation(({ id, mpin }: { id: number; mpin: string }) => api.del(`/app/buy-sell/${id}`, { mpin }), { invalidate: TRADE_KEYS, success: 'Trade deleted' })

// ── Bhav booking ──
export const useBhavBookings = (params: Record<string, string | number | undefined>) =>
  useQuery({ queryKey: ['bhav-booking', params], queryFn: () => api.get<Paged<BhavBookingDto>>(`/app/bhav-booking${qs(params)}`) })
export const useBhavBooking = (id?: number) =>
  useQuery({ queryKey: ['bhav-booking', 'one', id], queryFn: () => api.get<BhavBookingDto>(`/app/bhav-booking/${id}`), enabled: !!id })
export const useCreateBhav = () =>
  useApiMutation((body: Record<string, unknown>) => api.post<BhavBookingDto>('/app/bhav-booking', body), { invalidate: TRADE_KEYS, success: 'Booking saved' })
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
