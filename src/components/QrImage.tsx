import { useEffect, useState } from 'react'

import { qrDataUrl } from '@/lib/qr'
import { cn } from '@/lib/utils'

/** A fixed-size QR code image (renders nothing until generated, or if generation fails). Safe inside `.print-area`. */
export function QrImage({ text, size = 64, className }: { text: string; size?: number; className?: string }) {
  const [src, setSrc] = useState<{ text: string; url: string } | null>(null)
  useEffect(() => {
    let live = true
    // render at 2x for a crisp print
    qrDataUrl(text, { size: size * 2 }).then((url) => { if (live) setSrc({ text, url }) }, () => {})
    return () => { live = false }
  }, [text, size])
  if (!src || src.text !== text) return null
  return <img src={src.url} alt="QR code" width={size} height={size} className={cn('shrink-0', className)} style={{ width: size, height: size }} />
}
