import { expect, test, type Page } from '@playwright/test';

// Verifies TASK-6 login + level routing against the REAL /api/auth. Demo seed pwd = ChangeMe@123.
const PW = 'ChangeMe@123';

async function login(page: Page, user: string, pw = PW) {
  await page.goto('/login');
  await page.fill('#login', user);
  await page.fill('#password', pw);
  await page.getByRole('button', { name: /log in now/i }).click();
}

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
