import { expect, test } from '@playwright/test';
import { expectRendered, login } from './helpers';

// SUPER_ADMIN platform screens render against the real platform API (GET-only, no mutation).
const SCREENS = [
  { label: 'Dashboard', path: '/platform' },
  { label: 'Sign-up Requests', path: '/platform/signups' },
  { label: 'Businesses', path: '/platform/businesses' },
  { label: 'Plans', path: '/platform/plans' },
  { label: 'Payments', path: '/platform/payments' },
];

test.describe('platform screens (superadmin)', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'superadmin');
    await expect(page).toHaveURL(/\/platform/);
  });

  for (const { label, path } of SCREENS) {
    test(`nav → ${label} renders`, async ({ page }) => {
      await page.getByRole('link', { name: label, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(path.replace(/\//g, '\\/') + '$'));
      await expectRendered(page);
    });
  }
});
