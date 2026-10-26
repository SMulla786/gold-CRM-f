import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { login, PW } from './helpers';

// TASK-97 girvi: per-item interest %, first-month interest (#ng-first), penalty (#ng-penalty) + breakdown line,
// item Replace / revalue (MPIN), Settings > Girvi receipt customization + penalty default + item categories.
async function apiToken(request: APIRequestContext, user: string): Promise<string> {
  return (await (await request.post('/api/auth/login', { data: { login: user, password: PW } })).json()).accessToken as string;
}
const auth = (token: string) => ({ Authorization: `Bearer ${token}`, 'X-Branch-Id': 'all' });
const getJson = async (request: APIRequestContext, token: string, path: string) => (await request.get(`/api${path}`, { headers: auth(token) })).json();
const putSetting = (request: APIRequestContext, token: string, key: string, value: unknown) =>
  request.put(`/api/app/settings/${key}`, { headers: { ...auth(token), 'X-MPIN': '1234' }, data: { value } });
const rx = (s: string) => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
const inr = (s: string | number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(s));
const customer = (request: APIRequestContext, token: string) =>
  request.post('/api/app/parties', { headers: auth(token), data: { type: 'CUSTOMER', name: `GirviT97 ${Date.now()}`, mobile: '9' + String(Date.now()).slice(-9) } }).then((r) => r.json());

async function setup(page: Page, request: APIRequestContext) {
  const token = await apiToken(request, 'demo.owner');
  await request.post('/api/auth/mpin', { headers: { Authorization: `Bearer ${token}` }, data: { password: PW, mpin: '1234' } });
  await login(page, 'demo.owner');
  await page.waitForURL(/\/admin/);
  return token;
}

interface LoanOpts { items: Array<{ name: string; itemRate?: string }>; principal: string; backdays: number; tenure: string; first?: string; penalty?: string }
/** Fills New Girvi (net 10 g x 100% x Rs 6000 = Rs 60,000 per item, 2%/month simple, full month) and creates it. Returns id + POST body. */
async function createLoan(page: Page, partyName: string, o: LoanOpts) {
  await page.goto('/app/girvi/new');
  await page.getByRole('combobox', { name: 'Active branch' }).selectOption({ index: 1 });
  await page.locator('#ng-date').fill(new Date(Date.now() - o.backdays * 864e5).toISOString().slice(0, 10));
  await page.getByRole('combobox', { name: 'Customer' }).click();
  await page.getByPlaceholder('Search name / mobile').fill(partyName);
  await page.waitForResponse((r) => r.url().includes('/app/parties/search'));
  await page.getByRole('option', { name: rx(partyName) }).first().click();
  for (const [i, it] of o.items.entries()) {
    if (i > 0) await page.getByRole('button', { name: '+ Add item' }).click();
    await page.getByRole('textbox', { name: 'Item name' }).nth(i).fill(it.name);
    await page.getByRole('spinbutton', { name: 'Gross' }).nth(i).fill('10');
    await page.getByRole('spinbutton', { name: 'Net' }).nth(i).fill('10');
    await page.getByRole('spinbutton', { name: 'Purity' }).nth(i).fill('100');
    await page.getByRole('spinbutton', { name: 'Rate', exact: true }).nth(i).fill('6000');
    if (it.itemRate) await page.getByRole('spinbutton', { name: 'Item interest %' }).nth(i).fill(it.itemRate);
  }
  await page.locator('#ng-rate').fill('2');
  await page.getByRole('combobox', { name: 'Rate period' }).click();
  await page.getByRole('option', { name: 'Month', exact: true }).click();
  await page.getByRole('combobox', { name: 'Interest type' }).click();
  await page.getByRole('option', { name: 'Simple', exact: true }).click();
  await page.getByRole('combobox', { name: 'Day count method' }).click();
  await page.getByRole('option', { name: 'Full month', exact: true }).click();
  await page.locator('#ng-tenure').fill(o.tenure);
  await expect(page.locator('#ng-return')).not.toHaveValue('—'); // live return date from issue date + tenure
  if (o.first !== undefined) await page.locator('#ng-first').fill(o.first);
  if (o.penalty !== undefined) await page.locator('#ng-penalty').fill(o.penalty);
  await page.getByRole('spinbutton', { name: 'Principal' }).fill(o.principal);
  await page.locator('#ng-cash').fill(o.principal);
  const [resp] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/app/girvi') && r.request().method() === 'POST'),
    page.getByRole('button', { name: 'Create loan' }).click(),
  ]);
  expect(resp.status(), JSON.stringify(await resp.json().catch(() => ''))).toBe(201);
  await page.waitForURL(/\/app\/girvi\/\d+$/);
  return { id: Number(page.url().match(/\/girvi\/(\d+)/)![1]), body: resp.request().postDataJSON() as Record<string, any> };
}

