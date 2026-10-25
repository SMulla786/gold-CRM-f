import { test, expect, type APIRequestContext } from '@playwright/test';
import { login, PW } from './helpers';

// T-80: Day-Book Close → a write on that closed branch-day is blocked with DAY_CLOSED → Reopen → the write succeeds.
// Shared-DB safety: operate on a DEDICATED branch + a FIXED PAST date (never today's live writes), and always
// reopen in `finally` so a mid-test failure can't leave the day closed for other specs.
const rx = (s: string) => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
const BRANCH = 'Mumbai'; // not HQ/Pune where demo stock + other specs write
const DAY = '2026-10-20'; // a past day: closing it can't block any other spec's (today-dated) writes

async function apiToken(request: APIRequestContext, user: string) {
  return (await (await request.post('/api/auth/login', { data: { login: user, password: PW } })).json()).accessToken as string;
}
async function apiJson(request: APIRequestContext, token: string, path: string, branch = 'all') {
  const r = await request.get(`/api${path}`, { headers: { Authorization: `Bearer ${token}`, 'X-Branch-Id': branch } });
  return { status: r.status(), body: await r.json().catch(() => null) };
}
async function apiPost(request: APIRequestContext, token: string, path: string, data: unknown, branch = 'all', mpin?: string) {
  const headers: Record<string, string> = { Authorization: `Bearer ${token}`, 'X-Branch-Id': branch };
  if (mpin) headers['X-MPIN'] = mpin;
  const r = await request.post(`/api${path}`, { headers, data });
  return { status: r.status(), body: await r.json().catch(() => null) };
}

async function pickParty(page: import('@playwright/test').Page, name: string) {
  await page.getByRole('combobox', { name: 'Party' }).click();
  await page.getByPlaceholder('Search name / mobile').fill(name);
  await page.waitForResponse((r) => r.url().includes('/app/parties/search'));
  await page.getByRole('option', { name: rx(name) }).first().click();
}
async function tryUdhar(page: import('@playwright/test').Page, partyName: string) {
  await page.goto('/app/udhari');
  await page.getByRole('combobox', { name: 'Active branch' }).selectOption({ label: BRANCH });
  await pickParty(page, partyName);
  await page.locator('#u-date').fill(DAY);
  await page.locator('#u-cashin').fill('500');
  const [resp] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/app/udhar') && r.request().method() === 'POST'),
    page.getByRole('button', { name: 'Save udhar' }).click(),
  ]);
  return resp;
}
async function setDay(page: import('@playwright/test').Page) {
  await page.goto('/app/daybook');
  await page.getByRole('combobox', { name: 'Active branch' }).selectOption({ label: BRANCH });
  await page.locator('#db-from').fill(DAY);
  await page.locator('#db-to').fill(DAY); // singleDay (from===to) so Open/Close controls render
}

test('day-book close blocks a write (DAY_CLOSED), reopen restores it', async ({ page, request }) => {
  test.setTimeout(120_000);
  const token = await apiToken(request, 'demo.owner');
  await request.post('/api/auth/mpin', { headers: { Authorization: `Bearer ${token}` }, data: { password: PW, mpin: '1234' } });
  const ov = await apiJson(request, token, '/admin/overview');
  const branchId = (ov.body.branches.find((b: { branch: { name: string } }) => b.branch.name === BRANCH) ?? ov.body.branches.at(-1)).branch.id as number;
  const party = (await apiPost(request, token, '/app/parties', { type: 'CUSTOMER', name: `DayClose ${Date.now()}`, mobile: '9' + String(Date.now()).slice(-9) })).body;

  try {
    await login(page, 'demo.owner');
    await page.waitForURL(/\/admin/);

    // 1) close the day (MPIN)
    await setDay(page);
    await page.getByRole('button', { name: 'Close day' }).click();
    await page.getByLabel('MPIN').fill('1234');
    await Promise.all([
      page.waitForResponse((r) => r.url().endsWith('/app/daybook/close') && r.request().method() === 'POST' && r.status() === 200),
      page.getByRole('button', { name: 'Confirm' }).click(),
    ]);
    await expect(page.getByText('Day closed')).toBeVisible();

    // 2) a write dated that closed day → DAY_CLOSED (generic sonner toast carrying the backend message)
    const blocked = await tryUdhar(page, party.name);
    expect(blocked.status()).toBe(403);
    await expect(page.getByText(/Day-Book is closed for .* — reopen the day to post\./)).toBeVisible();

    // 3) reopen the day (MPIN)
    await setDay(page);
    await page.getByRole('button', { name: 'Reopen day' }).click();
    await page.getByLabel('MPIN').fill('1234');
    await Promise.all([
      page.waitForResponse((r) => r.url().endsWith('/app/daybook/open') && r.request().method() === 'POST' && r.status() === 200),
      page.getByRole('button', { name: 'Confirm' }).click(),
    ]);
    await expect(page.getByText('Day reopened')).toBeVisible();

    // 4) the same write now succeeds
    const ok = await tryUdhar(page, party.name);
    expect(ok.status()).toBe(201);
  } finally {
    // safety net: never leave the shared dev DB with a closed day
    await apiPost(request, token, '/app/daybook/open', { date: DAY }, String(branchId), '1234');
  }
});
