import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { login, PW } from './helpers';

// TASK-97 schemes: payment receipt (auto after Enrol-with-first-EMI and after Add money, + passbook 'Receipt'),
// back-dated Payment date, Bulk Enrol per-row Processing mode / Pay EMI / Pay date + Count/Repeat.
const rx = (s: string) => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
const inr = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n);
const istDay = (daysAgo = 0) => new Date(Date.now() - daysAgo * 864e5).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // YYYY-MM-DD
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

/** CASH scheme (EMI 1000 x 3) started 10 days ago on a concrete branch + the given customers. */
async function seed(request: APIRequestContext, token: string, names: string[]) {
  const stamp = Date.now();
  const branch = (await apiJson(request, token, '/app/stock?page=1&pageSize=1')).body.items[0].branch as { id: number; name: string };
  const scheme = await apiPost(request, token, '/app/schemes', { type: 'CASH', name: `E2E T97 ${stamp}`, emiAmount: 1000, tenureMonths: 3, startDate: new Date(Date.now() - 10 * 864e5).toISOString() }, String(branch.id));
  expect(scheme.status, JSON.stringify(scheme.body)).toBe(201);
  const parties: Array<{ id: number; name: string }> = [];
  for (const [i, nm] of names.entries()) {
    const p = await apiPost(request, token, '/app/parties', { type: 'CUSTOMER', name: `${nm} ${stamp}`, mobile: String(9 - i) + String(stamp).slice(-9) });
    expect(p.status).toBe(201);
    parties.push(p.body);
  }
  return { branch, schemeId: scheme.body.id as number, schemeName: scheme.body.name as string, parties };
}
async function pickParty(page: Page, comboName: string, name: string) {
  await page.getByRole('combobox', { name: comboName }).click();
  await page.getByPlaceholder('Search name / mobile').fill(name);
  await page.waitForResponse((r) => r.url().includes('/app/parties/search'));
  await page.getByRole('option', { name: rx(name) }).first().click();
}

test('scheme receipt: auto after enrol-with-first-EMI and after Add money (back-dated); passbook Receipt reopens it', async ({ page, request }) => {
  test.setTimeout(120_000);
  const token = await apiToken(request, 'demo.owner');
  const { branch, schemeName, parties: [party] } = await seed(request, token, ['RcptCust']);

  await login(page, 'demo.owner');
  await page.waitForURL(/\/admin/);
  await page.goto('/app/schemes/enroll');
  await page.getByRole('combobox', { name: 'Active branch' }).selectOption({ label: branch.name });
  await page.getByRole('combobox', { name: 'Scheme' }).click();
  await page.getByRole('option', { name: rx(schemeName) }).click();
  await pickParty(page, 'Party', party!.name);
  await page.locator('#en-assign').fill(`R${String(Date.now()).slice(-6)}`);
  await page.locator('#en-start').fill(istDay(10));
  await page.getByRole('checkbox', { name: 'Collect first EMI' }).check();
  await page.locator('#en-pay-amt').fill('1000');
  await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/app/schemes/enrollments') && r.request().method() === 'POST' && r.status() === 201),
    page.getByRole('button', { name: 'Enrol member' }).click(),
  ]);
  await page.waitForURL(/\/app\/schemes\/members\/\d+$/);
  const enrollmentId = Number(page.url().match(/\/members\/(\d+)/)![1]);

  // receipt pops (non-modal, bottom-right) for EMI #1
  const receipt = page.getByRole('dialog', { name: 'Payment receipt' });
  await expect(receipt).toBeVisible();
  await expect(receipt).toContainText('SCHEME PAYMENT RECEIPT');
  await expect(receipt).toContainText('#1 of 3');
  await expect(receipt).toContainText(inr(1000));
  await expect(receipt.getByRole('button', { name: 'Share on WhatsApp' })).toBeVisible();
  await expect(receipt.getByRole('button', { name: 'Print' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(receipt).toHaveCount(0);

  // Add money, back-dated by one day -> receipt for EMI #2, paid total 2000
  await page.getByRole('button', { name: 'Add money' }).click();
  await page.locator('#am-date').fill(istDay(1));
  const [pay] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/app/schemes/payments') && r.request().method() === 'POST'),
    page.getByRole('dialog').getByRole('button', { name: 'Add payment' }).click(),
  ]);
  expect(pay.status(), JSON.stringify(await pay.json().catch(() => ''))).toBe(201);
  await expect(receipt).toContainText('#2 of 3');
  await expect(receipt).toContainText(inr(2000)); // Paid total
  await page.keyboard.press('Escape');

  const detail = (await apiJson(request, token, `/app/schemes/enrollments/${enrollmentId}`)).body as { payments: Array<{ id: number; emiNo: number | null; txnDate: string; isReversed: boolean }> };
  const p2 = detail.payments.find((p) => p.emiNo === 2)!;
  expect(p2, 'EMI #2 posted').toBeTruthy();
  expect(p2.txnDate.slice(0, 10)).toBe(istDay(1));

  // passbook row 'Receipt' reopens that payment's receipt
  await page.getByRole('button', { name: `Receipt for payment ${p2.id}` }).click();
  await expect(receipt).toContainText('#2 of 3');
});