test('girvi: per-item interest % + first-month interest + penalty -> body, server breakdown, detail line', async ({ page, request }) => {
  test.setTimeout(120_000);
  const token = await setup(page, request);
  const party = await customer(request, token);
  // 60 days back with a 1-month tenure -> overdue, so the penalty accrues
  const { id, body } = await createLoan(page, party.name, {
    items: [{ name: 'RingA' }, { name: 'RingB', itemRate: '3' }], principal: '40000', backdays: 60, tenure: '1', first: '500', penalty: '1.5',
  });

  expect(body.items[0].ratePercent, 'blank item % = loan rate (not sent)').toBeUndefined();
  expect(Number(body.items[1].ratePercent)).toBe(3);
  expect(Number(body.firstMonthInterest)).toBe(500);
  expect(Number(body.penaltyRatePercent)).toBe(1.5);

  const loan = await getJson(request, token, `/app/girvi/${id}`);
  const ib = loan.interestBreakdown as { regular: string; firstMonth: string; penalty: string; effectiveRate: string };
  expect(ib, 'detail DTO carries interestBreakdown').toBeTruthy();
  expect(Number(ib.firstMonth)).toBeCloseTo(500, 2);
  expect(Number(ib.penalty)).toBeGreaterThan(0);
  expect(Number(ib.effectiveRate)).toBeCloseTo(2.5, 2); // equal valuations at 2% and 3%
  expect(Number(ib.regular) + Number(ib.firstMonth) + Number(ib.penalty)).toBeCloseTo(Number(loan.interestDue), 0);

  // breakdown line under the payable hero (text comes from girvi.bd_* locale keys)
  const main = page.getByRole('main');
  await expect.soft(main).toContainText(inr(ib.firstMonth));
  await expect.soft(main).toContainText(inr(ib.penalty));
});

test('girvi: Replace / revalue item - below loan -> 400 kept open; valid -> valuation updates', async ({ page, request }) => {
  test.setTimeout(120_000);
  const token = await setup(page, request);
  const party = await customer(request, token);
  const { id } = await createLoan(page, party.name, { items: [{ name: 'ChainX' }], principal: '40000', backdays: 1, tenure: '12' });

  await page.getByRole('button', { name: 'Replace or revalue ChainX' }).click();
  const dlg = page.getByRole('dialog');
  await expect(dlg).toContainText('Replace / revalue · ChainX');
  await page.locator('#rp-rate').fill('1000'); // 10 g x 100% x 1000 = Rs 10,000 < Rs 40,000 loan
  await page.locator('#rp-remark').fill('customer swapped chain');
  await dlg.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel('MPIN').fill('1234');
  const [bad] = await Promise.all([
    page.waitForResponse((r) => rx(`/app/girvi/${id}/items/`).test(r.url()) && r.request().method() === 'PATCH'),
    page.getByRole('dialog').getByRole('button', { name: 'Confirm' }).click(),
  ]);
  expect(bad.status()).toBe(400);
  await expect(page.getByRole('dialog').getByLabel('MPIN')).toBeVisible(); // MpinDialog stays open with the error

  // back to the form (closing the MPIN step reopens it), fix the rate
  await page.keyboard.press('Escape');
  await expect(page.locator('#rp-rate')).toBeVisible();
  await page.locator('#rp-rate').fill('5000'); // Rs 50,000 >= loan
  await page.getByRole('dialog').getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel('MPIN').fill('1234');
  const [ok] = await Promise.all([
    page.waitForResponse((r) => rx(`/app/girvi/${id}/items/`).test(r.url()) && r.request().method() === 'PATCH'),
    page.getByRole('dialog').getByRole('button', { name: 'Confirm' }).click(),
  ]);
  expect(ok.status(), JSON.stringify(await ok.json().catch(() => ''))).toBe(200);
  const loan = await getJson(request, token, `/app/girvi/${id}`);
  const item = (loan.items as Array<{ name: string; rate: string; valuation: string }>).find((i) => i.name === 'ChainX')!;
  expect(Number(item.rate)).toBe(5000);
  expect(Number(item.valuation)).toBeCloseTo(50000, 0);
});

