// Phase 6 — dashboard + GST report hooks (read-only aggregates).
import { useQuery } from '@tanstack/react-query'

import { api } from '@/lib/api'
import { qs } from '@/lib/queries'
import type { ActivityDto, DashboardDto, Gstr1Dto, Gstr3bDto, GstRegisterRowDto, GstSummaryRowDto, HsnSummaryRowDto, Paged } from '@/shared'

export const useDashboard = () => useQuery({ queryKey: ['dashboard'], queryFn: () => api.get<DashboardDto>('/app/dashboard') })

export const useActivity = (params: Record<string, string | number | undefined>) =>
  useQuery({ queryKey: ['activity', params], queryFn: () => api.get<Paged<ActivityDto>>(`/app/activity${qs(params)}`) })

export const useGstRegister = (params: Record<string, string | number | undefined>) =>
  useQuery({ queryKey: ['gst-register', params], queryFn: () => api.get<Paged<GstRegisterRowDto>>(`/app/gst/register${qs(params)}`) })

export const useGstHsn = (params: Record<string, string | number | undefined>) =>
  useQuery({ queryKey: ['gst-hsn', params], queryFn: () => api.get<HsnSummaryRowDto[]>(`/app/gst/hsn${qs(params)}`) })

export const useGstSummary = (params: Record<string, string | number | undefined>) =>
  useQuery({ queryKey: ['gst-summary', params], queryFn: () => api.get<GstSummaryRowDto[]>(`/app/gst/summary${qs(params)}`) })

// ── Phase 12: GSTR-1 / GSTR-3B (filing period = from..to) ──
export const useGstr1 = (params: { from?: string; to?: string }) =>
  useQuery({ queryKey: ['gstr1', params], queryFn: () => api.get<Gstr1Dto>(`/app/gst/gstr1${qs(params)}`), enabled: !!params.from && !!params.to })

export const useGstr3b = (params: { from?: string; to?: string }) =>
  useQuery({ queryKey: ['gstr3b', params], queryFn: () => api.get<Gstr3bDto>(`/app/gst/gstr3b${qs(params)}`), enabled: !!params.from && !!params.to })

/** Portal JSON download — fetched through the api layer (auth + refresh), then saved client-side. */
export async function downloadGstr1Json(params: { from: string; to: string }) {
  const data = await api.get<unknown>(`/app/gst/gstr1.json${qs(params)}`)
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `gstr1-${params.from}.json`
  a.click()
  URL.revokeObjectURL(url)
}
