// TASK-98 Wave 2 — Samples / Tounch register (custody only, no ledger). Routes /app/samples* (backend modules/app/samples/routes.ts).
import { useQuery } from '@tanstack/react-query'

import { api } from '@/lib/api'
import { qs, useApiMutation } from '@/lib/queries'
import type { Paged, SampleDetailDto, SampleDto, SamplePickDto, SampleStatus } from '@/shared'

/** Page permission for the Samples tab and actions (view = list/search, edit = create/edit/issue/return/melt). One-line change if the key moves. */
export const SAMPLES_PERM = 'inventory.samples'

const BASE = '/app/samples'
const SAMPLE_KEYS = [['samples'], ['sample'], ['sample-search']]

type Params = Record<string, string | number | undefined>

export const useSamples = (params: Params) =>
  useQuery({ queryKey: ['samples', params], queryFn: () => api.get<Paged<SampleDto>>(`${BASE}${qs(params)}`) })

export const useSample = (id?: number) =>
  useQuery({ queryKey: ['sample', id], queryFn: () => api.get<SampleDetailDto>(`${BASE}/${id}`), enabled: !!id })

/** Picker list (default statuses IN_HAND + RETURNED on the server). */
export const useSampleSearch = (p: { q?: string; metal?: string; statuses?: SampleStatus[]; limit?: number }, enabled = true) => {
  const params: Params = { q: p.q || undefined, metal: p.metal, statuses: p.statuses?.length ? p.statuses.join(',') : undefined, limit: p.limit }
  return useQuery({ queryKey: ['sample-search', params], queryFn: () => api.get<SamplePickDto[]>(`${BASE}/search${qs(params)}`), enabled })
}

export const useCreateSample = () =>
  useApiMutation((body: Record<string, unknown>) => api.post<SampleDetailDto>(BASE, body), { invalidate: SAMPLE_KEYS, success: 'Sample saved' })

export const useUpdateSample = () =>
  useApiMutation(({ id, body }: { id: number; body: Record<string, unknown> }) => api.patch<SampleDetailDto>(`${BASE}/${id}`, body), { invalidate: SAMPLE_KEYS, success: 'Sample updated' })

export const useIssueSample = () =>
  useApiMutation(({ id, body }: { id: number; body: Record<string, unknown> }) => api.post<SampleDetailDto>(`${BASE}/${id}/issue`, body), { invalidate: SAMPLE_KEYS, success: 'Sample issued' })

export const useReturnSample = () =>
  useApiMutation(({ id, body }: { id: number; body: Record<string, unknown> }) => api.post<SampleDetailDto>(`${BASE}/${id}/return`, body), { invalidate: SAMPLE_KEYS, success: 'Sample returned' })

export const useMeltSample = () =>
  useApiMutation(({ id, body }: { id: number; body: Record<string, unknown> }) => api.post<SampleDetailDto>(`${BASE}/${id}/melt`, body), { invalidate: SAMPLE_KEYS, success: 'Sample marked melted' })
