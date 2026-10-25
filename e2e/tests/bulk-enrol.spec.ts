import { test, expect, type APIRequestContext } from '@playwright/test';
import { login, PW } from './helpers';

// T-85: schemes bulk-enrol — one scheme+group, add N members with auto-numbered Assign IDs, "Enrol N" loops the
// existing POST /schemes/enrollments once per member. Self-seeds a CASH scheme + 2 parties via API.
const rx = (s: string) => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
async function apiToken(request: APIRequestContext, user: string) {
  return (await (await request.post('/api/auth/login', { data: { login: user, password: PW } })).json()).accessToken as string;
}
async function apiJson(request: APIRequestContext, token: string, path: string, branch = 'all') {
  const r = await request.get(`/api${path}`, { headers: { Authorization: `Bearer ${token}`, 'X-Branch-Id': branch } });
  return { status: r.status(), body: await r.json().catch(() => null) };
}
async function apiPost(request: APIRequestContext, token: string, path: string, data: unknown, branch = 'all') {
  const r = await request.post(`/api${path}`, { headers: { Authorization: `Bearer ${token}`, 'X-Branch-Id': branch }, data });
  return { status: r.status(), body: await r.json().catch(() => null) };
}

test('bulk-enrol books several members into a scheme in one submit', async ({ page, request }) => {
  test.setTimeout(90_000);
  const stamp = Date.now();
  const token = await apiToken(request, 'demo.owner');

  const branch = (await apiJson(request, token, '/app/stock?page=1&pageSize=1')).body.items[0].branch as { id: number; name: string };
  const scheme = await apiPost(request, token, '/app/schemes', { type: 'CASH', name: `E2E Bulk ${stamp}`, emiAmount: 1000, tenureMonths: 3, startDate: new Date().toISOString() }, String(branch.id));
  expect(scheme.status, JSON.stringify(scheme.body)).toBe(201);
  const schemeId = scheme.body.id as number;

  const name1 = `BE One ${stamp}`;
  const name2 = `BE Two ${stamp}`;
  expect((await apiPost(request, token, '/app/parties', { type: 'CUSTOMER', name: name1, mobile: '9' + String(stamp).slice(-9) })).status).toBe(201);
  expect((await apiPost(request, token, '/app/parties', { type: 'CUSTOMER', name: name2, mobile: '8' + String(stamp).slice(-9) })).status).toBe(201);

  await login(page, 'demo.owner');
  await page.waitForURL(/\/admin/);
  await page.goto('/app/schemes/bulk-enroll');
  await page.getByRole('combobox', { name: 'Active branch' }).selectOption({ label: branch.name });

  await page.getByRole('combobox', { name: 'Scheme' }).click();
  await page.getByRole('option', { name: rx(`E2E Bulk ${stamp}`) }).click();

  for (const [i, nm] of [name1, name2].entries()) {
    await page.getByRole('combobox', { name: `Member ${i + 1}` }).click();
    await page.getByPlaceholder('Search name / mobile').fill(nm);
    await page.waitForResponse((r) => r.url().includes('/app/parties/search'));
    await page.getByRole('option', { name: rx(nm) }).first().click();
  }

  await page.locator('#be-prefix').fill('E2E');
  await page.locator('#be-startno').fill('1');
  await page.getByRole('button', { name: 'Auto-number IDs' }).click();

  await Promise.all([
    page.waitForResponse((r) => r.url().includes('/app/schemes/enrollments') && r.request().method() === 'POST' && r.status() === 201),
    page.getByRole('button', { name: /^Enrol \d+ member/ }).click(),
  ]);

  const list = await apiJson(request, token, `/app/schemes/enrollments?schemeId=${schemeId}&page=1&pageSize=50`, String(branch.id));
  expect(list.status).toBe(200);
  expect(list.body.items.length).toBe(2);
});
