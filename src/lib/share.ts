import { toast } from 'sonner'

/** wa.me link with a prefilled message. Mobile is a 10-digit Indian number; prefix 91. */
export function whatsAppUrl(mobile: string, text: string): string {
  const digits = mobile.replace(/\D/g, '')
  const num = digits.length === 10 ? `91${digits}` : digits
  return `https://wa.me/${num}?text=${encodeURIComponent(text)}`
}

export function shareOnWhatsApp(mobile: string, text: string) {
  if (!mobile) { toast.error('No mobile number on this party'); return }
  window.open(whatsAppUrl(mobile, text), '_blank', 'noopener')
}

/** Browser "print to PDF": no silent download API, so open print and hint the user to pick Save as PDF. */
export function downloadPdf() {
  toast.info('Choose “Save as PDF” as the destination in the print dialog')
  window.print()
}
