import { expect, type Page } from '@playwright/test';

// Credentials come only from the environment (see e2e/README.md): the old hardcoded demo password is public.
const envPw = process.env.E2E_PASSWORD;
if (!envPw) throw new Error('E2E_PASSWORD is not set: export it, or add it to frontend/.env (see e2e/README.md). There is no default.');
export const PW: string = envPw;
/** superadmin may have its own password (E2E_SA_PASSWORD); otherwise the shared demo one. */
export const pwFor = (user: string): string => (user === 'superadmin' && process.env.E2E_SA_PASSWORD) || PW;

export async function login(page: Page, user: string, pw = pwFor(user)) {
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
