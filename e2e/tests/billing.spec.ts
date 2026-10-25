import { expect, test, type APIRequestContext } from '@playwright/test';
import { login, PW } from './helpers';

// Drives the real Sell Bill form (demo data) and asserts server effects via the API.
async function apiToken(request: APIRequestContext, user: string): Promise<string> {
  const r = await request.post('/api/auth/login', { data: { login: user, password: PW } });
  return (await r.json()).accessToken as string;
}
async function apiJson(request: APIRequestContext, token: string, path: string, branch = 'all') {
  const r = await request.get(`/api${path}`, { headers: { Authorization: `Bearer ${token}`, 'X-Branch-Id': branch } });
  return { status: r.status(), body: await r.json().catch(() => null) };
}
const rx = (s: string) => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

test('sell TAG line + cash → bill created and the item becomes SOLD', async ({ page, request }) => {
  test.setTimeout(60_000);
  const token = await apiToken(request, 'demo.owner');
  // An AVAILABLE TAG item + a customer, straight from demo data.
  const stock = (await apiJson(request, token, '/app/stock?status=AVAILABLE&method=TAG&page=1&pageSize=50')).body;
  const item = stock.items[0];
  expect(item, 'demo data must have an AVAILABLE TAG item').toBeTruthy();
  const party = (await apiJson(request, token, '/app/parties?page=1&pageSize=1')).body.items[0];
  expect(party, 'demo data must have a party').toBeTruthy();

  await login(page, 'demo.owner');
  await page.waitForURL(/\/admin/);
  await page.goto('/app/billing');

  // active branch = the item's branch (top-bar is a native <select>) → next-no fires, picker disappears
  await page.getByRole('combobox', { name: 'Active branch' }).selectOption({ label: item.branch.name });
  await page.waitForResponse((r) => r.url().includes('/app/bills/next-no') && r.status() === 200);

  // customer (PartyPicker: trigger → type → pick)
  // BUG-7: party combobox has no accessible name — locate by its placeholder child text until it's fixed.
  await page.getByRole('combobox').filter({ hasText: 'Search name' }).first().click();
  await page.getByPlaceholder('Search name / mobile').fill(party.name);
  await page.waitForResponse((r) => r.url().includes('/app/parties/search'));
  await page.getByRole('option', { name: rx(party.name) }).first().click();

  // add the TAG stock line via search dropdown
  await page.getByPlaceholder('Tag no. or item name').fill(item.tagNo);
  await page.waitForResponse((r) => r.url().includes('/app/stock') && r.url().includes('q='));
  await page.getByRole('button', { name: rx(item.tagNo) }).click();

  // a modest cash payment (well under ₹2L so no PAN), rest kept as balance
  await page.getByRole('button', { name: '+ Cash' }).click();
  await page.getByRole('spinbutton', { name: 'Amount' }).fill('100');

  const [resp] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/app/bills') && r.request().method() === 'POST'),
    page.getByRole('button', { name: 'Save sell bill' }).click(),
  ]);
  expect(resp.status(), 'POST /app/bills').toBe(201);
  const saved = await resp.json();
  await expect(page).toHaveURL(rx(`/app/billing/view/${saved.id}`));

  // server effect: the sold item is no longer AVAILABLE
  const after = await apiJson(request, token, `/app/stock/${item.id}`);
  expect(after.status).toBe(200);
  expect(after.body.status).toBe('SOLD');
});
