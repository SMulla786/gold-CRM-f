import { expect, test, type Page } from '@playwright/test';
import { expectRendered, login } from './helpers';

// TASK-97 developer1 buckets (trade / repair / inventory / GST): new tabs + filters reach the API, numeric search no longer 500s.
async function owner(page: Page) {
  await login(page, 'demo.owner');
  await page.waitForURL(/\/admin/);
}
const apiResp = (page: Page, path: string, part: string) => page.waitForResponse((r) => r.url().includes(`${path}?`) && r.url().includes(part) && r.request().method() === 'GET');

test('trade: 10-digit mobile search on exchange / buy-sell / bhav lists returns 200 (Int4 bound)', async ({ page }) => {
  await owner(page);
  for (const [path, api] of [['/app/exchange', '/app/exchange'], ['/app/buy_sell', '/app/buy-sell'], ['/app/buy_sell/bhav', '/app/bhav-booking']] as const) {
    await page.goto(path);
    await expectRendered(page);
    const search = page.getByRole('main').getByRole('textbox').first();
    const [resp] = await Promise.all([apiResp(page, api, 'q=9876543210'), search.fill('9876543210')]);
    expect(resp.status(), path).toBe(200);
  }
});

test('trade: Old bookings tab filters by Delivered / Cancelled', async ({ page }) => {
  await owner(page);
  await page.goto('/app/buy_sell/bhav-old');
  await expect(page.getByRole('heading', { name: 'Old bookings' })).toBeVisible();
  for (const [label, status] of [['Delivered', 'DELIVERED'], ['Cancelled', 'CANCELLED']] as const) {
    await page.getByRole('combobox', { name: 'Status' }).click();
    const [resp] = await Promise.all([apiResp(page, '/app/bhav-booking', `status=${status}`), page.getByRole('option', { name: label, exact: true }).click()]);
    expect(resp.status()).toBe(200);
    for (const b of (await resp.json()).items as Array<{ status: string }>) expect(b.status).toBe(status);
  }
});

test('repair: Ledger tab reads ?status= from the URL, searches, exports', async ({ page }) => {
  await owner(page);
  const [resp] = await Promise.all([apiResp(page, '/app/repairs', 'status=DELIVERED'), page.goto('/app/repair/ledger?status=DELIVERED')]);
  expect(resp.status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'Repair ledger' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Board' })).toBeVisible();
  const [q] = await Promise.all([apiResp(page, '/app/repairs', 'q=9876543210'), page.getByRole('textbox', { name: 'Search repairs' }).fill('9876543210')]);
  expect(q.status()).toBe(200);
  await expect(page.getByRole('button', { name: 'Export CSV' })).toBeVisible();
});

test('inventory: stock list Table | Gallery toggle and All Stock Summary tab render', async ({ page }) => {
  await owner(page);
  await page.goto('/app/inventory/stock');
  const layout = page.getByRole('group', { name: 'Layout' });
  await expect(layout.getByRole('button', { name: 'Table' })).toHaveAttribute('aria-pressed', 'true');
  await layout.getByRole('button', { name: 'Gallery' }).click();
  await expect(layout.getByRole('button', { name: 'Gallery' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('columnheader', { name: 'HUID' })).toHaveCount(0); // table swapped for cards
  await layout.getByRole('button', { name: 'Table' }).click();
  await expect(page.getByRole('columnheader', { name: 'HUID' })).toBeVisible();

  await page.goto('/app/inventory/summary');
  await expectRendered(page);
});

test('GST: bare /app/billing/gst is the dashboard; register report shows the GST % column', async ({ page }) => {
  await owner(page);
  await page.goto('/app/billing/gst');
  await expectRendered(page);
  await expect(page.getByRole('link', { name: 'ITC summary' })).toBeVisible();
  await page.goto('/app/billing/gst?report=register');
  await expect(page.getByRole('columnheader', { name: 'GST %' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'GSTIN' })).toBeVisible();
});
