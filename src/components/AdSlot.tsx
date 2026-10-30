import { useEffect } from 'react'

const CLIENT = import.meta.env.VITE_ADSENSE_CLIENT as string | undefined
const SLOT = import.meta.env.VITE_ADSENSE_SLOT as string | undefined

declare global {
  interface Window { adsbygoogle?: unknown[] }
}

/** Google AdSense banner — a MANUAL placement (keep "Auto ads" OFF in AdSense). Mount only where `adsAllowed()` (lib/ads)
 *  says so, with a fresh key per page. Logout / impersonation reload the page once this script ran (lib/ads clearAdState). */
export function AdSlot() {
  useEffect(() => {
    // the script is loaded only once, and only for users who actually see ads
    if (!document.querySelector('script[data-adsense]')) {
      const s = document.createElement('script')
      s.async = true
      s.crossOrigin = 'anonymous'
      s.dataset.adsense = ''
      s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${CLIENT}`
      document.head.appendChild(s)
    }
    try {
      ;(window.adsbygoogle = window.adsbygoogle || []).push({})
    } catch {
      // ad blockers / no fill — the app must keep working
    }
  }, [])

  return (
    // print:hidden: never print ads on bills/receipts
    <div className="mt-10 print:hidden" aria-label="Advertisement">
      <ins
        className="adsbygoogle block"
        data-ad-client={CLIENT}
        data-ad-slot={SLOT}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  )
}
