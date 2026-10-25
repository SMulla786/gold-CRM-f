// Phase 8 — jewellery repair. Routes /app/repairs* (perm repair.entry).
import { useQuery } from '@tanstack/react-query'

import { api } from '@/lib/api'
import { qs, useApiMutation } from '@/lib/queries'
import type { Paged, RepairTicketDto } from '@/shared'

const REPAIR_KEYS = [['repairs'], ['ledger'], ['day-book'], ['party-balance'], ['dashboard']]

export const useRepairs = (params: Record<string, string | number | undefined>) =>
  useQuery({ queryKey: ['repairs', params], queryFn: () => api.get<Paged<RepairTicketDto>>(`/app/repairs${qs(params)}`) })

export const useCreateRepair = () =>
  useApiMutation((body: Record<string, unknown>) => api.post<RepairTicketDto>('/app/repairs', body), { invalidate: REPAIR_KEYS, success: 'Ticket created' })

export const useRepairStatus = () =>
  useApiMutation(({ id, body }: { id: number; body: Record<string, unknown> }) => api.post<RepairTicketDto>(`/app/repairs/${id}/status`, body), { invalidate: REPAIR_KEYS, success: 'Status updated' })

export const useRepairDeliver = () =>
  useApiMutation(({ id, body }: { id: number; body: Record<string, unknown> }) => api.post<RepairTicketDto>(`/app/repairs/${id}/deliver`, body), { invalidate: REPAIR_KEYS, success: 'Delivered' })
