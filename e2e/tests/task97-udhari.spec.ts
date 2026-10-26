import { expect, test, type APIRequestContext } from '@playwright/test';
import { login, PW } from './helpers';

// TASK-97 udhari: receipt view (/app/udhari/txn/:id) -> Edit (/app/udhari?edit=<id>, MPIN) -> Delete (MPIN).
async function apiToken(request: APIRequestContext, user: string): Promise<string> {
  return (await (await request.post('/api/auth/login', { data: { login: user, password: PW } })).json()).accessToken as string;
}
const auth = (token: string) => ({ Authorization: `Bearer ${token}`, 'X-Branch-Id': 'all' });
async function balance(request: APIRequestContext, token: string, partyId: number) {
  return (await (await request.get(`/api/app/udhar/parties/${partyId}/balance`, { headers: auth(token) })).json()) as { amount: string };
}
const rx = (s: string) => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

test('udhar edit: receipt Edit -> change received -> MPIN -> same txn no, balance follows; delete restores', async ({ page, request }) => {
  test.setTimeout(90_000);
  const token = await apiToken(request, 'demo.owner');
  await request.post('/api/auth/mpin', { headers: { Authorization: `Bearer ${token}` }, data: { password: PW, mpin: '1234' } });
  const party = (await (await request.get('/api/app/parties?page=1&pageSize=1', { headers: auth(token) })).json()).items[0];
  expect(party, 'demo data must have a party').toBeTruthy();
  const before = Number((await balance(request, token, party.id)).amount);

  await login(page, 'demo.owner');
  await page.waitForURL(/\/admin/);
  await page.goto('/app/udhari');
  await page.getByRole('combobox', { name: 'Active branch' }).selectOption({ index: 1 });
  await page.getByRole('combobox', { name: 'Party' }).click();
  await page.getByPlaceholder('Search name / mobile').fill(party.name);
  await page.waitForResponse((r) => r.url().includes('/app/parties/search'));
  await page.getByRole('option', { name: rx(party.name) }).first().click();
  await page.locator('#u-cashin').fill('500');
  const [created] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/app/udhar') && r.request().method() === 'POST'),
    page.getByRole('button', { name: 'Save udhar' }).click(),
  ]);
  expect(created.status()).toBe(201);
  const txn = (await created.json()) as { id: number; txnNo: number };
  expect(Number((await balance(request, token, party.id)).amount)).toBeCloseTo(before - 500, 2);

  // post-save banner -> receipt view
  await expect(page.getByText(`Saved udhar #${txn.txnNo}.`)).toBeVisible();
  await page.getByRole('link', { name: 'View / print receipt' }).click();
  await page.waitForURL(new RegExp(`/app/udhari/txn/${txn.id}$`));
  await expect(page.getByRole('heading', { name: `Udhar #${txn.txnNo}` })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Print layout' })).toBeVisible();

  // Edit -> form prefilled in edit mode
  await page.getByRole('main').getByRole('link', { name: 'Edit', exact: true }).click();
  await page.waitForURL(new RegExp(`/app/udhari\\?edit=${txn.id}$`));
  await expect(page.getByText(`Editing udhar #${txn.txnNo}`)).toBeVisible();
  await expect(page.locator('#u-cashin')).toHaveValue(/^500(\.0+)?$/);
  await page.locator('#u-cashin').fill('800');
  await page.getByRole('button', { name: 'Save udhar' }).click();
  await expect(page.getByRole('dialog')).toContainText(`Update udhar #${txn.txnNo}`);
  await page.getByLabel('MPIN').fill('1234');
  const [put] = await Promise.all([
    page.waitForResponse((r) => new RegExp(`/app/udhar/${txn.id}$`).test(r.url()) && r.request().method() === 'PUT'),
    page.getByRole('dialog').getByRole('button', { name: 'Confirm' }).click(),
  ]);
  expect(put.status(), JSON.stringify(await put.json().catch(() => ''))).toBe(200);
  await page.waitForURL(new RegExp(`/app/udhari/txn/${txn.id}$`));

  const edited = (await (await request.get(`/api/app/udhar/${txn.id}`, { headers: auth(token) })).json()) as { txnNo: number; cashIn: string; isDeleted: boolean };
  expect(edited.txnNo, 're-posted under the same txn no').toBe(txn.txnNo);
  expect(Number(edited.cashIn)).toBe(800);
  expect(Number((await balance(request, token, party.id)).amount)).toBeCloseTo(before - 800, 2); // old 500 reversed, new 800 posted

  // delete after edit -> party back to where it started
  await page.reload();
  await page.getByRole('main').getByRole('button', { name: 'Delete', exact: true }).click();
  await page.getByLabel('MPIN').fill('1234');
  const [del] = await Promise.all([
    page.waitForResponse((r) => new RegExp(`/app/udhar/${txn.id}$`).test(r.url()) && r.request().method() === 'DELETE'),
    page.getByRole('dialog').getByRole('button', { name: 'Confirm' }).click(),
  ]);
  expect([200, 204]).toContain(del.status());
  await page.waitForURL(/\/app\/udhari\/list$/);
  expect(Number((await balance(request, token, party.id)).amount)).toBeCloseTo(before, 2);
});

test('udhar edit: wrong MPIN keeps the dialog open and changes nothing', async ({ page, request }) => {
  test.setTimeout(60_000);
  const token = await apiToken(request, 'demo.owner');
  await request.post('/api/auth/mpin', { headers: { Authorization: `Bearer ${token}` }, data: { password: PW, mpin: '1234' } });
  // newest live (not deleted) udhar txn from the entries list (source UDHAR rows carry the txn id in sourceId)
  const entries = (await (await request.get('/api/app/udhar/entries?page=1&pageSize=50', { headers: auth(token) })).json()).items as Array<{ source: string; sourceId: string; isReversal: boolean }>;
  let target: { id: number } | undefined;
  let orig: { txnNo: number; remark: string | null; isDeleted: boolean } | undefined;
  for (const e of entries.filter((x) => x.source === 'UDHAR' && !x.isReversal)) {
    const t = await (await request.get(`/api/app/udhar/${e.sourceId}`, { headers: auth(token) })).json();
    if (!t.isDeleted) { target = { id: Number(e.sourceId) }; orig = t; break; }
  }
  expect(target, 'demo data must have a live udhar txn').toBeTruthy();

  await login(page, 'demo.owner');
  await page.waitForURL(/\/admin/);
  await page.goto(`/app/udhari?edit=${target!.id}`);
  await expect(page.getByText(`Editing udhar #${orig!.txnNo}`)).toBeVisible();
  await page.locator('#u-remark').fill(`edit-check ${Date.now()}`);
  await page.getByRole('button', { name: 'Save udhar' }).click();
  await page.getByLabel('MPIN').fill('9999');
  const [put] = await Promise.all([
    page.waitForResponse((r) => new RegExp(`/app/udhar/${target!.id}$`).test(r.url()) && r.request().method() === 'PUT'),
    page.getByRole('dialog').getByRole('button', { name: 'Confirm' }).click(),
  ]);
  expect(put.status()).toBeGreaterThanOrEqual(400);
  await expect(page.getByRole('dialog')).toBeVisible();
  const after = await (await request.get(`/api/app/udhar/${target!.id}`, { headers: auth(token) })).json();
  expect(after.remark ?? null).toBe(orig!.remark ?? null);
});
