import { expect, test, type Page } from '@playwright/test';
import { login, PW } from './helpers';

// Test-phase smoke over demo data: walk every Store-area screen and collect client + API errors.
// The first /api/auth/refresh 401 is the expected unauthenticated session-restore probe, not a bug.
function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (t.includes('Failed to load resource')) return; // network-level — covered (and filtered) by the response handler
    errors.push(`console: ${t}`);
  });
  page.on('response', (r) => {
    const u = r.url();
    if (!u.includes('/api/') || r.status() < 400) return;
    if (u.includes('/api/auth/refresh') && r.status() === 401) return; // expected session-restore probe
    errors.push(`HTTP ${r.status()} ${r.request().method()} ${new URL(u).pathname}`);
  });
  return errors;
}

test('demo.owner — every Store-area screen renders without client/API errors', async ({ page }) => {
  const errors = trackErrors(page);
  await login(page, 'demo.owner');
  await page.waitForURL(/\/admin/); // let login finish + ju_rt cookie land before any hard navigation
  await page.goto('/app');
  await expect(page.getByRole('main')).toBeVisible();

  const hrefs = await page.locator('nav a').evaluateAll((as) => as.map((a) => a.getAttribute('href')).filter((h): h is string => !!h && h.startsWith('/app')));
  const seen = [...new Set(hrefs)];
  expect(seen.length, 'Store sidebar should have nav items').toBeGreaterThan(0);

  // Client-side navigation (click sidebar links) — how users actually move; keeps the in-memory token.
  const broken: string[] = [];
  for (const href of seen) {
    await page.locator(`nav a[href="${href}"]`).first().click();
    await expect(page).toHaveURL(new RegExp(href.replace(/[/]/g, '\\/') + '(\\/|$|\\?)'));
    try {
      await expect(page.getByRole('main')).toBeVisible({ timeout: 15000 });
    } catch {
      broken.push(`no main at ${href}`);
    }
    if (await page.getByText('404 — not found').count()) broken.push(`404 at ${href}`);
  }
  expect(broken, 'screens that failed to render').toEqual([]);
  expect(errors, 'client/API errors during Store-area walk').toEqual([]);
});

test('(g) demo.cashier is scoped to Kothrud', async ({ page, request }) => {
  const errors = trackErrors(page);
  await login(page, 'demo.cashier');
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('main')).toBeVisible(); // not a blank page

  // Precise scope proof via the API on the same stack (vite proxies /api → :4000).
  const token = (await (await request.post('/api/auth/login', { data: { login: 'demo.cashier', password: PW } })).json()).accessToken as string;
  const me = await (await request.get('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })).json();
  expect((me.accessibleBranches as { name: string }[]).map((b) => b.name)).toEqual(['Kothrud']);
  expect(me.branch?.name).toBe('Kothrud');
  expect(errors, 'client/API errors on cashier home').toEqual([]);
});
