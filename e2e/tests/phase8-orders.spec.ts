import { expect, test, type APIRequestContext } from '@playwright/test';
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
const party = (request: APIRequestContext, token: string, type: 'CUSTOMER' | 'KARIGAR', tag: string) =>
  apiPost(request, token, '/app/parties', { type, name: `${tag} ${Date.now()}`, mobile: '9' + String(Date.now()).slice(-9) }).then((r) => r.body);

// Full Phase 8 order journey, all client-side after one branch pick so the active branch persists for every call.
test('order + advance → issue to karigar → receive with ghat → READY → bill by orderId → DELIVERED; advance nets', async ({ page, request }) => {
  test.setTimeout(120_000);
  const token = await apiToken(request, 'demo.owner');
  const customer = await party(request, token, 'CUSTOMER', 'OrdCust');
  const karigar = await party(request, token, 'KARIGAR', 'OrdKari');

  await login(page, 'demo.owner');
  await page.waitForURL(/\/admin/);
  await page.goto('/app/orders/new');
  await page.getByRole('combobox', { name: 'Active branch' }).selectOption({ index: 1 });

  // customer + one GOLD line
  await page.getByRole('combobox', { name: 'Customer' }).click();
  await page.getByPlaceholder('Search name / mobile').fill(customer.name);
  await page.waitForResponse((r) => r.url().includes('/app/parties/search'));
  await page.getByRole('option', { name: rx(customer.name) }).first().click();
  await page.getByRole('combobox', { name: 'Item name' }).first().click();
  await page.getByRole('option').first().click();
  await page.getByRole('combobox', { name: 'Karat' }).first().click();
  await page.getByRole('option').first().click(); // auto-fills touch
  await page.getByRole('spinbutton', { name: 'Gross' }).first().fill('10');
  await page.getByRole('button', { name: '+ Cash' }).click();
  await page.getByRole('spinbutton', { name: 'Amount' }).fill('5000');
  await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/app/orders') && r.request().method() === 'POST' && r.status() === 201),
    page.getByRole('button', { name: 'Create order' }).click(),
  ]);
  await page.waitForURL(/\/app\/orders\/\d+$/);
  const orderId = Number(page.url().match(/\/orders\/(\d+)/)![1]);
  expect(Number((await apiJson(request, token, `/app/udhar/parties/${customer.id}/balance`)).body.amount)).toBeCloseTo(-5000, 1); // advance = shop owes

  // issue the pending item to the karigar
  await page.getByRole('checkbox', { name: /^Select / }).first().check();
  await page.getByRole('button', { name: /Issue 1 to karigar/ }).click();
  await page.getByRole('combobox', { name: 'Karigar' }).click();
  await page.getByPlaceholder('Search karigar').fill(karigar.name);
  await page.waitForResponse((r) => r.url().includes('/app/parties/search'));
  await page.getByRole('option', { name: rx(karigar.name) }).first().click();
  await page.locator('#ki-gold').fill('10');
  await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/app/karigar-issues') && r.request().method() === 'POST' && r.status() === 201),
    page.getByRole('dialog').getByRole('button', { name: 'Issue', exact: true }).click(),
  ]);

  // receive it (ghat 0.3) on the Karigar tab
  await page.getByRole('link', { name: 'Karigar' }).click();
  await page.waitForResponse((r) => r.url().includes('/app/karigar-issues') && r.url().includes('status=OPEN'));
  // the issue card's header holds the unique karigar name + its Receive button
  await page.getByText(rx(karigar.name)).locator('xpath=ancestor::div[contains(@class,"flex-row")]').getByRole('button', { name: 'Receive' }).click();
  await page.getByRole('spinbutton', { name: 'Returned gross' }).first().fill('9.5');
  await page.getByRole('spinbutton', { name: 'Ghat' }).first().fill('0.3');
  await page.getByRole('spinbutton', { name: 'Labour' }).first().fill('800');
  await page.getByRole('textbox', { name: 'Tag' }).first().fill(`OT${String(Date.now()).slice(-7)}`); // explicit tag (chosen item may be loose)
  const [recv] = await Promise.all([
    page.waitForResponse((r) => /\/app\/karigar-issues\/\d+\/receive$/.test(r.url()) && r.request().method() === 'POST'),
    page.getByRole('button', { name: 'Receive & tag finished pieces' }).click(),
  ]);
  expect(recv.status(), JSON.stringify(await recv.json().catch(() => ''))).toBe(200);
  expect((await apiJson(request, token, `/app/orders/${orderId}`)).body.status).toBe('READY');

  // back to the order → Create bill (orderId) → sells the reserved piece → DELIVERED
  await page.getByRole('link', { name: 'Orders', exact: true }).click();
  await page.locator(`a[href="/app/orders/${orderId}"]`).click();
  await page.waitForURL(rx(`/app/orders/${orderId}`));
  await Promise.all([
    page.waitForURL(/\/app\/billing\?orderId=/),
    page.getByRole('button', { name: 'Create bill' }).click(),
  ]);
  await page.getByRole('combobox', { name: 'Active branch' }).selectOption({ index: 1 }); // ensure the order's branch is active so the grid shows
  await expect(page.getByRole('spinbutton', { name: 'Rate' }).first()).toBeVisible(); // reserved piece prefilled as a line
  await page.getByRole('spinbutton', { name: 'Rate' }).first().fill('165000');
  const [sold] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/app/bills') && r.request().method() === 'POST'),
    page.getByRole('button', { name: 'Save sell bill' }).click(),
  ]);
  expect(sold.status(), JSON.stringify(await sold.json().catch(() => ''))).toBe(201);
  const billId = (await sold.json()).id as number;

  expect((await apiJson(request, token, `/app/orders/${orderId}`)).body.status).toBe('DELIVERED');
  const bill = (await apiJson(request, token, `/app/bills/${billId}`)).body;
  const bal = (await apiJson(request, token, `/app/udhar/parties/${customer.id}/balance`)).body;
  // party balance = this bill's own balance minus the ₹5,000 advance credit (advance nets automatically)
  expect(Number(bal.amount)).toBeCloseTo(Number(bill.final) - Number(bill.paid) - 5000, 1);
});
