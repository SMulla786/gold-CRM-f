// Phase 7 — Just Bill (quick calculator bill). Routes /app/just-bills* (perm billing.just_bill).
import { useQuery } from '@tanstack/react-query'

import { api } from '@/lib/api'
import { qs, useApiMutation } from '@/lib/queries'
import type { JustBillDto, JustBillListItemDto, Paged } from '@/shared'

const JB_KEYS = [['just-bills'], ['ledger'], ['day-book'], ['party-balance'], ['dashboard']]

export const useJustBillNextNo = (enabled = true) =>
  useQuery({ queryKey: ['just-bill-next-no'], queryFn: () => api.get<{ billNo: string }>('/app/just-bills/next-no'), enabled })

export const useJustBills = (params: Record<string, string | number | undefined>) =>
  useQuery({ queryKey: ['just-bills', params], queryFn: () => api.get<Paged<JustBillListItemDto>>(`/app/just-bills${qs(params)}`) })

export const useJustBill = (id?: number) =>
  useQuery({ queryKey: ['just-bill', id], queryFn: () => api.get<JustBillDto>(`/app/just-bills/${id}`), enabled: !!id })

export const useCreateJustBill = () =>
  useApiMutation((body: Record<string, unknown>) => api.post<JustBillDto>('/app/just-bills', body), { invalidate: JB_KEYS, success: 'Just Bill saved' })

export const useDeleteJustBill = () =>
  useApiMutation(({ id, mpin }: { id: number; mpin: string }) => api.del(`/app/just-bills/${id}`, { mpin }), { invalidate: JB_KEYS, success: 'Just Bill deleted' })
