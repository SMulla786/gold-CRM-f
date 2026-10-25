import { test, expect } from '@playwright/test';
import { login } from './helpers';

// T-82: ShopRateCard "Rate unit" selector on the owner dashboard (/app) is display-only, pure gram-math.

test('rate unit switch re-labels the shop-rate card', async ({ page }) => {
  await login(page, 'demo.owner');
  await page.waitForURL(/\/admin/);
  await page.goto('/app');

  const unit = page.getByRole('combobox', { name: 'Rate unit' });
  await expect(unit).toBeVisible();

  await unit.click();
  await page.getByRole('option', { name: 'per troy oz' }).click();
  await expect(page.getByText(/Today's rates \(per troy oz\)/)).toBeVisible();

  await unit.click();
  await page.getByRole('option', { name: 'per g', exact: true }).click();
  await expect(page.getByText(/Today's rates \(per g\)/)).toBeVisible();
});
