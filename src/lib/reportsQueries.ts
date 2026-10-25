// Phase 6 — dashboard + GST report hooks (read-only aggregates).
import { useQuery } from '@tanstack/react-query'

import { api } from '@/lib/api'
import { qs } from '@/lib/queries'
import type { ActivityDto, DashboardDto, GstRegisterRowDto, GstSummaryRowDto, HsnSummaryRowDto, Paged } from '@/shared'

export const useDashboard = () => useQuery({ queryKey: ['dashboard'], queryFn: () => api.get<DashboardDto>('/app/dashboard') })

export const useActivity = (params: Record<string, string | number | undefined>) =>
  useQuery({ queryKey: ['activity', params], queryFn: () => api.get<Paged<ActivityDto>>(`/app/activity${qs(params)}`) })

export const useGstRegister = (params: Record<string, string | number | undefined>) =>
  useQuery({ queryKey: ['gst-register', params], queryFn: () => api.get<Paged<GstRegisterRowDto>>(`/app/gst/register${qs(params)}`) })

export const useGstHsn = (params: Record<string, string | number | undefined>) =>
  useQuery({ queryKey: ['gst-hsn', params], queryFn: () => api.get<HsnSummaryRowDto[]>(`/app/gst/hsn${qs(params)}`) })

export const useGstSummary = (params: Record<string, string | number | undefined>) =>
  useQuery({ queryKey: ['gst-summary', params], queryFn: () => api.get<GstSummaryRowDto[]>(`/app/gst/summary${qs(params)}`) })
