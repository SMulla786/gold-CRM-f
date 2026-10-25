import { expect, type Page } from '@playwright/test';

export const PW = 'ChangeMe@123';

export async function login(page: Page, user: string, pw = PW) {
  await page.goto('/login');
  await page.fill('#login', user);
  await page.fill('#password', pw);
  await page.getByRole('button', { name: /log in now/i }).click();
}

/** Asserts an authed Shell page actually rendered (not a redirect-to-login or 404). */
export async function expectRendered(page: Page) {
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.getByText('404 — not found')).toHaveCount(0);
  await expect(page).not.toHaveURL(/\/login/);
}
