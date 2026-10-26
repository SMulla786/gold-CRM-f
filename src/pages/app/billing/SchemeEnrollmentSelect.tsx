import { useQuery } from '@tanstack/react-query'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { api } from '@/lib/api'
import { useT } from '@/lib/i18n'
import { qs } from '@/lib/queries'
import type { EnrollmentDto, Paged } from '@/shared'

/**
 * TASK-98 SCHEME pay mode: the party's open (ACTIVE/WON) scheme enrollments with their maturity value.
 * The already-picked one stays listed in edit mode (the bill closed it). Users without scheme access just get an empty list.
 */
export function SchemeEnrollmentSelect({ partyId, value, onChange, className }: { partyId: number; value: string; onChange: (id: string, maturityValue: number) => void; className?: string }) {
  const t = useT()
  const { data } = useQuery({
    queryKey: ['enrollments', { partyId, pageSize: 100 }],
    queryFn: () => api.get<Paged<EnrollmentDto>>(`/app/schemes/enrollments${qs({ partyId, pageSize: 100 })}`),
    retry: false,
  })
  const options = (data?.items ?? []).filter((e) => e.status === 'ACTIVE' || e.status === 'WON' || String(e.id) === value)
  return (
    <Select value={value} onValueChange={(id) => onChange(id, Number(options.find((e) => String(e.id) === id)?.maturity.maturityValue ?? 0))}>
      <SelectTrigger className={className} aria-label="Scheme enrollment"><SelectValue placeholder={t('bill.scheme_pick')} /></SelectTrigger>
      <SelectContent>
        {options.length === 0 && <div className="px-2 py-1.5 text-sm text-muted-foreground">{t('bill.scheme_none')}</div>}
        {options.map((e) => (
          <SelectItem key={e.id} value={String(e.id)}>
            {e.assignId} · {e.scheme.name} · ₹{e.maturity.maturityValue}{e.matured ? '' : ` (${t('bill.scheme_early')})`}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
