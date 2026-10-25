import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { login, PW } from './helpers';

// Drives the real Sell Bill form (demo data) and asserts server effects via the API.
async function apiToken(request: APIRequestContext, user: string): Promise<string> {
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
const rx = (s: string) => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

/** Create a fresh AVAILABLE TAG item via API (so repeated runs never run the demo stock dry), then
 *  log in, set that item's branch, pick a customer and add the TAG line. Ready for payment/keep/save. */
async function startSell(page: Page, request: APIRequestContext) {
  const token = await apiToken(request, 'demo.owner');
  const branch = (await apiJson(request, token, '/app/stock?page=1&pageSize=1')).body.items[0].branch as { id: number; name: string };
  const names = (await apiJson(request, token, '/app/item-names?stockClass=GOLD&page=1&pageSize=50')).body.items as Array<{ id: number; method: string; tagPrefix: string | null }>;
  const tagName = names.find((n) => n.tagPrefix && (n.method === 'TAG' || n.method === 'BOTH'));
  expect(tagName, 'demo data must have a GOLD TAG item name').toBeTruthy();
  const entry = await apiPost(request, token, '/app/stock/entries', { stockClass: 'GOLD', method: 'TAG', branchId: branch.id, rows: [{ itemNameId: tagName!.id, gross: 10, tunch: 91.67, pcs: 1 }] }, String(branch.id));
  expect(entry.status, JSON.stringify(entry.body)).toBe(201);
  const item = { ...entry.body.items[0], branch };
  // fresh customer (no PAN) so the PAN-at-₹2L rule can trigger and tests don't depend on demo parties
  const party = (await apiPost(request, token, '/app/parties', { type: 'CUSTOMER', name: `E2E ${Date.now()}`, mobile: '9' + String(Date.now()).slice(-9) })).body;
  expect(party?.id, 'created a test customer').toBeTruthy();

  await login(page, 'demo.owner');
  await page.waitForURL(/\/admin/);
  await page.goto('/app/billing');
  await page.getByRole('combobox', { name: 'Active branch' }).selectOption({ label: item.branch.name });
  await page.waitForResponse((r) => r.url().includes('/app/bills/next-no') && r.status() === 200);
  await page.getByRole('combobox', { name: 'Customer' }).click();
  await page.getByPlaceholder('Search name / mobile').fill(party.name);
  await page.waitForResponse((r) => r.url().includes('/app/parties/search'));
  await page.getByRole('option', { name: rx(party.name) }).first().click();
  await page.getByPlaceholder('Tag no. or item name').fill(item.tagNo);
  await page.waitForResponse((r) => r.url().includes('/app/stock') && r.url().includes('q='));
  await page.getByRole('button', { name: rx(item.tagNo) }).click();
  // give the line a realistic rate (₹165000/10g, within the gold band) so the bill has value
  await page.getByRole('spinbutton', { name: 'Rate' }).first().fill('165000');
  return { token, item, party };
}

test('sell TAG line + cash → bill created and the item becomes SOLD', async ({ page, request }) => {
  test.setTimeout(60_000);
  const { token, item } = await startSell(page, request);
  await page.getByRole('button', { name: '+ Cash' }).click();
  await page.getByRole('spinbutton', { name: 'Amount' }).fill('100');
  const [resp] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/app/bills') && r.request().method() === 'POST'),
    page.getByRole('button', { name: 'Save sell bill' }).click(),
  ]);
  expect(resp.status()).toBe(201);
  await expect(page).toHaveURL(rx(`/app/billing/view/${(await resp.json()).id}`));
  expect((await apiJson(request, token, `/app/stock/${item.id}`)).body.status).toBe('SOLD');
});

test('keep balance as GOLD → party gold balance increases', async ({ page, request }) => {
  test.setTimeout(60_000);
  const { token, party } = await startSell(page, request);
  const before = (await apiJson(request, token, `/app/udhar/parties/${party.id}/balance`)).body;
  // no payment → whole final is kept; keep it as GOLD at the current rate
  await page.getByRole('combobox', { name: 'Keep balance as' }).click();
  await page.getByRole('option', { name: 'GOLD' }).click();
  await page.getByLabel('Keep rate').fill('165000');
  const [resp] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/app/bills') && r.request().method() === 'POST'),
    page.getByRole('button', { name: 'Save sell bill' }).click(),
  ]);
  expect(resp.status()).toBe(201);
  const after = (await apiJson(request, token, `/app/udhar/parties/${party.id}/balance`)).body;
  expect(Number(after.gold)).toBeGreaterThan(Number(before.gold)); // balance kept as gold
});

test('PAN prompt appears at ≥₹2,00,000 cash and the bill saves with a PAN', async ({ page, request }) => {
  test.setTimeout(60_000);
  await startSell(page, request);
  await page.getByRole('button', { name: '+ Cash' }).click();
  await page.getByRole('spinbutton', { name: 'Amount' }).fill('200000'); // ≥ 2 lakh cash triggers PAN
  await page.getByRole('button', { name: 'Save sell bill' }).click();
  // PAN dialog
  const panInput = page.getByRole('textbox', { name: 'PAN' });
  await expect(panInput).toBeVisible();
  await panInput.fill('ABCDE1234F');
  const [resp] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/app/bills') && r.request().method() === 'POST' && r.status() === 201),
    page.getByRole('button', { name: 'Save with PAN' }).click(),
  ]);
  expect(resp.status()).toBe(201);
});

