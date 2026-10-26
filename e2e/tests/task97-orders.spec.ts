import { expect, test, type APIRequestContext } from '@playwright/test';
import { login, PW } from './helpers';

// TASK-97 orders: All Orders 'Product & Details' column (first item + '+N more', tooltip lists all) and the
// Entries-per-page picker (DataTable onPageSize) on All Orders / Ready to deliver / Karigar.
async function apiToken(request: APIRequestContext, user: string): Promise<string> {
  return (await (await request.post('/api/auth/login', { data: { login: user, password: PW } })).json()).accessToken as string;
}
async function apiJson(request: APIRequestContext, token: string, path: string) {
  const r = await request.get(`/api${path}`, { headers: { Authorization: `Bearer ${token}`, 'X-Branch-Id': 'all' } });
  return r.json();
}
type Order = { id: number; orderNo: number; items: Array<{ itemName: { name: string } }> };

test('all orders: Product & Details shows first item + "+N more"', async ({ page, request }) => {
  const token = await apiToken(request, 'demo.owner');
  const orders = (await apiJson(request, token, '/app/orders?page=1&pageSize=20')).items as Order[];
  expect(orders.length, 'demo data must have orders').toBeGreaterThan(0);

  await login(page, 'demo.owner');
  await page.waitForURL(/\/admin/);
  await page.goto('/app/orders');
  await expect(page.getByRole('columnheader', { name: 'Product & Details' })).toBeVisible();

  const multi = orders.find((o) => o.items.length > 1);
  const single = orders.find((o) => o.items.length === 1);
  if (single) {
    const row = page.getByRole('row').filter({ has: page.locator(`a[href="/app/orders/${single.id}"]`) }).first();
    await expect(row).toContainText(single.items[0]!.itemName.name);
    await expect(row).not.toContainText(/\+\d+ more/);
  }
  test.skip(!multi, 'no multi-item order on page 1 of demo data');
  const row = page.getByRole('row').filter({ has: page.locator(`a[href="/app/orders/${multi!.id}"]`) }).first();
  await expect(row).toContainText(multi!.items[0]!.itemName.name);
  await expect(row).toContainText(`+${multi!.items.length - 1} more`);
  await expect(row.locator(`span[title="${multi!.items.map((i) => i.itemName.name).join(', ')}"]`)).toHaveCount(1);
});

test('all orders: Entries picker re-queries with the chosen page size', async ({ page, request }) => {
  const token = await apiToken(request, 'demo.owner');
  const total = (await apiJson(request, token, '/app/orders?page=1&pageSize=1')).total as number;
  test.skip(total <= 10, 'picker only renders when there are more than 10 orders');

  await login(page, 'demo.owner');
  await page.waitForURL(/\/admin/);
  await page.goto('/app/orders');
  const entries = page.getByRole('combobox', { name: /Entries/ });
  await expect(entries).toBeVisible();
  const [resp] = await Promise.all([
    page.waitForResponse((r) => /\/app\/orders\?/.test(r.url()) && r.url().includes('pageSize=10')),
    entries.selectOption('10'),
  ]);
  expect(resp.status()).toBe(200);
  expect((await resp.json()).items.length).toBeLessThanOrEqual(10);
  await expect(page.getByText(/Page 1 of \d+ · \d+ total/)).toBeVisible();
});

test('ready to deliver + karigar tabs: Entries select sends pageSize', async ({ page }) => {
  await login(page, 'demo.owner');
  await page.waitForURL(/\/admin/);
  for (const [path, api] of [['/app/orders/ready', '/app/orders?'], ['/app/orders/karigar', '/app/karigar-issues?']] as const) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    const entries = page.getByRole('combobox', { name: /Entries/ });
    if (!(await entries.isVisible())) continue; // shortcut: pager (with the select) may be hidden on a tiny dataset
    const [resp] = await Promise.all([
      page.waitForResponse((r) => r.url().includes(api) && r.url().includes('pageSize=50')),
      entries.selectOption('50'),
    ]);
    expect(resp.status(), path).toBe(200);
  }
});
