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

/** Flatten the admin branch tree to find branches by name. */
async function branchesByName(request: APIRequestContext, token: string) {
  const tree = (await apiJson(request, token, '/admin/branches')).body;
  const flat = (n: { id: number; name: string; children?: unknown[] }): { id: number; name: string }[] => [{ id: n.id, name: n.name }, ...((n.children as typeof n[]) ?? []).flatMap(flat)];
  const all = (Array.isArray(tree) ? tree : [tree]).flatMap(flat);
  return new Map(all.map((b) => [b.name, b.id]));
}
async function tagItemName(request: APIRequestContext, token: string) {
  return (await apiJson(request, token, '/app/item-names?stockClass=GOLD&page=1&pageSize=50')).body.items.find((n: { method: string; tagPrefix: string | null }) => n.tagPrefix && (n.method === 'TAG' || n.method === 'BOTH'));
}

/** Opens New Stock as demo.owner on a concrete branch with the chosen entry method; returns a GOLD item name. */
async function openNewStock(page: Page, request: APIRequestContext, method: 'TAG' | 'LOOSE') {
  const token = await apiToken(request, 'demo.owner');
  const branch = (await apiJson(request, token, '/app/stock?page=1&pageSize=1')).body.items[0].branch as { id: number; name: string };
  const name = (await apiJson(request, token, '/app/item-names?stockClass=GOLD&page=1&pageSize=50')).body.items.find((n: { method: string }) => n.method === 'BOTH' || n.method === method);
  expect(name, 'need a GOLD item name allowing ' + method).toBeTruthy();

  await login(page, 'demo.owner');
  await page.waitForURL(/\/admin/);
  await page.goto('/app/inventory/new');
  await page.getByRole('combobox', { name: 'Active branch' }).selectOption({ label: branch.name });
  await page.getByRole('combobox', { name: 'Entry method' }).click();
  await page.getByRole('option', { name: method === 'TAG' ? 'Tag' : 'Loose', exact: true }).click();
  const row = page.locator('tbody tr').first();
  await row.getByRole('combobox', { name: 'Item name' }).click();
  await page.getByRole('option', { name: rx(name.name) }).first().click();
  return { token, row };
}

for (const method of ['TAG', 'LOOSE'] as const) {
  test(`New Stock ${method}: the live net/fine shown equals what the API saves`, async ({ page, request }) => {
    test.setTimeout(60_000);
    const { token, row } = await openNewStock(page, request, method);
    await row.getByRole('spinbutton').nth(1).fill('10'); // gross (pcs=0, gross=1, less=2, tunch=3, wst=4)
    await row.getByRole('spinbutton').nth(3).fill('91.67'); // tunch
    // live preview in the grid
    await expect(row.getByText('10.000')).toBeVisible();
    await expect(row.getByText('9.167')).toBeVisible();
    const [resp] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith('/app/stock/entries') && r.request().method() === 'POST'),
      page.getByRole('button', { name: 'Save 1 item' }).click(),
    ]);
    expect(resp.status(), JSON.stringify(await resp.json().catch(() => ''))).toBe(201);
    const item = (await resp.json()).items[0];
    expect(Number(item.net)).toBe(10); // saved == what the grid showed (10.000) — Decimal normalizes the string
    expect(Number(item.fine)).toBeCloseTo(9.167, 3);
    expect(item.method).toBe(method);
    // and it is readable back as AVAILABLE
    expect((await apiJson(request, token, `/app/stock/${item.id}`)).body.status).toBe('AVAILABLE');
  });
}

