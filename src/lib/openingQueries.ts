// Pilot — opening balances. POST/GET/DELETE /app/opening-balances (settings.misc edit/delete, X-MPIN, active branch).
import { useQuery } from '@tanstack/react-query'

import { api } from '@/lib/api'
import { useApiMutation } from '@/lib/queries'
import type { OpeningBatchDto } from '@/shared'

const OPENING_KEYS = [['opening-balances'], ['ledger'], ['day-book'], ['party-balance'], ['udhar-ledger'], ['dashboard']]

export const useOpeningBatches = () =>
  useQuery({ queryKey: ['opening-balances'], queryFn: () => api.get<OpeningBatchDto[]>('/app/opening-balances') })

export const useCreateOpening = () =>
  useApiMutation(({ body, mpin }: { body: Record<string, unknown>; mpin: string }) => api.post<OpeningBatchDto>('/app/opening-balances', body, { mpin }), { invalidate: OPENING_KEYS, success: 'Opening balances saved' })

export const useReverseOpening = () =>
  useApiMutation(({ sourceId, mpin }: { sourceId: string; mpin: string }) => api.del(`/app/opening-balances/${sourceId}`, { mpin }), { invalidate: OPENING_KEYS, success: 'Opening batch reversed' })