test('delete a sell bill with return → the item goes back to AVAILABLE', async ({ page, request }) => {
  test.setTimeout(60_000);
  const { token, item } = await startSell(page, request);
  // delete needs X-MPIN — make sure the owner has one
  await request.post('/api/auth/mpin', { headers: { Authorization: `Bearer ${token}` }, data: { password: PW, mpin: '1234' } });
  const [created] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/app/bills') && r.request().method() === 'POST'),
    page.getByRole('button', { name: 'Save sell bill' }).click(),
  ]);
  const savedId = (await created.json()).id as number;
  expect((await apiJson(request, token, `/app/stock/${item.id}`)).body.status).toBe('SOLD');

  await page.goto('/app/billing/list');
  await page.waitForResponse((r) => r.url().includes('/app/bills') && r.url().includes('kind=SELL'));
  // match the row by the bill's id (its view link) — billNo substrings aren't unique (GST/ROUGH share a series)
  const row = page.getByRole('row').filter({ has: page.locator(`a[href="/app/billing/view/${savedId}"]`) });
  await row.getByRole('button', { name: 'Delete' }).click();
  // dialog: Stock handling defaults to "Item Return"; enter MPIN; confirm
  await page.getByLabel('MPIN').fill('1234');
  const [del] = await Promise.all([
    page.waitForResponse((r) => /\/app\/bills\/\d+/.test(r.url()) && r.request().method() === 'DELETE'),
    page.getByRole('button', { name: 'Delete bill' }).click(),
  ]);
  expect([200, 204]).toContain(del.status());
  expect((await apiJson(request, token, `/app/stock/${item.id}`)).body.status).toBe('AVAILABLE'); // returned to stock
});

test('purchase bill → a new stock item appears in stock', async ({ page, request }) => {
  test.setTimeout(60_000);
  const token = await apiToken(request, 'demo.owner');
  const itemName = (await apiJson(request, token, '/app/item-names?stockClass=GOLD&page=1&pageSize=1')).body.items[0];
  expect(itemName, 'demo data must have a GOLD item name').toBeTruthy();
  const party = (await apiJson(request, token, '/app/parties?page=1&pageSize=1')).body.items[0];
  const branchName = 'Demo HQ';

  await login(page, 'demo.owner');
  await page.waitForURL(/\/admin/);
  await page.goto('/app/billing/purchase');
  await page.getByRole('combobox', { name: 'Active branch' }).selectOption({ label: branchName });
  await page.waitForResponse((r) => r.url().includes('/app/bills/next-no') && r.status() === 200);
  await page.getByRole('combobox', { name: 'Supplier' }).click();
  await page.getByPlaceholder('Search name / mobile').fill(party.name);
  await page.waitForResponse((r) => r.url().includes('/app/parties/search'));
  await page.getByRole('option', { name: rx(party.name) }).first().click();
  // add a purchase line: stock class GOLD (default) + item name, then weights
  await page.getByRole('combobox', { name: 'Item name' }).click();
  await page.getByRole('option', { name: rx(itemName.name) }).first().click();
  await page.getByRole('button', { name: '+ Add row' }).click();
  const row = page.locator('tbody tr').first();
  await row.getByRole('spinbutton').nth(1).fill('10'); // gross (unlabeled grid input: pcs=0, gross=1)
  await row.getByRole('spinbutton', { name: 'Rate' }).fill('16500'); // ~165000/10g, within the gold band
  const [resp] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/app/bills') && r.request().method() === 'POST'),
    page.getByRole('button', { name: 'Save purchase bill' }).click(),
  ]);
  const bill = await resp.json();
  expect(resp.status(), JSON.stringify(bill)).toBe(201);
  // assert on the bill's OWN created stock item(s), not a shared per-itemName AVAILABLE total (racy with other specs)
  const stockIds = (bill.items as Array<{ stockItemId: number | null }>).map((i) => i.stockItemId).filter((id): id is number => id != null);
  expect(stockIds.length, 'purchase line created a stock item').toBe(1);
  const created = (await apiJson(request, token, `/app/stock/${stockIds[0]}`)).body;
  expect(created.status).toBe('AVAILABLE');
  expect(created.itemName.id).toBe(itemName.id);
  expect(Number(created.gross)).toBe(10); // the 10g line we entered
});

test('rate outside the allowed limit → line error, bill not saved', async ({ page, request }) => {
  test.setTimeout(60_000);
  await startSell(page, request);
  await page.getByRole('spinbutton', { name: 'Rate' }).first().fill('99999999'); // far above the gold rate limit
  const [resp] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/app/bills') && r.request().method() === 'POST'),
    page.getByRole('button', { name: 'Save sell bill' }).click(),
  ]);
  expect(resp.status()).toBe(400); // RATE_LIMIT
  await expect(page).toHaveURL(/\/app\/billing$/); // stayed on the form, no navigation to the view
});
