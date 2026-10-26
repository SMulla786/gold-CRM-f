// TASK-98: bill print format helpers shared by the bill view and the invoice settings card.
import type { InvoiceFormat, SettingsDto } from '@/shared'

/** Format to print when nothing is picked on screen: billing.invoice.format, else the general print.defaults layout. */
export function defaultInvoiceFormat(settings?: SettingsDto): InvoiceFormat {
  const f = settings?.['billing.invoice']?.format
  if (f && f !== 'A4_GST') return f
  const legacy = settings?.['print.defaults'].layout
  return legacy === 'A5' || legacy === 'THERMAL_80' ? legacy : 'A4_GST'
}

/** i18n key for each format's display name. */
export const FORMAT_LABEL_KEY: Record<InvoiceFormat, string> = {
  A4_GST: 'invfmt.fmt_a4_gst',
  A4_ESTIMATE: 'invfmt.fmt_a4_estimate',
  A5: 'invfmt.fmt_a5',
  THERMAL_80: 'invfmt.fmt_thermal_80',
  THERMAL_58: 'invfmt.fmt_thermal_58',
  A4_IMAGES: 'invfmt.fmt_a4_images',
}
