// Phase 5 udhari — hooks against /api/app/udhar/*. Sign: + party owes the shop, − shop owes the party.
import { useQuery } from '@tanstack/react-query'

import { api } from '@/lib/api'
import { qs, useApiMutation } from '@/lib/queries'
import type { BillListItemDto, Paged, PartyBalanceRowDto, StatementDto, UdharEntryRowDto, UdharTxnDto } from '@/shared'

// udhar moves party balances + money/metal ledgers (and bill.paid when settling), so refresh all.
const UDHAR_KEYS = [['udhar-txn'], ['udhar-entries'], ['udhar-ledger'], ['party-balance'], ['party-statement'], ['pending-bills'], ['ledger'], ['day-book'], ['bills'], ['bill']]

export const useUdharEntries = (params: Record<string, string | number | undefined>) =>
  useQuery({ queryKey: ['udhar-entries', params], queryFn: () => api.get<Paged<UdharEntryRowDto>>(`/app/udhar/entries${qs(params)}`) })

export const useUdharLedger = (params: Record<string, string | number | undefined>) =>
  useQuery({ queryKey: ['udhar-ledger', params], queryFn: () => api.get<Paged<PartyBalanceRowDto>>(`/app/udhar/ledger${qs(params)}`) })

export const usePendingBills = (params: Record<string, string | number | undefined>, enabled = true) =>
  useQuery({ queryKey: ['pending-bills', params], queryFn: () => api.get<Paged<BillListItemDto>>(`/app/udhar/pending-bills${qs(params)}`), enabled })

export const usePartyStatement = (partyId?: number, params: Record<string, string | number | undefined> = {}) =>
  useQuery({ queryKey: ['party-statement', partyId, params], queryFn: () => api.get<StatementDto>(`/app/udhar/parties/${partyId}/statement${qs(params)}`), enabled: !!partyId })

export const useUdharTxn = (id?: number) =>
  useQuery({ queryKey: ['udhar-txn', id], queryFn: () => api.get<UdharTxnDto>(`/app/udhar/${id}`), enabled: !!id })

export const useCreateUdhar = () =>
  useApiMutation((body: Record<string, unknown>) => api.post<UdharTxnDto>('/app/udhar', body), { invalidate: UDHAR_KEYS, success: 'Udhar saved' })

export const useDeleteUdhar = () =>
  useApiMutation(({ id, mpin }: { id: number; mpin: string }) => api.del(`/app/udhar/${id}`, { mpin }), { invalidate: UDHAR_KEYS, success: 'Udhar deleted' })
