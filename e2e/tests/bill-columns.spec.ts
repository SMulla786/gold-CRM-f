import { test, expect } from '@playwright/test';
import { login } from './helpers';

// T-86: Sell-bill item-grid "Columns" customizer — show/hide optional columns (fixed cols stay).

test('bill columns customizer hides and restores an optional column', async ({ page }) => {
  await login(page, 'demo.owner');
  await page.waitForURL(/\/admin/);
  await page.goto('/app/billing');

  // a concrete branch so the form renders fully (not the "select a branch" gate)
  await page.getByRole('combobox', { name: 'Active branch' }).selectOption({ index: 1 });

  const rateHeader = page.getByRole('columnheader', { name: 'Rate', exact: true });
  await expect(rateHeader).toBeVisible();

  await page.getByRole('button', { name: 'Columns' }).click();
  await page.getByRole('checkbox', { name: 'Rate' }).click(); // hide
  await expect(rateHeader).toHaveCount(0);

  await page.getByRole('checkbox', { name: 'Rate' }).click(); // restore
  await expect(rateHeader).toBeVisible();
});
