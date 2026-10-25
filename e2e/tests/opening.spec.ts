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
const partyBalance = async (request: APIRequestContext, token: string, id: number) => (await apiJson(request, token, `/app/udhar/parties/${id}/balance`)).body as { amount: string; gold: string; silver: string };

// Records an opening batch (cash + bank + party) through the real screen, then reverses it — asserting
// server effects (the ledger-derived batch + the party's udhar balance) via the API.
test('opening balance: cash + bank + party posts, then Reverse (MPIN) zeroes the party', async ({ page, request }) => {
  test.setTimeout(90_000);
  const token = await apiToken(request, 'demo.owner');
  await request.post('/api/auth/mpin', { headers: { Authorization: `Bearer ${token}` }, data: { password: PW, mpin: '1234' } });
  // a fresh party so the opening amount is its whole balance (repeatable across runs)
  const party = (await apiPost(request, token, '/app/parties', { type: 'CUSTOMER', name: `OB ${Date.now()}`, mobile: '9' + String(Date.now()).slice(-9) })).body;
  expect(party?.id, 'created a test party').toBeTruthy();
  const branch = (await apiJson(request, token, '/app/stock?page=1&pageSize=1')).body.items[0].branch as { id: number; name: string };
  const bank = (await apiJson(request, token, '/app/bank-accounts')).body?.[0] as { id: number } | undefined;
  const remark = `e2e-${Date.now()}`;

  await login(page, 'demo.owner');
  await page.waitForURL(/\/admin/);
  await page.goto('/app/settings/opening');
  await page.getByRole('combobox', { name: 'Active branch' }).selectOption({ label: branch.name });
  await page.locator('#ob-remark').fill(remark);
  await page.locator('#ob-cash').fill('5000');

  // one bank row (sections: Bank=0, Bullion=1, Party=2)
  if (bank) {
    await page.getByRole('button', { name: '+ Add' }).nth(0).click();
    await page.getByRole('combobox', { name: 'Bank account' }).click();
    await page.getByRole('option').first().click();
    await page.getByRole('spinbutton', { name: 'Bank amount' }).fill('2000');
  }

  // one party row (+700 = party owes shop)
  await page.getByRole('button', { name: '+ Add' }).nth(2).click();
  await page.getByRole('combobox', { name: 'Party' }).click();
  await page.getByPlaceholder('Search party…').fill(party.name);
  await page.waitForResponse((r) => r.url().includes('/app/parties/search'));
  await page.getByRole('option', { name: rx(party.name) }).first().click();
  await page.getByRole('spinbutton', { name: 'Party amount' }).fill('700');

  await page.getByRole('button', { name: 'Save (MPIN)' }).click();
  await page.getByLabel('MPIN').fill('1234');
  const [resp] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/app/opening-balances') && r.request().method() === 'POST'),
    page.getByRole('button', { name: 'Confirm' }).click(),
  ]);
  const created = await resp.json();
  expect(resp.status(), JSON.stringify(created)).toBe(201);
  // the ledger-derived batch carries the money rows we entered…
  expect(Number(created.cash)).toBe(5000);
  if (bank) expect(created.bank.reduce((s: number, x: { amount: string }) => s + Number(x.amount), 0)).toBe(2000);
  expect(created.parties.length).toBe(1);
  // …and the party opening posted to udhar (+700 owed to shop)
  expect(Number((await partyBalance(request, token, party.id)).amount)).toBeCloseTo(700, 2);

  // Reverse that batch via the UI (MPIN) → party back to zero
  const row = page.locator('.rounded-md.border').filter({ hasText: remark });
  await row.getByRole('button', { name: 'Reverse' }).click();
  await page.getByLabel('MPIN').fill('1234');
  const [rev] = await Promise.all([
    page.waitForResponse((r) => r.url().includes(`/app/opening-balances/${created.sourceId}`) && r.request().method() === 'DELETE'),
    page.getByRole('button', { name: 'Confirm' }).click(),
  ]);
  expect([200, 204]).toContain(rev.status());
  expect(Number((await partyBalance(request, token, party.id)).amount)).toBeCloseTo(0, 2); // reversed
});
