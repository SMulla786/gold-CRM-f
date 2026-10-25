import { test, expect } from '@playwright/test';
import { login } from './helpers';

// T-88: admin consolidated overview — /admin dashboard (totals tiles + by-branch table) and the
// /admin/branches "Branch overview" toggle, both backed by GET /api/admin/overview.

test('admin dashboard renders the per-branch overview from /admin/overview', async ({ page }) => {
  await login(page, 'demo.owner');
  await page.waitForURL(/\/admin/);

  const [resp] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/admin/overview') && r.status() === 200),
    page.reload(),
  ]);
  expect(resp.ok()).toBeTruthy();

  await expect(page.getByRole('heading', { name: 'By branch' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Gold fine' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Silver fine' })).toBeVisible();
  // header row + at least one branch row
  expect(await page.getByRole('row').count()).toBeGreaterThan(1);
});

test('branches page exposes a Branch overview toggle', async ({ page }) => {
  await login(page, 'demo.owner');
  await page.waitForURL(/\/admin/);
  await page.goto('/admin/branches');

  await page.getByRole('button', { name: 'Branch overview' }).click();
  await expect(page.getByRole('columnheader', { name: 'Gold fine' })).toBeVisible();

  await page.getByRole('button', { name: 'Hide overview' }).click();
  await expect(page.getByRole('columnheader', { name: 'Gold fine' })).toHaveCount(0);
});
