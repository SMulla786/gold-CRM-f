import { test, expect } from '@playwright/test';
import { login } from './helpers';

// T-83: UdharLedger gains Period from/to -> Old/In/Out/Final columns (+ a Balance-unit switch, T-83b),
// and PendingBills gains an Items column. Structural assertions (no data dependence).

test('udhar ledger: period reveals Old/In/Out/Final + the balance-unit switch', async ({ page }) => {
  await login(page, 'demo.owner');
  await page.waitForURL(/\/admin/);
  await page.goto('/app/udhari/ledger');

  // no period yet -> the period columns and unit switch are absent
  await expect(page.getByRole('columnheader', { name: 'Old', exact: true })).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: 'Balance unit' })).toHaveCount(0);

  await page.getByLabel('Period from').fill('2026-01-01');
  await page.getByLabel('Period to').fill(new Date().toISOString().slice(0, 10));

  for (const h of ['Old', 'In', 'Out', 'Final']) {
    await expect(page.getByRole('columnheader', { name: h, exact: true })).toBeVisible();
  }
  await expect(page.getByRole('combobox', { name: 'Balance unit' })).toBeVisible(); // default "₹ Amount"
});

test('pending bills shows the Items column', async ({ page }) => {
  await login(page, 'demo.owner');
  await page.waitForURL(/\/admin/);
  await page.goto('/app/udhari/pending');

  await expect(page.getByRole('columnheader', { name: 'Items' })).toBeVisible();
});
