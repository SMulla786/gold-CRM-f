// Phase 2 inventory — TanStack Query hooks against the real /api/app/* routes.
import { useQuery } from '@tanstack/react-query'

import { api } from '@/lib/api'
import { qs, useApiMutation } from '@/lib/queries'
import type {
  GroupStockDto,
  ItemGroupDto,
  ItemNameDto,
  JewelleryTypeDto,
  Paged,
  ShortageRowDto,
  StockEntryResultDto,
  StockImportResultDto,
  StockItemDto,
  StockSummaryDto,
} from '@/shared'

// ───── Masters ─────
export const useJewelleryTypes = (stockClass?: string) =>
  useQuery({ queryKey: ['jewellery-types', stockClass], queryFn: () => api.get<JewelleryTypeDto[]>(`/app/jewellery-types${qs({ stockClass })}`) })
export const useCreateJewelleryType = () =>
  useApiMutation((body: Record<string, unknown>) => api.post('/app/jewellery-types', body), { invalidate: [['jewellery-types']], success: 'Type added' })

export const useItemGroups = (params: { page?: number; q?: string; stockClass?: string; jewelleryTypeId?: number }) =>
  useQuery({ queryKey: ['item-groups', params], queryFn: () => api.get<Paged<ItemGroupDto>>(`/app/item-groups${qs(params)}`) })
export const useCreateItemGroup = () =>
  useApiMutation((body: Record<string, unknown>) => api.post('/app/item-groups', body), { invalidate: [['item-groups']], success: 'Groups created' })
export const useUpdateItemGroup = () =>
  useApiMutation(({ id, body }: { id: number; body: Record<string, unknown> }) => api.patch(`/app/item-groups/${id}`, body), { invalidate: [['item-groups']], success: 'Group updated' })

export const useItemNames = (params: { page?: number; q?: string; stockClass?: string; groupId?: number }) =>
  useQuery({ queryKey: ['item-names', params], queryFn: () => api.get<Paged<ItemNameDto>>(`/app/item-names${qs(params)}`) })
export const useCreateItemName = () =>
  useApiMutation((body: Record<string, unknown>) => api.post('/app/item-names', body), { invalidate: [['item-names']], success: 'Item name created' })
export const useUpdateItemName = () =>
  useApiMutation(({ id, body }: { id: number; body: Record<string, unknown> }) => api.patch(`/app/item-names/${id}`, body), { invalidate: [['item-names']], success: 'Item name updated' })

// ───── Stock ─────
export const useStockSummary = () => useQuery({ queryKey: ['stock-summary'], queryFn: () => api.get<StockSummaryDto[]>('/app/stock/summary') })
export const useStock = (params: Record<string, string | number | undefined>) =>
  useQuery({ queryKey: ['stock', params], queryFn: () => api.get<Paged<StockItemDto>>(`/app/stock${qs(params)}`) })
export const useGroupStock = (params: Record<string, string | number | undefined>) =>
  useQuery({ queryKey: ['stock-groups', params], queryFn: () => api.get<GroupStockDto[]>(`/app/stock/groups${qs(params)}`) })
export const useShortage = (params: Record<string, string | number | undefined>) =>
  useQuery({ queryKey: ['stock-shortage', params], queryFn: () => api.get<ShortageRowDto[]>(`/app/stock/shortage${qs(params)}`) })

export const useCreateStockEntry = () =>
  useApiMutation((body: Record<string, unknown>) => api.post<StockEntryResultDto>('/app/stock/entries', body), {
    invalidate: [['stock'], ['stock-summary'], ['stock-groups'], ['stock-shortage']],
    success: 'Stock added',
  })
export const useDeleteStock = () =>
  useApiMutation(({ id, mpin }: { id: number; mpin: string }) => api.del(`/app/stock/${id}`, { mpin }), {
    invalidate: [['stock'], ['stock-summary'], ['stock-groups'], ['stock-shortage']],
    success: 'Stock item deleted',
  })

/** CSV import — dryRun validates, real run imports all-or-nothing. */
export const useStockImport = () =>
  useApiMutation(({ file, fields }: { file: File; fields: Record<string, string> }) => {
    const fd = new FormData()
    fd.append('file', file)
    for (const [k, v] of Object.entries(fields)) fd.append(k, v)
    return api.post<StockImportResultDto>('/app/stock/import', fd)
  }, { invalidate: [['stock'], ['stock-summary']] })
