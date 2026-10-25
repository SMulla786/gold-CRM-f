// Phase 4 billing — hooks against /api/app/bills/*. Create is a raw mutation (no default error
// toast) so the caller can handle PAN_REQUIRED / RATE_LIMIT from the error details.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api'
import { qs, useApiMutation } from '@/lib/queries'
import { RATE_UNIT_GRAMS } from '@/shared'
import type { BalanceDto, BillDto, BillListItemDto, Paged, SettingsDto } from '@/shared'

export const useNextBillNo = (kind: string, billType: string, enabled = true) =>
  useQuery({ queryKey: ['bill-next-no', kind, billType], queryFn: () => api.get<{ billNo: string }>(`/app/bills/next-no${qs({ kind, billType })}`), enabled })

export const useBills = (params: Record<string, string | number | undefined>) =>
  useQuery({ queryKey: ['bills', params], queryFn: () => api.get<Paged<BillListItemDto>>(`/app/bills${qs(params)}`) })

export const useBill = (id?: number) =>
  useQuery({ queryKey: ['bill', id], queryFn: () => api.get<BillDto>(`/app/bills/${id}`), enabled: !!id })

// bills move stock + ledger + party balances, so refresh all of them.
const BILL_KEYS = [['bills'], ['bill'], ['stock'], ['stock-summary'], ['stock-groups'], ['ledger'], ['day-book'], ['party-balance']]

export function useCreateBill() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post<BillDto>('/app/bills', body),
    onSuccess: () => BILL_KEYS.forEach((key) => qc.invalidateQueries({ queryKey: key })),
  })
}

// edit = PATCH; like create it can answer PAN_REQUIRED / RATE_LIMIT, so keep it raw (caller handles errors).
export function useUpdateBill() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body, mpin }: { id: number; body: Record<string, unknown>; mpin: string }) => api.patch<BillDto>(`/app/bills/${id}`, body, { mpin }),
    onSuccess: () => BILL_KEYS.forEach((key) => qc.invalidateQueries({ queryKey: key })),
  })
}

export const useAddBillPayments = () =>
  useApiMutation(({ id, body }: { id: number; body: Record<string, unknown> }) => api.post<BillDto>(`/app/bills/${id}/payments`, body), { invalidate: BILL_KEYS, success: 'Payment added' })

export const useDeleteBill = () =>
  useApiMutation(({ id, returnStock, mpin }: { id: number; returnStock: boolean; mpin: string }) => api.del(`/app/bills/${id}${qs({ returnStock: String(returnStock) })}`, { mpin }), { invalidate: BILL_KEYS, success: 'Bill deleted' })

/** Party balance snapshot — best effort; the udhari backend (TASK-31) may not be live yet, so callers tolerate failure. */
export const usePartyBalance = (partyId?: number) =>
  useQuery({ queryKey: ['party-balance', partyId], queryFn: () => api.get<BalanceDto>(`/app/udhar/parties/${partyId}/balance`), enabled: !!partyId, retry: false })

/** Grams in one rate unit for a bill line: SELL uses the shop's metal rate units, PURCHASE is per gram, non-metal is 1. */
export function lineRateUnitGrams(kind: string, stockClass: string | undefined, settings?: SettingsDto): number {
  if (kind === 'PURCHASE') return 1
  if (stockClass === 'GOLD') return RATE_UNIT_GRAMS[settings?.['rates.units'].gold ?? 'GRAM_10']
  if (stockClass === 'SILVER') return RATE_UNIT_GRAMS[settings?.['rates.units'].silver ?? 'KG_1']
  return 1
}

/** Grams in one rate unit for a METAL payment (always the shop's metal rate units). */
export function metalRateUnitGrams(metal: string, settings?: SettingsDto): number {
  const key = metal === 'GOLD' ? (settings?.['rates.units'].gold ?? 'GRAM_10') : (settings?.['rates.units'].silver ?? 'KG_1')
  return RATE_UNIT_GRAMS[key]
}
