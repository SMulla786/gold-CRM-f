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
  (request.post('/api/app/parties', { headers: { Authorization: `Bearer ${token}`, 'X-Branch-Id': 'all' }, data: { type: 'CUSTOMER', name: `SchemeCust ${Date.now()}`, mobile: '9' + String(Date.now()).slice(-9) } })).then((r) => r.json());

// Full Phase 11 journey: create a CASH scheme (EMI 1000 × 2, one-free-EMI bonus) → group → enrol with EMI1 →
// pay EMI2 (matured) → redeem → the ₹3,000 maturity credits the party's udhar.
test('scheme → group → enrol → remaining EMIs → matured → redeem credits the party', async ({ page, request }) => {
  test.setTimeout(120_000);
  const token = await apiToken(request, 'demo.owner');
  await request.post('/api/auth/mpin', { headers: { Authorization: `Bearer ${token}` }, data: { password: PW, mpin: '1234' } });
  const party = await customer(request, token);
  const schemeName = `E2E Scheme ${Date.now()}`;
  const groupName = `G${String(Date.now()).slice(-5)}`;
  const assignId = `M${String(Date.now()).slice(-6)}`;

  await login(page, 'demo.owner');
  await page.waitForURL(/\/admin/);

  // 1) create the scheme
  await page.goto('/app/schemes');
  await page.getByRole('combobox', { name: 'Active branch' }).selectOption({ index: 1 });
  await page.getByRole('button', { name: 'New scheme' }).click();
  await page.locator('#sc-name').fill(schemeName);
  await page.locator('#sc-emi').fill('1000');
  await page.locator('#sc-tenure').fill('2');
  await page.getByRole('combobox', { name: 'Bonus type' }).click();
  await page.getByRole('option', { name: 'One free EMI' }).click();
  await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/app/schemes') && r.request().method() === 'POST' && r.status() === 201),
    page.getByRole('dialog').getByRole('button', { name: 'Create' }).click(),
  ]);

  // 2) create a group under it
  await page.goto('/app/schemes/groups');
  await page.getByRole('button', { name: 'New group' }).click();
  await page.getByRole('dialog').getByRole('combobox', { name: 'Scheme' }).click();
  await page.getByRole('option', { name: rx(schemeName) }).click();
  await page.locator('#gr-name').fill(groupName);
  await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/app/schemes/groups') && r.request().method() === 'POST' && r.status() === 201),
    page.getByRole('dialog').getByRole('button', { name: 'Create' }).click(),
  ]);

  // 3) enrol with the first EMI collected
  await page.goto('/app/schemes/enroll');
  await page.getByRole('combobox', { name: 'Active branch' }).selectOption({ index: 1 });
  await page.getByRole('combobox', { name: 'Scheme' }).click();
  await page.getByRole('option', { name: rx(schemeName) }).click();
  await page.getByRole('combobox', { name: 'Group' }).click();
  await page.getByRole('option', { name: rx(groupName) }).click();
  await page.getByRole('combobox', { name: 'Party' }).click();
  await page.getByPlaceholder('Search name / mobile').fill(party.name);
  await page.waitForResponse((r) => r.url().includes('/app/parties/search'));
  await page.getByRole('option', { name: rx(party.name) }).first().click();
  await page.locator('#en-assign').fill(assignId);
  await page.getByRole('checkbox', { name: 'Collect first EMI' }).check();
  await page.locator('#en-pay-amt').fill('1000');
  await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/app/schemes/enrollments') && r.request().method() === 'POST' && r.status() === 201),
    page.getByRole('button', { name: 'Enrol member' }).click(),
  ]);
  await page.waitForURL(/\/app\/schemes\/members\/\d+$/);
  const enrollmentId = Number(page.url().match(/\/members\/(\d+)/)![1]);

  // 4) pay the remaining EMI (→ 2/2 matured)
  await page.getByRole('button', { name: 'Add money' }).click();
  await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/app/schemes/payments') && r.request().method() === 'POST' && r.status() === 201),
    page.getByRole('dialog').getByRole('button', { name: 'Add payment' }).click(),
  ]);
  await expect(page.getByText('Matured')).toBeVisible();

  // 5) redeem (MPIN) → party credited the maturity (2000 paid + 1000 one-EMI bonus = 3000)
  await page.getByRole('button', { name: 'Redeem / withdraw' }).click();
  await page.getByLabel('MPIN').fill('1234');
  const [red] = await Promise.all([
    page.waitForResponse((r) => rx(`/app/schemes/enrollments/${enrollmentId}/redeem`).test(r.url()) && r.request().method() === 'POST'),
    page.getByRole('button', { name: 'Confirm' }).click(),
  ]);
  expect(red.status(), JSON.stringify(await red.json().catch(() => ''))).toBe(200);

  expect((await apiJson(request, token, `/app/schemes/enrollments/${enrollmentId}`)).body.status).toBe('CLOSED');
  expect(Number((await apiJson(request, token, `/app/udhar/parties/${party.id}/balance`)).body.amount)).toBeCloseTo(-3000, 2);
});
