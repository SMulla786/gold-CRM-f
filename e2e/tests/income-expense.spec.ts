import { test, expect, type APIRequestContext } from '@playwright/test';
import { login, PW } from './helpers';

// T-81: Income/Expense gained a Source filter + a "Daily summary" toggle. Seeds a today INCOME entry via API so
// the daily summary has a row for today.
async function apiToken(request: APIRequestContext, user: string) {
  return (await (await request.post('/api/auth/login', { data: { login: user, password: PW } })).json()).accessToken as string;
}
async function apiJson(request: APIRequestContext, token: string, path: string, branch = 'all') {
  const r = await request.get(`/api${path}`, { headers: { Authorization: `Bearer ${token}`, 'X-Branch-Id': branch } });
  return { status: r.status(), body: await r.json().catch(() => null) };
}
async function apiPost(request: APIRequestContext, token: string, path: string, data: unknown, branch: string) {
  const r = await request.post(`/api${path}`, { headers: { Authorization: `Bearer ${token}`, 'X-Branch-Id': branch }, data });
  return { status: r.status(), body: await r.json().catch(() => null) };
}

test('income/expense: source filter + daily-summary toggle with a row for today', async ({ page, request }) => {
  test.setTimeout(60_000);
  const token = await apiToken(request, 'demo.owner');
  const branch = (await apiJson(request, token, '/app/stock?page=1&pageSize=1')).body.items[0].branch as { id: number; name: string };
  // today's entry (no txnDate -> defaults to today's IST business date) so the daily summary has a row today
  const seed = await apiPost(request, token, '/app/income-expense', { type: 'INCOME', reason: `E2E inc ${Date.now()}`, cash: 1234 }, String(branch.id));
  expect(seed.status, JSON.stringify(seed.body)).toBe(201);

  await login(page, 'demo.owner');
  await page.waitForURL(/\/admin/);
  await page.goto('/app/income_expense');

  // new Source filter present
  await expect(page.getByRole('combobox', { name: 'Filter by source' })).toBeVisible();

  // toggle to the daily summary view
  await page.getByRole('button', { name: 'Daily summary' }).click();
  await expect(page.getByRole('button', { name: 'Entries' })).toBeVisible(); // label flips = in summary view
  await expect(page.getByRole('columnheader', { name: 'Profit' })).toBeVisible();
  // header row + at least one day row (today was just seeded)
  expect(await page.getByRole('row').count()).toBeGreaterThan(1);
});
