import { expect, test } from '@playwright/test';
import { login } from './helpers';

// Verifies TASK-6 login + level routing against the REAL /api/auth (demo seed users; password from E2E_PASSWORD).

test('SUPER_ADMIN lands on /platform', async ({ page }) => {
  await login(page, 'superadmin');
  await expect(page).toHaveURL(/\/platform/);
});

test('ADMIN (demo.owner) lands on /admin', async ({ page }) => {
  await login(page, 'demo.owner');
  await expect(page).toHaveURL(/\/admin/);
});

test('BRANCH_USER (demo.cashier) lands on /app', async ({ page }) => {
  await login(page, 'demo.cashier');
  await expect(page).toHaveURL(/\/app/);
});

test('wrong password shows an error and stays on /login', async ({ page }) => {
  await login(page, 'demo.owner', 'definitely-wrong');
  await expect(page.locator('.text-destructive')).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test('unauthenticated visit to /admin redirects to /login', async ({ page }) => {
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/login/);
});

test('BRANCH_USER visiting /platform is bounced to its own home /app', async ({ page }) => {
  await login(page, 'demo.cashier');
  await expect(page).toHaveURL(/\/app/);
  await page.goto('/platform');
  await expect(page).toHaveURL(/\/app/);
});