test('bulk enrol: per-row mode (Enroll only / With EMI pay + pay date) and Count + Repeat', async ({ page, request }) => {
  test.setTimeout(120_000);
  const token = await apiToken(request, 'demo.owner');
  const { branch, schemeId, schemeName, parties: [p1, p2] } = await seed(request, token, ['BulkOnly', 'BulkPay']);

  await login(page, 'demo.owner');
  await page.waitForURL(/\/admin/);
  await page.goto('/app/schemes/bulk-enroll');
  await page.getByRole('combobox', { name: 'Active branch' }).selectOption({ label: branch.name });
  await page.getByRole('combobox', { name: 'Scheme' }).click();
  await page.getByRole('option', { name: rx(schemeName) }).click();
  await page.locator('#be-start').fill(istDay(10));

  // Count + Repeat: 1 extra row for the same customer, then drop it again
  await pickParty(page, 'Member 1', p1!.name);
  await page.locator('#be-count').fill('1');
  await page.getByRole('button', { name: 'Repeat row 1' }).click();
  await expect(page.getByRole('combobox', { name: 'Member 2' })).toContainText(p1!.name);
  await expect(page.getByRole('combobox', { name: 'Member 4' })).toBeVisible(); // 3 blank rows + 1 repeated
  await page.getByRole('button', { name: 'Remove member' }).nth(1).click();

  // row 1 = Enroll only (default), row 2 = With EMI pay, blank amount (= scheme EMI), back-dated
  await pickParty(page, 'Member 2', p2!.name);
  await expect(page.getByRole('spinbutton', { name: 'Pay EMI 2' })).toBeDisabled();
  await page.getByRole('combobox', { name: 'Mode 2' }).click();
  await page.getByRole('option', { name: 'With EMI pay' }).click();
  await expect(page.getByRole('spinbutton', { name: 'Pay EMI 2' })).toBeEnabled();
  await page.getByLabel('Pay date 2').fill(istDay(2));
  await page.locator('#be-prefix').fill('T97');
  await page.locator('#be-startno').fill('1');
  await page.getByRole('button', { name: 'Auto-number IDs' }).click();

  const bodies: any[] = [];
  page.on('request', (r) => { if (r.url().endsWith('/app/schemes/enrollments') && r.method() === 'POST') bodies.push(r.postDataJSON()); });
  await page.getByRole('button', { name: /^Enrol 2 members?$/ }).click();
  await expect(page.getByText(/Enrolled 2 members?/)).toBeVisible(); // success toast
  expect(bodies.length).toBe(2);

  const b1 = bodies.find((b) => b.partyId === p1!.id);
  const b2 = bodies.find((b) => b.partyId === p2!.id);
  expect(b1.firstPayment, 'Enroll only sends no payment').toBeUndefined();
  expect(Number(b2.firstPayment.amount)).toBe(1000);
  expect(b2.firstPayment.txnDate).toBe(istDay(2));
  expect(b2.firstPayment.medium).toBe('CASH');

  const list = (await apiJson(request, token, `/app/schemes/enrollments?schemeId=${schemeId}&page=1&pageSize=50`, String(branch.id))).body.items as Array<{ party: { id: number }; emisPaid: number }>;
  expect(list.length).toBe(2);
  expect(list.find((e) => e.party.id === p1!.id)!.emisPaid).toBe(0);
  expect(list.find((e) => e.party.id === p2!.id)!.emisPaid).toBe(1);
});
