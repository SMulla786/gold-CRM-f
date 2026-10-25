import { expect, test } from '@playwright/test';
import { expectRendered, login } from './helpers';

// ADMIN (owner) console screens render against the real admin API (GET-only, no mutation).
const SCREENS = [
  { label: 'Dashboard', path: '/admin' },
  { label: 'Branches', path: '/admin/branches' },
  { label: 'Users', path: '/admin/users' },
  { label: 'Roles & Permissions', path: '/admin/roles' },
  { label: 'Business Settings', path: '/admin/business' },
  { label: 'Subscription', path: '/admin/subscription' },
];

test.describe('admin screens (demo.owner)', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'demo.owner');
    await expect(page).toHaveURL(/\/admin/);
  });

  for (const { label, path } of SCREENS) {
    test(`nav → ${label} renders`, async ({ page }) => {
      await page.getByRole('link', { name: label, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(path.replace(/\//g, '\\/') + '$'));
      await expectRendered(page);
    });
  }

  test('no READ-ONLY banner for the active-subscription demo business', async ({ page }) => {
    // Positive read-only case needs a suspended/expired business — not forced onto the shared dev DB here.
    await expect(page.getByText(/READ-ONLY MODE/)).toHaveCount(0);
  });
});
