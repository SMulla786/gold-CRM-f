import { describe, expect, it } from 'vitest'

import type { MeDto } from '@/shared'

import { adScreen, adsAllowed, adsConfigured, type AdScreen } from './ads'

const ON = { VITE_ADS_ENABLED: 'true', VITE_ADSENSE_CLIENT: 'ca-pub-1', VITE_ADSENSE_SLOT: '42' }
const SAFE: AdScreen[] = [{ path: '/app/safe' }] // a stand-in for a future owner-approved screen
const me = (o: { adEligible?: boolean; impersonated?: boolean; noSub?: boolean } = {}) =>
  ({
    subscription: o.noSub ? null : { planName: 'Free', endsAt: '2030-01-01T00:00:00.000Z', readOnly: false, adEligible: o.adEligible ?? true },
    impersonatedBy: o.impersonated ? { id: 1, name: 'Platform Admin' } : null,
  }) as unknown as MeDto

describe('Phase 5 ads gate', () => {
  it('shows only for an ad-eligible, non-impersonated session on an allow-listed screen with ads configured', () => {
    expect(adsAllowed(me(), '/app/safe', ON, SAFE)).toBe(true)
    expect(adsAllowed(me(), '/app/safe/x', ON, SAFE)).toBe(true)
  })

  it('never while a Super Admin is impersonating', () => {
    expect(adsAllowed(me({ impersonated: true }), '/app/safe', ON, SAFE)).toBe(false)
  })

  it('never for a paid / trial / expired / queued term (server adEligible false) or no subscription / logged out', () => {
    expect(adsAllowed(me({ adEligible: false }), '/app/safe', ON, SAFE)).toBe(false)
    expect(adsAllowed(me({ noSub: true }), '/app/safe', ON, SAFE)).toBe(false)
    expect(adsAllowed(null, '/app/safe', ON, SAFE)).toBe(false)
  })

  it('env off or incomplete → nothing', () => {
    expect(adsConfigured(ON)).toBe(true)
    for (const env of [{}, { ...ON, VITE_ADS_ENABLED: 'false' }, { ...ON, VITE_ADSENSE_CLIENT: '' }, { ...ON, VITE_ADSENSE_SLOT: undefined }]) {
      expect(adsAllowed(me(), '/app/safe', env, SAFE)).toBe(false)
    }
  })

  it('shipped allowlist is empty (owner decision): no screen shows ads, the dashboard included', () => {
    const all = [
      '/app', '/app/', '/app/dashboard', '/app/billing', '/app/billing/view/5', '/app/billing/print', '/app/settings/parties', '/app/udhari', '/app/girvi',
      '/app/day-book/ledger', '/app/repair/slip/3', '/app/drafts/2/slip', '/app/account', '/admin', '/admin/users', '/platform', '/login', '/privacy', '/',
    ]
    expect(all.filter((p) => adScreen(p))).toEqual([])
    expect(all.filter((p) => adsAllowed(me(), p, ON))).toEqual([])
  })

  it('screen matching: exact vs prefix, trailing slash, no look-alike prefixes', () => {
    const screens: AdScreen[] = [{ path: '/app', exact: true }, { path: '/app/safe' }]
    expect(['/app', '/app/', '/app/safe/', '/app/safe/1'].map((p) => adScreen(p, screens))).toEqual([true, true, true, true])
    expect(['/app/billing', '/app/safer', '/app/safex/1'].map((p) => adScreen(p, screens))).toEqual([false, false, false])
  })
})
