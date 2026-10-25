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
  (request.post('/api/app/parties', { headers: { Authorization: `Bearer ${token}`, 'X-Branch-Id': 'all' }, data: { type: 'CUSTOMER', name: `RepCust ${Date.now()}`, mobile: '9' + String(Date.now()).slice(-9) } })).then((r) => r.json());

test('repair: new ticket + advance → QA → deliver with solder → DELIVERED, balance to party', async ({ page, request }) => {
  test.setTimeout(120_000);
  const token = await apiToken(request, 'demo.owner');
  const party = await customer(request, token);
  const cat = `E2E${Date.now()}`;

  await login(page, 'demo.owner');
  await page.waitForURL(/\/admin/);
  await page.goto('/app/repair');
  await page.getByRole('combobox', { name: 'Active branch' }).selectOption({ index: 1 });

  await page.getByRole('button', { name: 'New ticket' }).click();
  await page.getByRole('combobox', { name: 'Customer' }).click();
  await page.getByPlaceholder('Search name / mobile').fill(party.name);
  await page.waitForResponse((r) => r.url().includes('/app/parties/search'));
  await page.getByRole('option', { name: rx(party.name) }).first().click();
  await page.locator('#rt-cat').fill(cat);
  await page.locator('#rt-desc').fill('Broken clasp');
  await page.locator('#rt-gross').fill('12');
  await page.locator('#rt-lab').fill('1000');
  await page.locator('#rt-oth').fill('200');
  await page.locator('#rt-acash').fill('500');
  await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/app/repairs') && r.request().method() === 'POST' && r.status() === 201),
    page.getByRole('dialog').getByRole('button', { name: 'Create ticket' }).click(),
  ]);

  // the ticket card, re-located each step (it moves columns)
  const card = () => page.getByText(rx(cat)).locator('xpath=ancestor::div[contains(@class,"bg-background")]');
  await card().getByRole('button', { name: /→ In progress/ }).click();
  await expect(card().getByRole('button', { name: /→ In review/ })).toBeVisible();
  await card().getByRole('button', { name: /→ In review/ }).click();
  await expect(card().getByRole('button', { name: 'Pass QA' })).toBeVisible();
  await card().getByRole('button', { name: 'Pass QA' }).click();
  await page.locator('#qa-rem').fill('polished, ok');
  await Promise.all([
    page.waitForResponse((r) => /\/app\/repairs\/\d+\/status$/.test(r.url()) && r.request().method() === 'POST'),
    page.getByRole('dialog').getByRole('button', { name: 'Mark ready' }).click(),
  ]);
  await expect(card().getByRole('button', { name: 'Deliver' })).toBeVisible();

  await card().getByRole('button', { name: 'Deliver' }).click();
  await page.getByRole('combobox', { name: 'Solder metal' }).click();
  await page.getByRole('option', { name: 'GOLD', exact: true }).click();
  await page.locator('#dl-fine').fill('2');
  await page.locator('#dl-rate').fill('6000'); // per gram → 2g × 6000 = 12000
  await page.locator('#dl-cash').fill('3000');
  const [del] = await Promise.all([
    page.waitForResponse((r) => /\/app\/repairs\/\d+\/deliver$/.test(r.url()) && r.request().method() === 'POST'),
    page.getByRole('dialog').getByRole('button', { name: 'Deliver' }).click(),
  ]);
  expect(del.status(), JSON.stringify(await del.json().catch(() => ''))).toBe(200);

  // charges 1000 + 200 + 12000 = 13200; − advance 500 − delivery 3000 = 9700 to the party
  const ticket = ((await apiJson(request, token, '/app/repairs?page=1&pageSize=100')).body.items as any[]).find((t) => t.category === cat);
  expect(ticket.status).toBe('DELIVERED');
  expect(Number(ticket.balance)).toBe(9700);
  expect(Number((await apiJson(request, token, `/app/udhar/parties/${party.id}/balance`)).body.amount)).toBeCloseTo(9700, 1);
});
