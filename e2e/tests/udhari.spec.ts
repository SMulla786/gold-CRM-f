import { expect, test, type APIRequestContext } from '@playwright/test';
import { login, PW } from './helpers';

async function apiToken(request: APIRequestContext, user: string): Promise<string> {
  return (await (await request.post('/api/auth/login', { data: { login: user, password: PW } })).json()).accessToken as string;
}
async function balance(request: APIRequestContext, token: string, partyId: number) {
  const r = await request.get(`/api/app/udhar/parties/${partyId}/balance`, { headers: { Authorization: `Bearer ${token}`, 'X-Branch-Id': 'all' } });
  return (await r.json()) as { amount: string; gold: string; silver: string };
}
const rx = (s: string) => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

test('new udhar: cash received → party amount balance drops by the received amount', async ({ page, request }) => {
  test.setTimeout(60_000);
  const token = await apiToken(request, 'demo.owner');
  // party from demo data
  const party = (await (await request.get('/api/app/parties?page=1&pageSize=1', { headers: { Authorization: `Bearer ${token}`, 'X-Branch-Id': 'all' } })).json()).items[0];
  expect(party, 'demo data must have a party').toBeTruthy();
  const before = await balance(request, token, party.id);

  await login(page, 'demo.owner');
  await page.waitForURL(/\/admin/);
  await page.goto('/app/udhari');

  // active branch (native select) — any concrete branch
  await page.getByRole('combobox', { name: 'Active branch' }).selectOption({ index: 1 }); // first real branch (index 0 = "All branches")

  await page.getByRole('combobox', { name: 'Party' }).click();
  await page.getByPlaceholder('Search name / mobile').fill(party.name);
  await page.waitForResponse((r) => r.url().includes('/app/parties/search'));
  await page.getByRole('option', { name: rx(party.name) }).first().click();

  // cash received = 500
  await page.locator('#u-cashin').fill('500');

  const [resp] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/app/udhar') && r.request().method() === 'POST'),
    page.getByRole('button', { name: 'Save udhar' }).click(),
  ]);
  expect(resp.status(), 'POST /app/udhar').toBe(201);

  const after = await balance(request, token, party.id);
  expect(Number(after.amount)).toBeCloseTo(Number(before.amount) - 500, 2); // received reduces what the party owes
});

test('settle a pending bill via udhar → bill paid rises by the received amount (once)', async ({ page, request }) => {
  test.setTimeout(60_000);
  const token = await apiToken(request, 'demo.owner');
  const bills = (await (await request.get('/api/app/bills?kind=SELL&page=1&pageSize=100', { headers: { Authorization: `Bearer ${token}`, 'X-Branch-Id': 'all' } })).json()).items as Array<{ id: number; billNo: string; partyId: number; final: string; paid: string; branch: { id: number; name: string }; party: { id: number; name: string } }>;
  const bill = bills.find((b) => Number(b.final) - Number(b.paid) > 100);
  expect(bill, 'demo data must have a pending SELL bill').toBeTruthy();

  await login(page, 'demo.owner');
  await page.waitForURL(/\/admin/);
  await page.goto('/app/udhari');
  await page.getByRole('combobox', { name: 'Active branch' }).selectOption({ label: bill!.branch.name });
  await page.getByRole('combobox', { name: 'Party' }).click();
  await page.getByPlaceholder('Search name / mobile').fill(bill!.party.name);
  await page.waitForResponse((r) => r.url().includes('/app/parties/search'));
  await page.getByRole('option', { name: rx(bill!.party.name) }).first().click();
  await page.locator('#u-cashin').fill('100');
  await page.getByRole('combobox', { name: 'Settle bill' }).click();
  await page.getByRole('option', { name: rx(bill!.billNo) }).click();

  const [resp] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/app/udhar') && r.request().method() === 'POST'),
    page.getByRole('button', { name: 'Save udhar' }).click(),
  ]);
  expect(resp.status()).toBe(201);
  const after = (await (await request.get(`/api/app/bills/${bill!.id}`, { headers: { Authorization: `Bearer ${token}`, 'X-Branch-Id': 'all' } })).json());
  expect(Number(after.paid)).toBeCloseTo(Number(bill!.paid) + 100, 2); // paid up by 100, counted once
});
