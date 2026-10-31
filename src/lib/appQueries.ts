// Phase 1 masters & settings — TanStack Query hooks against the real /api/app/* routes.
import { useQuery } from '@tanstack/react-query'

import { api, ApiException } from '@/lib/api'
import { qs, useApiMutation } from '@/lib/queries'
import type {
  BankAccountDto,
  BusinessProfileDto,
  CurrentRatesDto,
  DeletePartyResultDto,
  HsnDto,
  KaratDto,
  OccasionDto,
  Paged,
  PartyDto,
  PartyListItemDto,
  PartyRefDto,
  RateHistoryDto,
  RateLimitDto,
  SettingsDto,
} from '@/shared'

// ───── Parties ─────
export const useOccasions = (days = 7) =>
  useQuery({ queryKey: ['occasions', days], queryFn: () => api.get<OccasionDto[]>(`/app/parties/occasions?days=${days}`) })
export const useParties = (params: { page?: number; pageSize?: number; q?: string; type?: string; active?: string }) =>
  useQuery({ queryKey: ['parties', params], queryFn: () => api.get<Paged<PartyListItemDto>>(`/app/parties${qs(params)}`) })
export const useParty = (id?: number) =>
  useQuery({ queryKey: ['party', id], queryFn: () => api.get<PartyDto>(`/app/parties/${id}`), enabled: !!id })
export const partySearch = (q: string, type?: string) =>
  api.get<PartyRefDto[]>(`/app/parties/search${qs({ q, type, limit: 10 })}`)
export const useCreateParty = () =>
  useApiMutation((body: Record<string, unknown>) => api.post<PartyDto>('/app/parties', body), { invalidate: [['parties']], success: 'Party saved' })
export const useUpdateParty = () =>
  useApiMutation(({ id, body }: { id: number; body: Record<string, unknown> }) => api.patch<PartyDto>(`/app/parties/${id}`, body), { invalidate: [['parties'], ['party']], success: 'Party updated' })
// An unused party answers 409 CONFIRM_REQUIRED: returned as a result (not a toast) so the page can ask before the hard delete.
export const useDeleteParty = () =>
  useApiMutation(
    ({ id, confirm }: { id: number; confirm?: boolean }) =>
      api.del<DeletePartyResultDto>(`/app/parties/${id}${confirm ? '?confirm=true' : ''}`).catch((e: unknown) => {
        if (e instanceof ApiException && e.code === 'CONFIRM_REQUIRED') return { result: 'CONFIRM_REQUIRED' as const }
        throw e
      }),
    { invalidate: [['parties'], ['party']] },
  )

// ───── Bank accounts ─────
export const useBankAccounts = () => useQuery({ queryKey: ['bank-accounts'], queryFn: () => api.get<BankAccountDto[]>('/app/bank-accounts') })
export const useSaveBankAccount = () =>
  useApiMutation(({ id, body }: { id?: number; body: Record<string, unknown> }) => (id ? api.patch(`/app/bank-accounts/${id}`, body) : api.post('/app/bank-accounts', body)), { invalidate: [['bank-accounts']], success: 'Bank account saved' })
export const useDeleteBankAccount = () =>
  useApiMutation((id: number) => api.del(`/app/bank-accounts/${id}`), { invalidate: [['bank-accounts']], success: 'Bank account removed' })

// ───── HSN ─────
export const useHsn = (params: { q?: string; category?: string; onlyActive?: string }) =>
  useQuery({ queryKey: ['hsn', params], queryFn: () => api.get<HsnDto[]>(`/app/hsn${qs(params)}`) })
export const useToggleHsn = () =>
  useApiMutation(({ id, active }: { id: number; active: boolean }) => api.put(`/app/hsn/${id}`, { active }), { invalidate: [['hsn']] })

// ───── Karats ─────
export const useKarats = () => useQuery({ queryKey: ['karats'], queryFn: () => api.get<KaratDto[]>('/app/karats') })
export const useCreateKarat = () =>
  useApiMutation((body: Record<string, unknown>) => api.post('/app/karats', body), { invalidate: [['karats']], success: 'Karat added' })
export const useUpdateKarat = () =>
  useApiMutation(({ id, body, mpin }: { id: number; body: Record<string, unknown>; mpin: string }) => api.patch(`/app/karats/${id}`, body, { mpin }), { invalidate: [['karats']], success: 'Karat updated' })
export const useDeleteKarat = () =>
  useApiMutation(({ id, mpin }: { id: number; mpin: string }) => api.del(`/app/karats/${id}`, { mpin }), { invalidate: [['karats']], success: 'Karat deleted' })

// ───── Rates ─────
export const useCurrentRates = () => useQuery({ queryKey: ['rates-current'], queryFn: () => api.get<CurrentRatesDto>('/app/rates/current') })
export const useSetRates = () =>
  useApiMutation(({ body, mpin }: { body: Record<string, unknown>; mpin?: string }) => api.post('/app/rates', body, mpin ? { mpin } : undefined), { invalidate: [['rates-current'], ['rates-history']], success: 'Rates updated' })
/** Atomic multi-metal save (POST /app/rates/batch): all metals saved or none. */
export const useSetRatesBatch = () =>
  useApiMutation(({ metals, mpin }: { metals: Record<string, unknown>[]; mpin?: string }) => api.post('/app/rates/batch', { metals }, mpin ? { mpin } : undefined), { invalidate: [['rates-current'], ['rates-history']], success: 'Rates updated' })
export const useRateHistory = (params: { page?: number; metal?: string }) =>
  useQuery({ queryKey: ['rates-history', params], queryFn: () => api.get<Paged<RateHistoryDto>>(`/app/rates/history${qs(params)}`) })
export const useRateLimits = () => useQuery({ queryKey: ['rate-limits'], queryFn: () => api.get<RateLimitDto[]>('/app/rate-limits') })
export const useSaveRateLimits = () =>
  useApiMutation(({ limits, mpin }: { limits: unknown[]; mpin: string }) => api.put('/app/rate-limits', { limits }, { mpin }), { invalidate: [['rate-limits']], success: 'Rate limits saved' })

// ───── Settings ─────
export const useSettings = () => useQuery({ queryKey: ['settings'], queryFn: () => api.get<SettingsDto>('/app/settings') })
/** Shop profile for any tenant user (bill header); branch gstin/state override the business ones server-side. */
export const useBusinessProfile = () => useQuery({ queryKey: ['business-profile'], queryFn: () => api.get<BusinessProfileDto>('/app/business-profile') })
export const useSaveSetting = () =>
  useApiMutation(({ key, value, mpin }: { key: string; value: unknown; mpin: string }) => api.put(`/app/settings/${key}`, { value }, { mpin }), { invalidate: [['settings']], success: 'Settings saved' })
// TASK-84: invoice media upload (logo/signature/watermark) — writes the invoice.media setting server-side.
export const useUploadInvoiceMedia = () =>
  useApiMutation(({ kind, file, mpin }: { kind: 'logo' | 'signature' | 'watermark'; file: File; mpin: string }) => {
    const fd = new FormData()
    fd.append('file', file)
    return api.post<{ url: string; path: string }>(`/app/settings/invoice/${kind}`, fd, { mpin })
  }, { invalidate: [['settings']], success: 'Image uploaded' })
