import { expect, test, type BrowserContext, type Page, type Route } from '@playwright/test';

import { login } from './helpers';

// ISS-19 browser regression (G7). Run only in an approved browser-testing window:
//   npx playwright test tests/iss19-cross-tab.spec.ts
// Two pages of ONE browser context share the refresh cookie exactly like two tabs of one profile.
// Token expiry is NOT waited for and no server security setting is changed: an expired access token is simulated by
// answering one API call with the server's own 401 UNAUTHENTICATED (page.route), which drives the app's real refresh
// path against the real backend and cookie.
// Demo seed users: demo.owner (ADMIN → /admin), demo.cashier (BRANCH_USER → /app), superadmin (→ /platform);
// business "Demo Jewellers". Credentials come from the E2E env (helpers.ts).

const blocked = (p: Page) => p.getByRole('alertdialog');
const UNAUTH = { status: 401, contentType: 'application/json', body: JSON.stringify({ error: { code: 'UNAUTHENTICATED', message: 'expired (simulated)' } }) };

/** The next matching API call (not /auth/*) answers 401 once, like an access token that just expired. */
async function expireOnce(p: Page) {
  let done = false;
  await p.route(/\/api\/(?!auth\/)/, async (route: Route) => {
    if (done) return route.continue();
    done = true;
    await route.fulfill(UNAUTH);
  });
}

/** Records every BroadcastChannel message and storage write of the page, to prove no token / password leaves memory. */
async function recordLeaks(p: Page) {
  await p.addInitScript(() => {
    const w = window as unknown as { __bc: unknown[] };
    w.__bc = [];
    const post = BroadcastChannel.prototype.postMessage;
    BroadcastChannel.prototype.postMessage = function (m: unknown) {
      w.__bc.push(m);
      return post.call(this, m);
    };
  });
}
const leaks = async (p: Page) =>
  p.evaluate(() => ({
    messages: (window as unknown as { __bc: unknown[] }).__bc,
    storage: JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }),
  }));
const JWT = /eyJ[\w-]+\.[\w-]+\./;

/** In-app (SPA) navigation that fetches data — NOT page.goto, whose full load would restore a fresh session instead. */
const openInApp = (p: Page, href: string) => p.locator(`nav a[href="${href}"]`).first().click();

const HOME: Record<string, RegExp> = { 'demo.owner': /\/admin/, 'demo.cashier': /\/app/, superadmin: /\/platform/ };

/** Log in and wait until the app has landed (helpers.login only submits the form). */
async function signIn(p: Page, user: string) {
  await login(p, user);
  await expect(p).toHaveURL(HOME[user]!);
}

/** Tab B logs out the shared cookie without telling other tabs (as a crash / other device would), then signs in as `user`. */
async function otherTabSignsInAs(context: BrowserContext, user: string) {
  const b = await context.newPage();
  await b.goto('/login');
  await expect(b).not.toHaveURL(/\/login/); // tab B first restores the shared session — let that refresh finish
  await b.evaluate(() => fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }));
  await signIn(b, user);
  return b;
}

async function impersonateDemo(a: Page) {
  await signIn(a, 'superadmin');
  await a.goto('/platform/businesses');
  await a.getByRole('link', { name: 'Demo Jewellers' }).first().click();
  await a.getByRole('button', { name: 'Login as owner' }).click();
  await a.getByLabel('Reason (audit-logged)').fill('ISS-19 regression');
  await a.getByRole('button', { name: 'Start session' }).click();
  await expect(a).toHaveURL(/\/admin/);
  await expect(a.getByText(/Viewing as/)).toBeVisible();
}

