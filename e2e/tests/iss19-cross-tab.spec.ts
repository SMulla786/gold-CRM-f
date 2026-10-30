import { expect, test, type Page } from '@playwright/test';

import { login } from './helpers';

// ISS-19 (G7 browser regression; NOT run in the hotfix — E2E suite paused). Two pages of ONE browser context share the
// refresh cookie exactly like two tabs of one profile. A tab must never keep running as another account while showing
// its own user: it blocks with a "session changed" screen and a reload re-verifies who is signed in.
// Demo seed users: demo.owner (ADMIN → /admin), demo.cashier (BRANCH_USER → /app), superadmin (→ /platform).

const blocked = (page: Page) => page.getByRole('alertdialog');

test.describe('ISS-19 cross-tab session safety', () => {
  test('tab B signs in as another user → tab A stops at once, shows why, keeps no data; reload shows the real account', async ({ context }) => {
    const a = await context.newPage();
    await login(a, 'demo.owner');
    await expect(a).toHaveURL(/\/admin/);

    const b = await context.newPage();
    await b.goto('/login'); // tab B is logged out in its own memory, but the cookie is the owner's → it restores
    await b.evaluate(() => fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })); // leave the cookie empty
    await login(b, 'demo.cashier');
    await expect(b).toHaveURL(/\/app/);

    await expect(blocked(a)).toBeVisible();
    await expect(blocked(a)).toContainText('Signed in as someone else in another tab');
    await expect(a.getByRole('navigation')).toHaveCount(0); // the owner's shell, menus and data are gone

    // nothing tab A sends after the block carries a token
    const sent: (string | undefined)[] = [];
    a.on('request', (r) => { if (r.url().includes('/api/') && !r.url().includes('/auth/')) sent.push(r.headers().authorization); });
    await a.waitForTimeout(500);
    expect(sent.filter(Boolean)).toEqual([]);

    await a.getByRole('button', { name: 'Reload' }).click();
    await expect(a).toHaveURL(/\/app/); // now openly the cashier, with the cashier's own menus
    await expect(blocked(b)).toHaveCount(0);
  });

  test('the same user signing in again in tab B does not disturb tab A', async ({ context }) => {
    const a = await context.newPage();
    await login(a, 'demo.owner');
    const b = await context.newPage();
    await b.goto('/admin');
    await expect(b).toHaveURL(/\/admin/);
    await expect(blocked(a)).toHaveCount(0);
    await a.reload();
    await expect(a).toHaveURL(/\/admin/);
  });

  test('logout in tab B → tab A shows "Signed out in another tab" and goes to login', async ({ context }) => {
    const a = await context.newPage();
    await login(a, 'demo.owner');
    const b = await context.newPage();
    await b.goto('/admin');
    await expect(b).toHaveURL(/\/admin/);
    await b.getByRole('button', { name: 'Log out' }).click(); // Shell.tsx header (shell.logout)
    await expect(blocked(a)).toContainText('Signed out in another tab');
    await a.getByRole('button', { name: 'Sign in again' }).click();
    await expect(a).toHaveURL(/\/login/);
  });

  test('impersonation: tab A impersonates; another tab signing in as someone else stops tab A too', async ({ context }) => {
    const a = await context.newPage();
    await login(a, 'superadmin');
    await expect(a).toHaveURL(/\/platform/);
    // Start impersonation from the platform UI (Businesses → a business → Impersonate, reason). Adjust selectors in G7.
    test.fixme(true, 'G7: wire the impersonation UI steps, then login as demo.cashier in tab B and expect the block in tab A');
  });

  // G7 manual (needs a short ACCESS_TOKEN_TTL on the backend, e.g. 20s):
  //  - impersonating tab idle past the access-token TTL → "Support session ended" (never silently the Super Admin);
  //  - two tabs of one user idle past the TTL, both clicked at once → no "Refresh token reused" logout (Web Lock);
  //  - a long request in flight when tab B logs in as another user → aborted, nothing written as user B.
});
