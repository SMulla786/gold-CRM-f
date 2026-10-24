// Phase 1 masters & settings — TanStack Query hooks against the real /api/app/* routes.
import { useQuery } from '@tanstack/react-query'

import { api } from '@/lib/api'
import { qs, useApiMutation } from '@/lib/queries'
import type {
  BankAccountDto,
  CurrentRatesDto,
  HsnDto,
  KaratDto,
  Paged,
  PartyDto,
  PartyListItemDto,
  PartyRefDto,
  RateHistoryDto,
  RateLimitDto,
  SettingsDto,
} from '@/shared'

// ───── Parties ─────
export const useParties = (params: { page?: number; q?: string; type?: string; active?: string }) =>
  useQuery({ queryKey: ['parties', params], queryFn: () => api.get<Paged<PartyListItemDto>>(`/app/parties${qs(params)}`) })
export const useParty = (id?: number) =>
  useQuery({ queryKey: ['party', id], queryFn: () => api.get<PartyDto>(`/app/parties/${id}`), enabled: !!id })
export const partySearch = (q: string, type?: string) =>
  api.get<PartyRefDto[]>(`/app/parties/search${qs({ q, type, limit: 10 })}`)
export const useCreateParty = () =>
  useApiMutation((body: Record<string, unknown>) => api.post<PartyDto>('/app/parties', body), { invalidate: [['parties']], success: 'Party saved' })
export const useUpdateParty = () =>
  useApiMutation(({ id, body }: { id: number; body: Record<string, unknown> }) => api.patch<PartyDto>(`/app/parties/${id}`, body), { invalidate: [['parties'], ['party']], success: 'Party updated' })
export const useDeleteParty = () =>
  useApiMutation((id: number) => api.del(`/app/parties/${id}`), { invalidate: [['parties']], success: 'Party removed' })

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
export const useRateHistory = (params: { page?: number; metal?: string }) =>
  useQuery({ queryKey: ['rates-history', params], queryFn: () => api.get<Paged<RateHistoryDto>>(`/app/rates/history${qs(params)}`) })
export const useRateLimits = () => useQuery({ queryKey: ['rate-limits'], queryFn: () => api.get<RateLimitDto[]>('/app/rate-limits') })
export const useSaveRateLimits = () =>
  useApiMutation(({ limits, mpin }: { limits: unknown[]; mpin: string }) => api.put('/app/rate-limits', { limits }, { mpin }), { invalidate: [['rate-limits']], success: 'Rate limits saved' })

// ───── Settings ─────
export const useSettings = () => useQuery({ queryKey: ['settings'], queryFn: () => api.get<SettingsDto>('/app/settings') })
export const useSaveSetting = () =>
  useApiMutation(({ key, value, mpin }: { key: string; value: unknown; mpin: string }) => api.put(`/app/settings/${key}`, { value }, { mpin }), { invalidate: [['settings']], success: 'Settings saved' })