test.describe('ISS-19 cross-tab session safety', () => {
  test('1 · different users in two tabs: tab A stops at once, explicit screen, no data, never acts as B', async ({ context }) => {
    const a = await context.newPage();
    await recordLeaks(a);
    await signIn(a, 'demo.owner');

    const sent: (string | undefined)[] = [];
    a.on('request', (r) => { if (r.url().includes('/api/') && !r.url().includes('/api/auth/')) sent.push(r.headers().authorization); });
    const b = await otherTabSignsInAs(context, 'demo.cashier');
    await expect(b).toHaveURL(/\/app/);

    await expect(blocked(a)).toBeVisible();
    await expect(blocked(a)).toContainText('Signed in as someone else in another tab');
    await expect(a.getByRole('navigation')).toHaveCount(0); // the owner's shell, menus and data are gone
    sent.length = 0;
    await a.waitForTimeout(1000);
    expect(sent).toEqual([]); // a blocked tab sends nothing (and nothing with B's token)

    const { messages, storage } = await leaks(a);
    expect(messages).toEqual([{ type: 'login', who: expect.stringMatching(/^\d+$/) }]); // A's own login: a user id, nothing else
    expect(JSON.stringify(messages)).not.toMatch(JWT);
    expect(storage).not.toMatch(JWT);

    await a.getByRole('button', { name: 'Reload' }).click(); // a full load re-verifies who is signed in
    await expect(a).toHaveURL(/\/app/);
    await expect(blocked(a)).toHaveCount(0);
  });

  test('1b · same scenario without the broadcast (BroadcastChannel unavailable): the refresh check alone blocks tab A', async ({ context }) => {
    const a = await context.newPage();
    await a.addInitScript(() => { delete (window as { BroadcastChannel?: unknown }).BroadcastChannel; });
    await signIn(a, 'demo.owner');
    await otherTabSignsInAs(context, 'demo.cashier');
    await expect(blocked(a)).toHaveCount(0); // tab A has not noticed yet

    await expireOnce(a); // A's access token "expires" → the refresh returns the cashier's session
    await openInApp(a, '/admin/users');
    await expect(blocked(a)).toContainText('Signed in as someone else in another tab');
    await expect(a.getByText('demo.cashier')).toHaveCount(0); // never shows (or acts on) the cashier's data
  });

  test('2 · the same user signing in again in another tab does not disturb tab A', async ({ context }) => {
    const a = await context.newPage();
    await signIn(a, 'demo.owner');
    await otherTabSignsInAs(context, 'demo.owner'); // new session of the SAME account in the shared cookie
    await openInApp(a, '/admin/users'); // A's old session is gone → its refresh returns the same identity → adopted
    await expect(a).toHaveURL(/\/admin\/users/);
    await expect(a.getByText('demo.cashier')).toBeVisible(); // A keeps working, with its own (owner) data
    await expect(blocked(a)).toHaveCount(0);
  });

  test('3 · logout in tab B → tab A shows "Signed out in another tab" and can only sign in again', async ({ context }) => {
    const a = await context.newPage();
    await signIn(a, 'demo.owner');
    const b = await context.newPage();
    await b.goto('/admin');
    await expect(b).toHaveURL(/\/admin/);
    await b.getByRole('button', { name: 'Log out' }).click();
    await expect(blocked(a)).toContainText('Signed out in another tab');
    await a.getByRole('button', { name: 'Sign in again' }).click();
    await expect(a).toHaveURL(/\/login/);
  });

  test('4 · simultaneous refresh: two tabs of one user refresh at once → neither is signed out (no token-reuse revoke)', async ({ context }) => {
    const a = await context.newPage();
    await signIn(a, 'demo.owner');
    const b = await context.newPage();
    await b.goto('/admin');
    await expect(b).toHaveURL(/\/admin/);
    // a full reload of both at once makes both call /auth/refresh with the same cookie at the same moment
    await Promise.all([a.reload({ waitUntil: 'commit' }), b.reload({ waitUntil: 'commit' })]);
    for (const p of [a, b]) {
      await expect(p).toHaveURL(/\/admin/);
      await expect(blocked(p)).toHaveCount(0);
      await expect(p.getByRole('main')).toBeVisible();
    }
    // both can still talk to the API afterwards (sessions were not revoked as "reused")
    await a.goto('/admin/users');
    await expect(a).toHaveURL(/\/admin\/users/);
  });

  test('5 · impersonation start: only this tab changes; another tab signing in as someone else stops it', async ({ context }) => {
    const a = await context.newPage();
    await recordLeaks(a);
    await impersonateDemo(a);
    const { messages, storage } = await leaks(a);
    expect(messages).toEqual([]); // impersonation changes only this tab: nothing is broadcast (recorder restarts per page load)
    expect(storage).not.toMatch(JWT);

    await otherTabSignsInAs(context, 'demo.cashier');
    await expect(blocked(a)).toContainText('Signed in as someone else in another tab');
  });

  test('6 · impersonation timeout: the impersonation token "expires" → "Support session ended", never silently the Super Admin', async ({ context }) => {
    const a = await context.newPage();
    await impersonateDemo(a);
    await expireOnce(a); // the cookie still belongs to the Super Admin → the refresh returns HIS session
    await openInApp(a, '/admin/users');
    await expect(blocked(a)).toContainText('Support session ended');
    await expect(a.getByText(/Viewing as/)).toHaveCount(0);
    await a.getByRole('button', { name: 'Back to platform' }).click();
    await expect(a).toHaveURL(/\/platform/); // openly the Super Admin again, after a full load
  });

  test('7 · impersonation end: back to the Super Admin, no owner data left, no block', async ({ context }) => {
    const a = await context.newPage();
    await impersonateDemo(a);
    await a.getByRole('button', { name: 'End' }).click();
    await expect(a).toHaveURL(/\/platform/);
    await expect(a.getByText(/Viewing as/)).toHaveCount(0);
    await expect(blocked(a)).toHaveCount(0);
    await a.goto('/admin');
    await expect(a).not.toHaveURL(/\/admin$/); // the Super Admin is not routed into the owner's admin area
  });

  test('8 · pending API request during an identity change is aborted, its result never shown', async ({ context }) => {
    const a = await context.newPage();
    await signIn(a, 'demo.owner');
    let release!: () => void;
    const held = new Promise<void>((r) => (release = r));
    await a.route(/\/api\/admin\/users/, async (route) => { await held; await route.continue().catch(() => {}); });
    const failed = a.waitForEvent('requestfailed', (r) => r.url().includes('/api/admin/users'));
    await a.goto('/admin/users', { waitUntil: 'commit' });
    await otherTabSignsInAs(context, 'demo.cashier');
    await expect(blocked(a)).toBeVisible();
    expect((await failed).failure()?.errorText).toMatch(/abort/i);
    release();
    await expect(a.getByRole('table')).toHaveCount(0); // nothing rendered from the late response
  });

  test('9 · React Query + permission isolation: after the switch the new account sees only its own menus and data', async ({ context }) => {
    const a = await context.newPage();
    await signIn(a, 'demo.owner');
    await a.goto('/admin/users'); // fill the owner's cache with admin-only data
    await expect(a.getByRole('table')).toBeVisible();
    await otherTabSignsInAs(context, 'demo.cashier');
    await expect(blocked(a)).toBeVisible();
    await a.getByRole('button', { name: 'Reload' }).click();
    await expect(a).toHaveURL(/\/app/);
    await a.goto('/admin/users'); // the cashier may not open the owner's admin pages, cached or not
    await expect(a).not.toHaveURL(/\/admin\/users/);
    await expect(a.getByText('demo.owner')).toHaveCount(0);
  });
});
