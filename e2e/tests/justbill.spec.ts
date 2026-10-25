import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { login, PW } from './helpers';

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
const freshCustomer = (request: APIRequestContext, token: string) =>
  apiPost(request, token, '/app/parties', { type: 'CUSTOMER', name: `JB ${Date.now()}`, mobile: '9' + String(Date.now()).slice(-9) }).then((r) => r.body);

/** Open the Just Bill form on a concrete branch with one 10g @ ₹60,000 line filled. */
async function openJustBill(page: Page) {
  await login(page, 'demo.owner');
  await page.waitForURL(/\/admin/);
  await page.goto('/app/billing/just');
  await Promise.all([
    page.waitForResponse((r) => r.url().includes('/app/just-bills/next-no') && r.status() === 200),
    page.getByRole('combobox', { name: 'Active branch' }).selectOption({ index: 1 }),
  ]);
  await page.getByRole('textbox', { name: 'Item name' }).first().fill('Gold Chain');
  await page.getByRole('spinbutton', { name: 'Quantity' }).first().fill('10');
  await page.getByRole('spinbutton', { name: 'Rate' }).first().fill('60000'); // Just Bill rate is per unit → 10 × 60000 = 6,00,000
}

test('Just Bill: walk-in fully paid in cash → saved with zero balance', async ({ page, request }) => {
  test.setTimeout(60_000);
  const token = await apiToken(request, 'demo.owner');
  await openJustBill(page);
  await page.getByRole('textbox', { name: 'Walk-in name', exact: true }).fill(`Walk ${Date.now()}`);
  await page.getByRole('button', { name: '+ Cash' }).click();
  await page.getByRole('spinbutton', { name: 'Amount' }).fill('600000');
  const [resp] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/app/just-bills') && r.request().method() === 'POST'),
    page.getByRole('button', { name: 'Save Just Bill' }).click(),
  ]);
  expect(resp.status(), JSON.stringify(await resp.json().catch(() => ''))).toBe(201);
  const id = (await resp.json()).id as number;
  await expect(page).toHaveURL(rx(`/app/billing/just/view/${id}`));
  const bill = (await apiJson(request, token, `/app/just-bills/${id}`)).body;
  expect(Number(bill.paid)).toBe(600000);
  expect(Number(bill.balance)).toBe(0);
});

test('Just Bill: party-linked with a balance → party udhar rises by the unpaid amount', async ({ page, request }) => {
  test.setTimeout(60_000);
  const token = await apiToken(request, 'demo.owner');
  const party = await freshCustomer(request, token);
  await openJustBill(page);
  await page.getByRole('combobox', { name: 'Customer' }).click();
  await page.getByPlaceholder('Search name / mobile').fill(party.name);
  await page.waitForResponse((r) => r.url().includes('/app/parties/search'));
  await page.getByRole('option', { name: rx(party.name) }).first().click();
  await page.getByRole('button', { name: '+ Cash' }).click();
  await page.getByRole('spinbutton', { name: 'Amount' }).fill('100000'); // final 6,00,000 − 1,00,000 = 5,00,000 balance
  const [resp] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/app/just-bills') && r.request().method() === 'POST'),
    page.getByRole('button', { name: 'Save Just Bill' }).click(),
  ]);
  expect(resp.status()).toBe(201);
  const bal = (await apiJson(request, token, `/app/udhar/parties/${party.id}/balance`)).body;
  expect(Number(bal.amount)).toBeCloseTo(500000, 2); // unpaid balance landed on the party
});

test('Just Bill: old-gold (METAL/KACHA) payment is recorded on the bill', async ({ page, request }) => {
  test.setTimeout(60_000);
  const token = await apiToken(request, 'demo.owner');
  const party = await freshCustomer(request, token); // metal-only part-payment → needs a party to carry the balance
  await openJustBill(page);
  await page.getByRole('combobox', { name: 'Customer' }).click();
  await page.getByPlaceholder('Search name / mobile').fill(party.name);
  await page.waitForResponse((r) => r.url().includes('/app/parties/search'));
  await page.getByRole('option', { name: rx(party.name) }).first().click();
  await page.getByRole('button', { name: '+ Old gold/metal' }).click();
  await page.getByRole('spinbutton', { name: 'Gross' }).fill('10');
  await page.getByRole('spinbutton', { name: 'Tunch' }).fill('90');
  await page.getByRole('spinbutton', { name: 'Rate' }).last().fill('60000'); // metal payment rate (line Rate is .first())
  const [resp] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/app/just-bills') && r.request().method() === 'POST'),
    page.getByRole('button', { name: 'Save Just Bill' }).click(),
  ]);
  expect(resp.status(), JSON.stringify(await resp.json().catch(() => ''))).toBe(201);
  const bill = (await apiJson(request, token, `/app/just-bills/${(await resp.json()).id}`)).body;
  const metalPay = bill.payments.find((p: { mode: string; metal: string | null; metalForm: string | null }) => p.mode === 'METAL');
  expect(metalPay, 'old-gold payment recorded').toBeTruthy();
  expect(metalPay.metal).toBe('GOLD');
  expect(metalPay.metalForm).toBe('KACHA'); // old gold → the backend posts a GOLD KACHA ledger row
});

test('Just Bill: walk-in with an unpaid balance is blocked', async ({ page, request }) => {
  test.setTimeout(60_000);
  await openJustBill(page);
  await page.getByRole('textbox', { name: 'Walk-in name', exact: true }).fill(`Walk ${Date.now()}`);
  // no payment → balance due; the form warns and the server rejects
  await expect(page.getByText(/walk-in bill must be fully paid/i)).toBeVisible();
  const [resp] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/app/just-bills') && r.request().method() === 'POST'),
    page.getByRole('button', { name: 'Save Just Bill' }).click(),
  ]);
  expect(resp.status()).toBe(400); // "Link a party to keep a balance"
  await expect(page).toHaveURL(/\/app\/billing\/just$/); // stayed on the form
});

test('Just Bill: delete with MPIN → marked deleted', async ({ page, request }) => {
  test.setTimeout(60_000);
  const token = await apiToken(request, 'demo.owner');
  await request.post('/api/auth/mpin', { headers: { Authorization: `Bearer ${token}` }, data: { password: PW, mpin: '1234' } });
  await openJustBill(page);
  await page.getByRole('textbox', { name: 'Walk-in name', exact: true }).fill(`Walk ${Date.now()}`);
  await page.getByRole('button', { name: '+ Cash' }).click();
  await page.getByRole('spinbutton', { name: 'Amount' }).fill('600000');
  const [created] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/app/just-bills') && r.request().method() === 'POST'),
    page.getByRole('button', { name: 'Save Just Bill' }).click(),
  ]);
  const id = (await created.json()).id as number;

  await page.goto('/app/billing/just/list');
  await page.waitForResponse((r) => r.url().includes('/app/just-bills') && r.url().includes('page='));
  const row = page.getByRole('row').filter({ has: page.locator(`a[href="/app/billing/just/view/${id}"]`) });
  await row.getByRole('button', { name: 'Delete' }).click();
  await page.getByLabel('MPIN').fill('1234');
  const [del] = await Promise.all([
    page.waitForResponse((r) => /\/app\/just-bills\/\d+$/.test(r.url()) && r.request().method() === 'DELETE'),
    page.getByRole('button', { name: 'Confirm' }).click(),
  ]);
  expect([200, 204]).toContain(del.status());
  expect((await apiJson(request, token, `/app/just-bills/${id}`)).body.status).toBe('DELETED');
});
