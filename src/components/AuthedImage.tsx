import { useEffect, useState } from 'react'

import { api } from '@/lib/api'

// Images behind requirePermission can't load via <img src> (no bearer header) — blob-fetch to an object URL.
// `ver` busts the cache after a re-upload (same path). Renders nothing until loaded or on error (e.g. 404 = unset).
export function AuthedImage({ path, ver = 0, alt, className }: { path: string; ver?: number; alt: string; className?: string }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let active = true
    let obj: string | null = null
    api.blob(ver ? `${path}?v=${ver}` : path).then((b) => { if (active) { obj = URL.createObjectURL(b); setUrl(obj) } }).catch(() => {})
    return () => { active = false; if (obj) URL.revokeObjectURL(obj) }
  }, [path, ver])
  return url ? <img src={url} alt={alt} className={className} /> : null
}