test('transfer an item HQ → Pune via the page → its branch changes', async ({ page, request }) => {
  test.setTimeout(60_000);
  const token = await apiToken(request, 'demo.owner');
  const byName = await branchesByName(request, token);
  const hqName = [...byName.keys()].find((n) => /HQ/.test(n))!;
  const hq = byName.get(hqName)!;
  const pune = byName.get('Pune')!;
  expect(hq && pune, 'demo data must have HQ and Pune branches').toBeTruthy();
  const name = await tagItemName(request, token);
  // fresh AVAILABLE item in HQ so repeated runs always have something to move
  const entry = await apiPost(request, token, '/app/stock/entries', { stockClass: 'GOLD', method: 'TAG', branchId: hq, rows: [{ itemNameId: name.id, gross: 5, tunch: 91.67, pcs: 1 }] }, String(hq));
  expect(entry.status, JSON.stringify(entry.body)).toBe(201);
  const item = entry.body.items[0];

  await login(page, 'demo.owner');
  await page.waitForURL(/\/admin/);
  await page.goto('/app/inventory/transfers');
  await page.getByRole('button', { name: 'New transfer' }).click();
  // shadcn selects: open, pick by option label
  await page.getByRole('combobox', { name: 'From branch' }).click();
  await page.getByRole('option', { name: hqName, exact: true }).click();
  await page.getByRole('combobox', { name: 'To branch' }).click();
  await page.getByRole('option', { name: 'Pune', exact: true }).click();
  await page.getByRole('checkbox', { name: `Select ${item.tagNo}` }).check();
  const [resp] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/app/stock/transfer') && r.request().method() === 'POST'),
    page.getByRole('button', { name: /Transfer 1 item/ }).click(),
  ]);
  expect(resp.status(), JSON.stringify(await resp.json().catch(() => ''))).toBeLessThan(300);
  expect((await apiJson(request, token, `/app/stock/${item.id}`)).body.branch.id).toBe(pune); // moved
});

test('CSV import: a bad row is caught in the dry-run; a clean file imports', async ({ page, request }) => {
  test.setTimeout(60_000);
  const token = await apiToken(request, 'demo.owner');
  // a GOLD item name that allows LOOSE, plus its group (import resolves item_name within the chosen group)
  const names = (await apiJson(request, token, '/app/item-names?stockClass=GOLD&page=1&pageSize=50')).body.items as Array<{ name: string; method: string; group: { id: number; name: string } }>;
  const name = names.find((n) => n.method === 'LOOSE' || n.method === 'BOTH')!;
  expect(name, 'demo data must have a GOLD item name allowing LOOSE').toBeTruthy();
  const header = 'item_name,tag_no,huid,karat,pcs,gross,less,tunch,wastage,stone_charge,labour,labour_unit,other,rate,purchase_cost,remarks';
  const goodRow = `${name.name},,,,1,10,,91.67,,,,,,,,e2e`;
  const badRow = `${name.name},,,,1,NOTANUMBER,,91.67,,,,,,,,e2e`;

  await login(page, 'demo.owner');
  await page.waitForURL(/\/admin/);
  await page.goto('/app/inventory/import');
  // method defaults to LOOSE; pick the item's group (required before the buttons enable)
  await page.getByRole('combobox', { name: 'Group' }).click();
  await page.getByRole('option', { name: name.group.name, exact: true }).click();

  // bad row → dry-run reports an error
  await page.locator('#csv').setInputFiles({ name: 'bad.csv', mimeType: 'text/csv', buffer: Buffer.from(`${header}\n${badRow}\n`) });
  const [dry1] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/app/stock/import') && r.request().method() === 'POST'),
    page.getByRole('button', { name: /Validate \(dry-run\)/ }).click(),
  ]);
  expect((await dry1.json()).errors.length, 'bad row should fail validation').toBeGreaterThan(0);
  // Import stays disabled while there are errors (label has no count when nothing is valid)
  await expect(page.getByRole('button', { name: /^Import/ })).toBeDisabled();

  // clean file → dry-run passes, then import
  await page.locator('#csv').setInputFiles({ name: 'good.csv', mimeType: 'text/csv', buffer: Buffer.from(`${header}\n${goodRow}\n`) });
  const [dry2] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/app/stock/import') && r.request().method() === 'POST'),
    page.getByRole('button', { name: /Validate \(dry-run\)/ }).click(),
  ]);
  expect((await dry2.json()).errors.length, 'clean row should validate').toBe(0);
  const [imp] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/app/stock/import') && r.request().method() === 'POST'),
    page.getByRole('button', { name: /Import \d+ rows/ }).click(),
  ]);
  const body = await imp.json();
  expect(body.dryRun).toBe(false);
  expect(body.errors.length).toBe(0); // imported for real
});
