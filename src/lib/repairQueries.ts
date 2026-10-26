// Phase 8 — jewellery repair. Routes /app/repairs* (perm repair.entry).
import { useQuery } from '@tanstack/react-query'

import { api } from '@/lib/api'
import { qs, useApiMutation } from '@/lib/queries'
import type { Paged, RepairConsumableDto, RepairTicketDto } from '@/shared'

const REPAIR_KEYS = [['repairs'], ['ledger'], ['day-book'], ['party-balance'], ['dashboard']]

export const useRepairs = (params: Record<string, string | number | undefined>) =>
  useQuery({ queryKey: ['repairs', params], queryFn: () => api.get<Paged<RepairTicketDto>>(`/app/repairs${qs(params)}`) })

/** One ticket (GET /app/repairs/:id) — details dialog + print slip. Key under 'repairs' so mutations refresh it. */
export const useRepair = (id: number) =>
  useQuery({ queryKey: ['repairs', 'one', id], queryFn: () => api.get<RepairTicketDto>(`/app/repairs/${id}`), enabled: Number.isInteger(id) && id > 0 })

export const useCreateRepair = () =>
  useApiMutation((body: Record<string, unknown>) => api.post<RepairTicketDto>('/app/repairs', body), { invalidate: REPAIR_KEYS, success: 'Ticket created' })

export const useRepairStatus = () =>
  useApiMutation(({ id, body }: { id: number; body: Record<string, unknown> }) => api.post<RepairTicketDto>(`/app/repairs/${id}/status`, body), { invalidate: REPAIR_KEYS, success: 'Status updated' })

export const useRepairDeliver = () =>
  useApiMutation(({ id, body }: { id: number; body: Record<string, unknown> }) => api.post<RepairTicketDto>(`/app/repairs/${id}/deliver`, body), { invalidate: REPAIR_KEYS, success: 'Delivered' })

/** Ticket photo (POST /app/repairs/:id/photo, multipart field "photo"); streamed back via AuthedImage at repairPhotoPath. */
export const repairPhotoPath = (id: number) => `/app/repairs/${id}/photo`
export const useUploadRepairPhoto = () =>
  useApiMutation(({ id, file }: { id: number; file: File }) => {
    const fd = new FormData()
    fd.append('photo', file)
    return api.post<{ url: string }>(repairPhotoPath(id), fd)
  }, { invalidate: [['repairs']], success: 'Photo saved' })

// Consumables (solder, wire, polish…) — per-branch stock count, repair.entry view/edit.
export const useConsumables = () =>
  useQuery({ queryKey: ['repair-consumables'], queryFn: () => api.get<RepairConsumableDto[]>('/app/repair/consumables') })
export const useSaveConsumable = () =>
  useApiMutation(({ id, body }: { id?: number; body: Record<string, unknown> }) =>
    id ? api.patch<RepairConsumableDto>(`/app/repair/consumables/${id}`, body) : api.post<RepairConsumableDto>('/app/repair/consumables', body), { invalidate: [['repair-consumables']], success: 'Item saved' })
export const useAdjustConsumable = () =>
  useApiMutation(({ id, delta, reason }: { id: number; delta: number; reason?: string }) => api.post<RepairConsumableDto>(`/app/repair/consumables/${id}/adjust`, { delta, reason }), { invalidate: [['repair-consumables']], success: 'Stock updated' })
