import { expect, test, type APIRequestContext } from '@playwright/test';
import { login, PW } from './helpers';

async function apiToken(request: APIRequestContext, user: string): Promise<string> {
  return (await (await request.post('/api/auth/login', { data: { login: user, password: PW } })).json()).accessToken as string;
}
async function apiJson(request: APIRequestContext, token: string, path: string, branch = 'all') {
  const r = await request.get(`/api${path}`, { headers: { Authorization: `Bearer ${token}`, 'X-Branch-Id': branch } });
  return { status: r.status(), body: await r.json().catch(() => null) };
}
const rx = (s: string) => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
const customer = (request: APIRequestContext, token: string) =>
  (request.post('/api/app/parties', { headers: { Authorization: `Bearer ${token}`, 'X-Branch-Id': 'all' }, data: { type: 'CUSTOMER', name: `GirviCust ${Date.now()}`, mobile: '9' + String(Date.now()).slice(-9) } })).then((r) => r.json());

test('girvi defaults tab saves (MPIN)', async ({ page, request }) => {
  test.setTimeout(60_000);
  const token = await apiToken(request, 'demo.owner');
  await request.post('/api/auth/mpin', { headers: { Authorization: `Bearer ${token}` }, data: { password: PW, mpin: '1234' } });
  await login(page, 'demo.owner');
  await page.waitForURL(/\/admin/);
  await page.goto('/app/settings/girvi');
  await page.locator('#gd-std').fill('55');
  await page.getByRole('button', { name: 'Save (MPIN)' }).click();
  await page.getByLabel('MPIN').fill('1234');
  const [resp] = await Promise.all([
    page.waitForResponse((r) => /\/app\/settings\/girvi\.defaults$/.test(r.url()) && r.request().method() === 'PUT'),
    page.getByRole('button', { name: 'Confirm' }).click(),
  ]);
  expect([200, 204]).toContain(resp.status());
  expect(Number((await apiJson(request, token, '/app/settings')).body['girvi.defaults'].stdPercent)).toBe(55);
});

test('girvi loan → pay interest → partial release → final release closes', async ({ page, request }) => {
  test.setTimeout(120_000);
  const token = await apiToken(request, 'demo.owner');
  const party = await customer(request, token);
  const backdated = new Date(Date.now() - 60 * 864e5).toISOString().slice(0, 10); // 2 months ago so interest accrues

  await login(page, 'demo.owner');
  await page.waitForURL(/\/admin/);
  await page.goto('/app/girvi/new');
  await page.getByRole('combobox', { name: 'Active branch' }).selectOption({ index: 1 });
  await page.locator('#ng-date').fill(backdated);
  await page.getByRole('combobox', { name: 'Customer' }).click();
  await page.getByPlaceholder('Search name / mobile').fill(party.name);
  await page.waitForResponse((r) => r.url().includes('/app/parties/search'));
  await page.getByRole('option', { name: rx(party.name) }).first().click();

  // two pledge items (each: net 10 × 100% × ₹6000/g = ₹60,000 valuation)
  const fillItem = async (i: number, name: string) => {
    await page.getByRole('textbox', { name: 'Item name' }).nth(i).fill(name);
    await page.getByRole('spinbutton', { name: 'Gross' }).nth(i).fill('10');
    await page.getByRole('spinbutton', { name: 'Net' }).nth(i).fill('10');
    await page.getByRole('spinbutton', { name: 'Purity' }).nth(i).fill('100');
    await page.getByRole('spinbutton', { name: 'Rate' }).nth(i).fill('6000');
  };
  await fillItem(0, 'RingA');
  await page.getByRole('button', { name: '+ Add item' }).click();
  await fillItem(1, 'RingB');

  // terms (explicit so it doesn't depend on seeded defaults)
  await page.locator('#ng-rate').fill('2');
  await page.getByRole('combobox', { name: 'Rate period' }).click();
  await page.getByRole('option', { name: 'Month', exact: true }).click();
  await page.getByRole('combobox', { name: 'Interest type' }).click();
  await page.getByRole('option', { name: 'Simple', exact: true }).click();
  await page.getByRole('combobox', { name: 'Day count method' }).click();
  await page.getByRole('option', { name: 'Full month', exact: true }).click();
  await page.locator('#ng-tenure').fill('12');

  await page.getByRole('spinbutton', { name: 'Principal' }).fill('40000');
  await page.locator('#ng-cash').fill('40000');
  await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/app/girvi') && r.request().method() === 'POST' && r.status() === 201),
    page.getByRole('button', { name: 'Create loan' }).click(),
  ]);
  await page.waitForURL(/\/app\/girvi\/\d+$/);
  const girviId = Number(page.url().match(/\/girvi\/(\d+)/)![1]);

  // pay the accrued interest (dialog prefills interest + cash from interestDue)
  await page.getByRole('button', { name: 'Pay interest' }).click();
  const [paid] = await Promise.all([
    page.waitForResponse((r) => rx(`/app/girvi/${girviId}/interest`).test(r.url()) && r.request().method() === 'POST'),
    page.getByRole('dialog').getByRole('button', { name: 'Pay interest' }).click(),
  ]);
  expect(paid.status(), JSON.stringify(await paid.json().catch(() => ''))).toBe(200);

  // BUG-11 workaround: girvi mutations don't invalidate the detail query (['girvi-batch']), so the page shows
  // stale items/interest after a mutation. Reload (+ re-pick branch) to read the true state before the next action.
  const refresh = async () => {
    await page.reload();
    await page.getByRole('combobox', { name: 'Active branch' }).selectOption({ index: 1 });
    await expect(page.getByRole('button', { name: 'Release', exact: true })).toBeVisible();
  };
  await refresh();

  // partial release: release RingA only, part of the principal → still ACTIVE
  await page.getByRole('button', { name: 'Release', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Release RingB' }).uncheck();
  await page.getByRole('spinbutton', { name: 'Principal paid' }).fill('20000');
  await page.getByRole('spinbutton', { name: 'Interest paid' }).fill('0');
  await page.getByRole('spinbutton', { name: 'Cash' }).fill('20000');
  const [rel1] = await Promise.all([
    page.waitForResponse((r) => rx(`/app/girvi/${girviId}/release`).test(r.url()) && r.request().method() === 'POST'),
    page.getByRole('dialog').getByRole('button', { name: /Release 1 item/ }).click(),
  ]);
  expect(rel1.status(), JSON.stringify(await rel1.json().catch(() => ''))).toBe(200);
  expect((await apiJson(request, token, `/app/girvi/${girviId}`)).body.status).toBe('ACTIVE');
  await refresh();

  // final release: the last item + remaining principal → CLOSED
  await page.getByRole('button', { name: 'Release', exact: true }).click();
  await page.getByRole('spinbutton', { name: 'Interest paid' }).fill('0');
  const remaining = await page.getByRole('spinbutton', { name: 'Principal paid' }).inputValue(); // prefilled with the outstanding principal
  await page.getByRole('spinbutton', { name: 'Cash' }).fill(remaining);
  const [rel2] = await Promise.all([
    page.waitForResponse((r) => rx(`/app/girvi/${girviId}/release`).test(r.url()) && r.request().method() === 'POST'),
    page.getByRole('dialog').getByRole('button', { name: /Release 1 item/ }).click(),
  ]);
  expect(rel2.status(), JSON.stringify(await rel2.json().catch(() => ''))).toBe(200);
  expect((await apiJson(request, token, `/app/girvi/${girviId}`)).body.status).toBe('CLOSED');
});
