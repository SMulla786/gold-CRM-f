// Phase 2 inventory — TanStack Query hooks against the real /api/app/* routes.
import { useQueries, useQuery } from '@tanstack/react-query'

import { api } from '@/lib/api'
import { qs, useApiMutation } from '@/lib/queries'
import type {
  AllStockSummaryDto,
  GroupStockDto,
  ItemGroupDto,
  ItemNameDto,
  JewelleryTypeDto,
  LedgerPageDto,
  NextTagDto,
  Paged,
  PrinterSettingsDto,
  SetStockCard,
  SetStockLogDto,
  ShortageRowDto,
  StockEntryResultDto,
  StockImportResultDto,
  StockItemDto,
  StockListPage,
  StockSummaryDto,
  StockTransferDetailDto,
  StockTransferDto,
  TagTemplateDto,
} from '@/shared'

// ───── Masters ─────
export const useJewelleryTypes = (stockClass?: string) =>
  useQuery({ queryKey: ['jewellery-types', stockClass], queryFn: () => api.get<JewelleryTypeDto[]>(`/app/jewellery-types${qs({ stockClass })}`) })
export const useCreateJewelleryType = () =>
  useApiMutation((body: Record<string, unknown>) => api.post('/app/jewellery-types', body), { invalidate: [['jewellery-types']], success: 'Type added' })

export const useItemGroups = (params: { page?: number; pageSize?: number; q?: string; stockClass?: string; jewelleryTypeId?: number }) =>
  useQuery({ queryKey: ['item-groups', params], queryFn: () => api.get<Paged<ItemGroupDto>>(`/app/item-groups${qs(params)}`) })
export const useCreateItemGroup = () =>
  useApiMutation((body: Record<string, unknown>) => api.post<ItemGroupDto[]>('/app/item-groups', body), { invalidate: [['item-groups']], success: 'Groups created' })
export const useUpdateItemGroup = () =>
  useApiMutation(({ id, body }: { id: number; body: Record<string, unknown> }) => api.patch(`/app/item-groups/${id}`, body), { invalidate: [['item-groups']], success: 'Group updated' })
/** TASK-98: 409 while item names / stock still use the group. */
export const useDeleteItemGroup = () =>
  useApiMutation((id: number) => api.del(`/app/item-groups/${id}`), { invalidate: [['item-groups'], ['stock-shortage']], success: 'Group deleted' })

export const useItemNames = (params: { page?: number; pageSize?: number; q?: string; stockClass?: string; groupId?: number; jewelleryTypeId?: number }) =>
  useQuery({ queryKey: ['item-names', params], queryFn: () => api.get<Paged<ItemNameDto>>(`/app/item-names${qs(params)}`) })
export const useCreateItemName = () =>
  useApiMutation((body: Record<string, unknown>) => api.post<ItemNameDto>('/app/item-names', body), { invalidate: [['item-names']], success: 'Item name created' })
export const useUpdateItemName = () =>
  useApiMutation(({ id, body }: { id: number; body: Record<string, unknown> }) => api.patch(`/app/item-names/${id}`, body), { invalidate: [['item-names']], success: 'Item name updated' })

// ───── Stock ─────
export const useStockSummary = () => useQuery({ queryKey: ['stock-summary'], queryFn: () => api.get<StockSummaryDto[]>('/app/stock/summary') })
export const useStock = (params: Record<string, string | number | undefined>) =>
  useQuery({ queryKey: ['stock', params], queryFn: () => api.get<StockListPage>(`/app/stock${qs(params)}`) })
export const useGroupStock = (params: Record<string, string | number | undefined>) =>
  useQuery({ queryKey: ['stock-groups', params], queryFn: () => api.get<GroupStockDto[]>(`/app/stock/groups${qs(params)}`) })

/** One stock item's movement history (insert, edits, transfers). asset = the item's class. */
export const useStockLedger = (item?: StockItemDto) =>
  useQuery({
    queryKey: ['stock-ledger', item?.id],
    queryFn: () => api.get<LedgerPageDto>(`/app/ledgers${qs({ asset: item!.stockClass, stockItemId: item!.id, pageSize: 100 })}`),
    enabled: !!item,
  })

/** Reactive "all matching stock" (tag print, scan/match) — loops pages under the 100 cap via fetchAllStock. */
export const useAllStock = (params: Record<string, string | number | undefined>) =>
  useQuery({ queryKey: ['stock-all', params], queryFn: () => fetchAllStock(params) })

/** Fetch every stock row matching the current filters, for CSV export (pageSize caps at 100, so loop). */
export async function fetchAllStock(params: Record<string, string | number | undefined>): Promise<StockItemDto[]> {
  const out: StockItemDto[] = []
  for (let page = 1; ; page++) {
    const res = await api.get<Paged<StockItemDto>>(`/app/stock${qs({ ...params, page, pageSize: 100 })}`)
    out.push(...res.items)
    if (res.items.length === 0 || out.length >= res.total) return out
  }
}
export const useShortage = (params: Record<string, string | number | undefined>) =>
  useQuery({ queryKey: ['stock-shortage', params], queryFn: () => api.get<ShortageRowDto[]>(`/app/stock/shortage${qs(params)}`) })

/** TASK-98: peek the next auto tag no. per item name (read-only; New Stock preview). Map itemNameId → dto. */
export function useNextTags(itemNameIds: number[], enabled = true): Map<number, NextTagDto> {
  const results = useQueries({
    queries: itemNameIds.map((itemNameId) => ({
      queryKey: ['next-tag', itemNameId],
      queryFn: () => api.get<NextTagDto>(`/app/stock/next-tag${qs({ itemNameId })}`),
      enabled,
      staleTime: 15_000,
    })),
  })
  const out = new Map<number, NextTagDto>()
  results.forEach((r, i) => { if (r.data) out.set(itemNameIds[i]!, r.data) })
  return out
}