test('settings > girvi: receipt customization + penalty default save with one MPIN', async ({ page, request }) => {
  test.setTimeout(60_000);
  const token = await setup(page, request);
  const orig = await getJson(request, token, '/app/settings');
  const origDefaults = orig['girvi.defaults'];
  const origReceipt = orig['girvi.receipt'];
  try {
    await page.goto('/app/settings/girvi');
    await page.locator('#gd-penalty').fill('2.25');
    await page.getByRole('combobox', { name: 'Receipt format' }).click();
    await page.getByRole('option', { name: 'Thermal 80 mm' }).click();
    const sig = page.getByRole('checkbox', { name: 'Signature lines', exact: true });
    const sigWas = (await sig.getAttribute('aria-checked')) === 'true';
    await sig.click();
    const terms = `T97 terms ${Date.now()}`;
    await page.locator('#gd-terms').fill(terms);
    await expect(page.getByLabel('Receipt preview')).toContainText(terms);

    await page.getByRole('button', { name: 'Save (MPIN)' }).click();
    await page.getByLabel('MPIN').fill('1234');
    const puts: string[] = [];
    page.on('response', (r) => { if (r.request().method() === 'PUT' && /\/app\/settings\/girvi\./.test(r.url())) puts.push(`${r.url()} ${r.status()}`); });
    await Promise.all([
      page.waitForResponse((r) => /\/app\/settings\/girvi\.receipt$/.test(r.url()) && r.request().method() === 'PUT'),
      page.getByRole('dialog').getByRole('button', { name: 'Confirm' }).click(),
    ]);
    await expect(page.getByRole('button', { name: 'Save (MPIN)' })).toBeDisabled(); // nothing left unsaved
    expect(puts.some((p) => /girvi\.defaults \d+$/.test(p)), puts.join('\n')).toBeTruthy();

    const now = await getJson(request, token, '/app/settings');
    expect(Number(now['girvi.defaults'].penaltyRatePercent)).toBe(2.25);
    expect(now['girvi.receipt'].format).toBe('THERMAL');
    expect(now['girvi.receipt'].showSignatures).toBe(!sigWas);
    expect(now['girvi.receipt'].terms).toBe(terms);
  } finally {
    await putSetting(request, token, 'girvi.defaults', origDefaults);
    await putSetting(request, token, 'girvi.receipt', origReceipt);
  }
});

test('settings > girvi: deactivated item category is hidden on New Girvi', async ({ page, request }) => {
  test.setTimeout(60_000);
  const token = await setup(page, request);
  const origDefaults = (await getJson(request, token, '/app/settings'))['girvi.defaults'];
  const active = (origDefaults.categories as string[]).filter((c) => !(origDefaults.inactiveCategories ?? []).includes(c));
  test.skip(active.length < 2, 'needs 2+ active categories (one must stay active)');
  const victim = active[active.length - 1];
  try {
    await page.goto('/app/settings/girvi');
    await page.getByRole('button', { name: `Deactivate ${victim}` }).click();
    await expect(page.getByRole('button', { name: `Activate ${victim}` })).toBeVisible();
    await page.getByRole('button', { name: 'Save (MPIN)' }).click();
    await page.getByLabel('MPIN').fill('1234');
    await Promise.all([
      page.waitForResponse((r) => /\/app\/settings\/girvi\.defaults$/.test(r.url()) && r.request().method() === 'PUT' && r.ok()),
      page.getByRole('dialog').getByRole('button', { name: 'Confirm' }).click(),
    ]);

    await page.goto('/app/girvi/new');
    await page.getByRole('combobox', { name: 'Active branch' }).selectOption({ index: 1 });
    await page.getByRole('combobox', { name: 'Category' }).first().click();
    await expect(page.getByRole('option', { name: active[0], exact: true })).toBeVisible();
    await expect(page.getByRole('option', { name: victim, exact: true })).toHaveCount(0);
    await page.keyboard.press('Escape');
  } finally {
    await putSetting(request, token, 'girvi.defaults', origDefaults);
  }
});
