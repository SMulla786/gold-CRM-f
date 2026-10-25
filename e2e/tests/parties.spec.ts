import { expect, test } from '@playwright/test';
import { login } from './helpers';

const rx = (s: string) => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

// Creates a customer and a family sub-profile through the real New-party dialog,
// then checks the party picker (PartyCombobox) surfaces both.
test('new customer + family sub-profile → the party picker finds both', async ({ page }) => {
  test.setTimeout(60_000);
  const stamp = Date.now();
  const parentName = `E2E Parent ${stamp}`;
  const subName = `E2E Sub ${stamp}`;
  const mobile = (p: string) => p + String(stamp).slice(-9);

  await login(page, 'demo.owner');
  await page.waitForURL(/\/admin/);
  await page.goto('/app/settings/parties');

  // 1) parent customer (type defaults to CUSTOMER) — exact, the top bar also has "+ New Party"
  await page.getByRole('button', { name: 'New party', exact: true }).click();
  await page.getByLabel('Mobile').fill(mobile('9'));
  await page.getByLabel('Full name').fill(parentName);
  await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/app/parties') && r.request().method() === 'POST' && r.status() === 201),
    page.getByRole('button', { name: 'Create party' }).click(),
  ]);

  // 2) family sub-profile under that parent
  await page.getByRole('button', { name: 'New party', exact: true }).click();
  await page.getByLabel('Mobile').fill(mobile('8'));
  await page.getByLabel('Full name').fill(subName);
  await page.getByRole('checkbox').check(); // "Add as family sub-profile"
  await page.getByRole('combobox', { name: 'Party', exact: true }).click(); // not the "Party type" select
  await page.getByPlaceholder('Search parent customer…').fill(parentName);
  await page.waitForResponse((r) => r.url().includes('/app/parties/search'));
  await page.getByRole('option', { name: rx(parentName) }).first().click();
  await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/app/parties') && r.request().method() === 'POST' && r.status() === 201),
    page.getByRole('button', { name: 'Create party' }).click(),
  ]);

  // 3) the picker finds both (search by the shared stamp)
  await page.goto('/app/udhari');
  await page.getByRole('combobox', { name: 'Party' }).click();
  await page.getByPlaceholder('Search name / mobile').fill(String(stamp));
  await page.waitForResponse((r) => r.url().includes('/app/parties/search'));
  await expect(page.getByRole('option', { name: rx(parentName) })).toBeVisible();
  await expect(page.getByRole('option', { name: rx(subName) })).toBeVisible();
});