const STOCK_KEYS = [['stock'], ['stock-summary'], ['stock-groups'], ['stock-shortage'], ['stock-transfers'], ['stock-transfer'], ['next-tag']]
export const useCreateStockEntry = () =>
  useApiMutation((body: Record<string, unknown>) => api.post<StockEntryResultDto>('/app/stock/entries', body), { invalidate: STOCK_KEYS, success: 'Stock added' })
export const useUpdateStock = () =>
  useApiMutation(({ id, body }: { id: number; body: Record<string, unknown> }) => api.patch(`/app/stock/${id}`, body), { invalidate: STOCK_KEYS, success: 'Stock item updated' })
export const useDeleteStock = () =>
  useApiMutation(({ id, mpin }: { id: number; mpin: string }) => api.del(`/app/stock/${id}`, { mpin }), { invalidate: STOCK_KEYS, success: 'Stock item deleted' })
export const useBulkEditStock = () =>
  useApiMutation(({ ids, patch }: { ids: number[]; patch: Record<string, unknown> }) => api.patch('/app/stock/bulk', { ids, patch }), { invalidate: STOCK_KEYS, success: 'Items updated' })
export const useBulkDeleteStock = () =>
  useApiMutation(({ ids, mpin }: { ids: number[]; mpin: string }) => api.post('/app/stock/bulk-delete', { ids }, { mpin }), { invalidate: STOCK_KEYS, success: 'Items deleted' })
export const useUploadStockPhoto = () =>
  useApiMutation(({ id, file }: { id: number; file: File }) => {
    const fd = new FormData()
    fd.append('file', file)
    return api.post<{ url: string; path: string }>(`/app/stock/${id}/photo`, fd)
  }, { invalidate: [['stock']], success: 'Photo uploaded' })
export const useRemoveStockPhoto = () =>
  useApiMutation((id: number) => api.del(`/app/stock/${id}/photo`), { invalidate: [['stock']], success: 'Photo removed' })

// ───── Stock transfer ─────
export const useStockTransfers = (params: Record<string, string | number | undefined>) =>
  useQuery({ queryKey: ['stock-transfers', params], queryFn: () => api.get<Paged<StockTransferDto>>(`/app/stock/transfers${qs(params)}`) })
export const useStockTransfer = (id?: number) =>
  useQuery({ queryKey: ['stock-transfer', id], queryFn: () => api.get<StockTransferDetailDto>(`/app/stock/transfers/${id}`), enabled: !!id })
export const useCreateStockTransfer = () =>
  useApiMutation((body: Record<string, unknown>) => api.post<StockTransferDetailDto>('/app/stock/transfers', body), { invalidate: STOCK_KEYS, success: 'Stock transferred' })

/** CSV import — dryRun validates, real run imports all-or-nothing. */
export const useStockImport = () =>
  useApiMutation(({ file, fields }: { file: File; fields: Record<string, string> }) => {
    const fd = new FormData()
    fd.append('file', file)
    for (const [k, v] of Object.entries(fields)) fd.append(k, v)
    return api.post<StockImportResultDto>('/app/stock/import', fd)
  }, { invalidate: [['stock'], ['stock-summary']] })

// ───── Printer settings + tag templates ─────
export const usePrinterSettings = (enabled = true) =>
  useQuery({ queryKey: ['printer-settings'], queryFn: () => api.get<PrinterSettingsDto>('/app/inventory/printer-settings'), enabled })
export const useSavePrinterSettings = () =>
  useApiMutation((body: PrinterSettingsDto) => api.put<PrinterSettingsDto>('/app/inventory/printer-settings', body), { invalidate: [['printer-settings']], success: 'Printer settings saved' })

export const useTagTemplates = (enabled = true) =>
  useQuery({ queryKey: ['tag-templates'], queryFn: () => api.get<TagTemplateDto[]>('/app/tag-templates'), enabled })
export const useSaveTagTemplate = () =>
  useApiMutation(({ id, body }: { id?: number; body: Record<string, unknown> }) => (id ? api.patch<TagTemplateDto>(`/app/tag-templates/${id}`, body) : api.post<TagTemplateDto>('/app/tag-templates', body)), { invalidate: [['tag-templates']], success: 'Template saved' })
export const useActivateTagTemplate = () =>
  useApiMutation((id: number) => api.post<TagTemplateDto>(`/app/tag-templates/${id}/activate`), { invalidate: [['tag-templates']], success: 'Template is now active' })
export const useDeleteTagTemplate = () =>
  useApiMutation((id: number) => api.del(`/app/tag-templates/${id}`), { invalidate: [['tag-templates']], success: 'Template deleted' })

// ───── All Stock Summary + Set Stock ─────
export const useAllStockSummary = () => useQuery({ queryKey: ['all-stock-summary'], queryFn: () => api.get<AllStockSummaryDto>('/app/stock/all-summary') })
export const useSetStock = () =>
  useApiMutation(({ mpin, ...body }: { card: SetStockCard; newBalance: number; remarks?: string; mpin: string }) => api.post<SetStockLogDto>('/app/stock/all-summary/set', body, { mpin }), {
    invalidate: [['all-stock-summary'], ['set-stock-logs']],
    success: 'Balance updated',
  })
export const useSetStockLogs = (params: { page: number; pageSize: number }, enabled = true) =>
  useQuery({ queryKey: ['set-stock-logs', params], queryFn: () => api.get<Paged<SetStockLogDto>>(`/app/stock/set-stock-logs${qs(params)}`), enabled })
