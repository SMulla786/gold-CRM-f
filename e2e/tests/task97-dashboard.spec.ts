import { expect, test } from '@playwright/test';
import { login } from './helpers';

// TASK-97 owner dashboard: Display settings (show/hide blocks, per user, localStorage) and Recent-activity search/dates.
test.beforeEach(async ({ page }) => {
  await login(page, 'demo.owner');
  await page.waitForURL(/\/admin/);
  await page.goto('/app');
  await expect(page.getByRole('button', { name: 'Display settings' })).toBeVisible();
});

test('display settings: hiding a block persists across reload; Show all brings it back', async ({ page }) => {
  const activity = page.getByRole('textbox', { name: 'Search activity' });
  const chart = page.getByRole('combobox', { name: 'Chart range' });
  await expect(activity).toBeVisible();

  await page.getByRole('button', { name: 'Display settings' }).click();
  const dlg = page.getByRole('dialog', { name: 'Dashboard display settings' });
  await dlg.getByRole('checkbox', { name: 'Recent activity' }).click();
  await dlg.getByRole('checkbox', { name: 'Monthly earnings' }).click();
  await expect(dlg.getByRole('checkbox', { name: 'Recent activity' })).not.toBeChecked();
  await page.keyboard.press('Escape');
  await expect(activity).toHaveCount(0);
  await expect(chart).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole('button', { name: 'Display settings' })).toBeVisible();
  await expect(activity).toHaveCount(0);
  await expect(chart).toHaveCount(0);

  await page.getByRole('button', { name: 'Display settings' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Show all' }).click();
  await page.keyboard.press('Escape');
  await expect(activity).toBeVisible();
  await expect(chart).toBeVisible();
});

test('recent activity: search and date range are sent to /app/activity', async ({ page }) => {
  await expect(page.getByRole('textbox', { name: 'Search activity' })).toBeVisible();
  const [searched] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/app/activity?') && r.url().includes('q=bill')),
    page.getByRole('textbox', { name: 'Search activity' }).fill('bill'),
  ]);
  expect(searched.status()).toBe(200);

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  // dates: the filter defaults to Today; Custom range shows the From / To inputs
  await page.getByRole('combobox', { name: 'Activity date' }).click();
  await page.getByRole('option', { name: 'Custom range' }).click();
  const [dated] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/app/activity?') && r.url().includes(`from=${today}`)),
    page.getByLabel('Activity from').fill(today),
  ]);
  expect(dated.status()).toBe(200);
  const body = (await dated.json()) as { items: Array<{ createdAt?: string }> };
  for (const it of body.items) if (it.createdAt) expect(new Date(it.createdAt).getTime()).toBeGreaterThanOrEqual(new Date(`${today}T00:00:00+05:30`).getTime());
});

test('chart range: Quarter option renders', async ({ page }) => {
  await page.getByRole('combobox', { name: 'Chart range' }).click();
  await page.getByRole('option', { name: /Quarter/ }).click();
  await expect(page.getByRole('combobox', { name: 'Chart range' })).toContainText(/Quarter/);
});
