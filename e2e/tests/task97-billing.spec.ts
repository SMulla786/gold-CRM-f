import { expect, test, type Page } from '@playwright/test';
import { login } from './helpers';

// TASK-97 billing + accounts (developer2/developer1): bill list filters + export, Just Bills status + export,
// Columns presets, pay-row Remark, collapsed purchase "GST details" card, TXN ledger filters.
async function owner(page: Page) {
  await login(page, 'demo.owner');
  await page.waitForURL(/\/admin/);
}
const billsReq = (page: Page, part: string) => page.waitForResponse((r) => r.url().includes('/app/bills?') && r.url().includes(part) && r.request().method() === 'GET');

test('bill list: ?kind=PURCHASE deep link, Bill type / min total filters, Export CSV', async ({ page }) => {
  await owner(page);
  const [first] = await Promise.all([billsReq(page, 'kind=PURCHASE'), page.goto('/app/billing/list?kind=PURCHASE')]);
  expect(first.status()).toBe(200);

  await page.getByRole('combobox', { name: 'Bill type filter' }).click();
  const [rough] = await Promise.all([billsReq(page, 'billType=ROUGH'), page.getByRole('option', { name: 'ROUGH', exact: true }).click()]);
  for (const b of (await rough.json()).items as Array<{ billType: string; kind: string }>) {
    expect(b.billType).toBe('ROUGH');
    expect(b.kind).toBe('PURCHASE');
  }

  const [min] = await Promise.all([billsReq(page, 'minTotal=1000'), page.getByRole('spinbutton', { name: 'Minimum total' }).fill('1000')]);
  for (const b of (await min.json()).items as Array<{ final: string }>) expect(Number(b.final)).toBeGreaterThanOrEqual(1000);

  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export CSV' }).click()]);
  expect(download.suggestedFilename()).toBe('bills-purchase-active.csv');
});

test('just bills: Deleted status filter + Export CSV', async ({ page }) => {
  await owner(page);
  await page.goto('/app/billing/just/list');
  await page.getByRole('combobox', { name: 'Status' }).click();
  const [del] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/app/just-bills?') && r.url().includes('status=DELETED')),
    page.getByRole('option', { name: 'Deleted', exact: true }).click(),
  ]);
  expect(del.status()).toBe(200);
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export CSV' }).click()]);
  expect(download.suggestedFilename()).toBe('just-bills-deleted.csv');
});

test('sell bill: Columns presets Simple / Tunch / All', async ({ page }) => {
  await owner(page);
  await page.goto('/app/billing');
  await page.getByRole('combobox', { name: 'Active branch' }).selectOption({ index: 1 });
  const tunch = page.getByRole('columnheader', { name: 'Tunch', exact: true });
  const rate = page.getByRole('columnheader', { name: 'Rate', exact: true });
  await page.getByRole('button', { name: 'Columns' }).click();
  await page.getByRole('button', { name: 'Simple', exact: true }).click();
  await expect(tunch).toHaveCount(0);
  await expect(rate).toBeVisible();
  await page.getByRole('button', { name: 'Tunch', exact: true }).click();
  await expect(tunch).toBeVisible();
  await page.getByRole('button', { name: 'All', exact: true }).click(); // reset (persists in localStorage)
  await expect(tunch).toBeVisible();
  await expect(rate).toBeVisible();
});

test('purchase bill: GST details card is collapsed (fields unmounted) and only for GST bills; pay row has Remark', async ({ page }) => {
  await owner(page);
  await page.goto('/app/billing/purchase');
  await page.getByRole('combobox', { name: 'Active branch' }).selectOption({ index: 1 });
  const toggle = page.getByRole('button', { name: 'GST details' });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#bf-sup-inv')).toHaveCount(0);
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#bf-itc')).toBeVisible();
  await expect(page.locator('#bf-sup-inv')).toBeVisible();
  await expect(page.locator('#bf-supply')).toBeVisible();
  await expect(page.getByRole('checkbox', { name: 'Reverse charge' })).toBeVisible();

  await page.getByRole('combobox', { name: 'Bill type' }).click();
  await page.getByRole('option', { name: 'ROUGH', exact: true }).click();
  await expect(toggle).toHaveCount(0);

  await page.getByRole('button', { name: '+ Cash' }).click();
  await expect(page.getByRole('textbox', { name: 'Payment remark' })).toBeVisible();
});

test('day-book ledgers: money Account (shop cash) and gold Metal type filters reach the API', async ({ page }) => {
  await owner(page);
  await page.goto('/app/daybook/money');
  await page.getByRole('combobox', { name: 'Account' }).click();
  const [cash] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/app/ledgers') && r.url().includes('bankAccountId=0')),
    page.getByRole('option', { name: 'Shop cash' }).click(),
  ]);
  expect(cash.status()).toBe(200);
  await expect(page.getByRole('button', { name: 'Export CSV' })).toBeVisible();

  await page.goto('/app/daybook/gold');
  await expect(page.getByRole('combobox', { name: 'Account' })).toHaveCount(0);
  await page.getByRole('combobox', { name: 'Metal type' }).click();
  const [kacha] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/app/ledgers') && r.url().includes('metalForm=KACHA')),
    page.getByRole('option', { name: 'KACHA', exact: true }).click(),
  ]);
  expect(kacha.status()).toBe(200);
});
