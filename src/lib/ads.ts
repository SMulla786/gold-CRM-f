import type { MeDto } from '@/shared'

/**
 * Phase 5 (owner rules 2026-10-30): AdSense banners show only when ALL hold —
 * ads switched on with a client + slot, the business's CURRENT term is ad-supported (server's `adEligible`),
 * nobody is impersonating, and the screen is on this allowlist. Manual placements only: keep "Auto ads" OFF in AdSense.
 * Never billing, payments, parties, settings, security, admin/platform, girvi/udhar/ledgers or any print/slip screen.
 * Owner decision 2026-10-30: the allowlist is EMPTY — every app screen, the dashboard included (customer names, mobiles,
 * party activity), shows customer or money data, and the ad script can read the page. Add a screen only after the owner
 * approves one that shows none.
 */
export type AdScreen = { path: string; exact?: boolean }
const AD_SCREENS: AdScreen[] = []

type AdsEnv = Record<string, unknown> // import.meta.env, or a plain object in tests

export const adsConfigured = (env: AdsEnv): boolean => env.VITE_ADS_ENABLED === 'true' && !!env.VITE_ADSENSE_CLIENT && !!env.VITE_ADSENSE_SLOT

export const adScreen = (pathname: string, screens: AdScreen[] = AD_SCREENS): boolean => {
  const p = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  return screens.some((s) => p === s.path || (!s.exact && p.startsWith(`${s.path}/`)))
}

export function adsAllowed(me: MeDto | null | undefined, pathname: string, env: AdsEnv, screens: AdScreen[] = AD_SCREENS): boolean {
  return adsConfigured(env) && me?.subscription?.adEligible === true && !me.impersonatedBy && adScreen(pathname, screens)
}

/** True once the AdSense script was injected into this page. Only a hard reload removes it (and any ads it placed). */
export const adsScriptLoaded = (): boolean => typeof document !== 'undefined' && !!document.querySelector('script[data-adsense]')

/** Identity change (logout / session lost / impersonation start or end): if the ad script ran here, reload so it can't
 *  follow the next identity. A blind reload would end an impersonation (its token lives only in memory), and an
 *  impersonated or Super Admin session never loads the script, so the reload is conditional. */
export function clearAdState(to: string): boolean {
  if (!adsScriptLoaded()) return false
  window.location.assign(to)
  return true
}
