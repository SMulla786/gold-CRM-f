import { test, expect } from '@playwright/test';
import { login } from './helpers';

// BUG-17: new-txn date inputs must default to the IST business day, not the UTC day.
// Pin the clock to 2026-10-26 00:20 IST (= 2026-10-25T18:50:00Z): UTC day = 25th, IST day = 26th.
// FAILS before dev2's `new Date().toISOString().slice(0,10)` -> businessDayISO() sweep; passes after.
const IST_DAY = '2026-10-26';

test('Sell Bill / New Udhar / New Girvi date inputs default to the IST day, not UTC (BUG-17)', async ({ page }) => {
  // Override Date (not timers, so React/Playwright still run) so the app sees 2026-10-25T18:50:00Z = 00:20 IST on the 26th.
  await page.addInitScript(() => {
    const FIXED = Date.parse('2026-10-25T18:50:00Z');
    const RealDate = Date;
    const Fake: any = function (...args: unknown[]) {
      return args.length ? new (RealDate as any)(...args) : new (RealDate as any)(FIXED);
    };
    Fake.now = () => FIXED;
    Fake.parse = RealDate.parse;
    Fake.UTC = RealDate.UTC;
    Fake.prototype = RealDate.prototype;
    (globalThis as any).Date = Fake;
  });
  await login(page, 'demo.owner');
  await page.waitForURL(/\/admin/);

  // Guard the guard: prove the clock is really faked to the 25th (UTC). Without this a real-afternoon run would
  // pass trivially (UTC day == IST day), hiding a UTC-today regression. With it, a '2026-10-26' default can ONLY
  // come from IST logic (businessDayISO); a revert to new Date().toISOString().slice(0,10) would yield '2026-10-25'.
  expect(await page.evaluate(() => new Date().toISOString())).toBe('2026-10-25T18:50:00.000Z');

  await page.goto('/app/billing');
  await page.getByRole('combobox', { name: 'Active branch' }).selectOption({ index: 1 });
  await expect(page.locator('#bf-date')).toHaveValue(IST_DAY);

  await page.goto('/app/udhari');
  await page.getByRole('combobox', { name: 'Active branch' }).selectOption({ index: 1 });
  await expect(page.locator('#u-date')).toHaveValue(IST_DAY);

  await page.goto('/app/girvi/new');
  await page.getByRole('combobox', { name: 'Active branch' }).selectOption({ index: 1 });
  await expect(page.locator('#ng-date')).toHaveValue(IST_DAY);
});
