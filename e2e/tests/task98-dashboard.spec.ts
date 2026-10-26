import { expect, test, type Page } from '@playwright/test';
import { login } from './helpers';

// TASK-98 owner dashboard: '% vs last month' Trend lines on KPI tiles (DashboardDto.lastMonth), 'Bills advance' under
// Pending, and the 'Udhar overdue' card + its Display settings toggle. Expected values come from the same
// /app/dashboard response the page rendered, so they hold whatever the demo data is.
type Dash = {
  sales: { todayTotal: string; monthTotal: string };
  purchases: { monthTotal: string };
  udhari: { collectedThisMonth: string };
  parties: { customersNewThisMonth: number };
  billsAdvance?: string;
  lastMonth?: { todayTotal: string; monthTotal: string; purchasesMonthTotal: string; collectedThisMonth: string; customersNewThisMonth: number };
  udharOverdue?: Array<{ party: { id: number; name: string }; daysOverdue: number }>;
};
const rx = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// same formatter as OwnerDashboard.tsx (whole rupees)
const inr0 = (s: string) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(s));
// same rule as DashboardExtras Trend(): null when last month is 0
const trend = (cur: string | number, prev: string | number | undefined, prefix?: string) => {
  const p = Number(prev ?? 0);
  if (!p) return null;
  const pct = Math.round(((Number(cur) - p) / Math.abs(p)) * 100);
  return `${prefix ? `${prefix} ` : ''}${pct >= 0 ? '+' : ''}${pct}% vs last month`;
};
// KPI tiles are <a> (TileLink) whose text starts with the tile label
const tile = (page: Page, label: string) => page.getByRole('main').getByRole('link').filter({ hasText: new RegExp(`^${rx(label)}`) });

async function openDashboard(page: Page): Promise<Dash> {
  await login(page, 'demo.owner');
  await page.waitForURL(/\/admin/);
  const [resp] = await Promise.all([
    page.waitForResponse((r) => /\/api\/app\/dashboard(\?|$)/.test(r.url()) && r.request().method() === 'GET' && r.status() === 200),
    page.goto('/app'),
  ]);
  await expect(page.getByRole('button', { name: 'Display settings' })).toBeVisible();
  return (await resp.json()) as Dash;
}

test('KPI tiles: "% vs last month" trend lines match lastMonth', async ({ page }) => {
  const d = await openDashboard(page);
  expect(d.lastMonth, 'dashboard sends lastMonth').toBeTruthy();
  const lm = d.lastMonth!;
  const cases: Array<[string, string | null]> = [
    ['Sales today', trend(d.sales.todayTotal, lm.todayTotal)],
    ['Sales this month', trend(d.sales.monthTotal, lm.monthTotal)],
    ['Purchases this month', trend(d.purchases.monthTotal, lm.purchasesMonthTotal)],
    ['Udhari receivable', trend(d.udhari.collectedThisMonth, lm.collectedThisMonth, 'Collected')],
    ['Customers', trend(d.parties.customersNewThisMonth, lm.customersNewThisMonth, 'New')],
  ];
  for (const [label, text] of cases) {
    const t = tile(page, label);
    await expect(t, label).toHaveCount(1);
    if (text) await expect(t, label).toContainText(text);
    else await expect(t, `${label}: no trend when last month is 0`).not.toContainText('vs last month');
  }
  const expected = cases.filter(([, x]) => x).length;
  await expect(page.getByRole('main').getByText(/% vs last month$/)).toHaveCount(expected);
  test.skip(expected === 0, 'every lastMonth figure is 0 in demo data: only the hidden case was checked');
});

test('Pending tile shows "Bills advance"', async ({ page }) => {
  const d = await openDashboard(page);
  expect(d.billsAdvance, 'dashboard sends billsAdvance').toBeDefined();
  const pending = tile(page, 'Pending (receivable)');
  await expect(pending).toHaveCount(1);
  await expect(pending).toContainText(`Bills advance ${inr0(d.billsAdvance!)}`);
});

test('Udhar overdue card: rows from the API; Display settings toggle hides it across reload; Show all restores', async ({ page }) => {
  const d = await openDashboard(page);
  const rows = d.udharOverdue ?? [];
  for (let i = 1; i < rows.length; i++) expect(rows[i]!.daysOverdue, 'most overdue first').toBeLessThanOrEqual(rows[i - 1]!.daysOverdue);
  test.skip(rows.length === 0, 'no udhar party overdue (> 30 days) in demo data: the card does not render');

  const title = page.getByRole('main').getByText('Udhar overdue', { exact: true });
  const first = page.getByRole('main').locator(`a[href="/app/udhari/statement/${rows[0]!.party.id}"]`);
  await expect(title).toBeVisible();
  await expect(first.first()).toBeVisible();
  await expect(first.first()).toHaveText(rows[0]!.party.name);
  await expect(page.getByRole('main').getByText(`${rows[0]!.daysOverdue} days overdue · since`).first()).toBeVisible();
  await expect(page.getByRole('main').getByRole('link', { name: 'View ledger', exact: true })).toHaveAttribute('href', '/app/udhari/ledger');

  // hide via Display settings (prefs are per user in localStorage; a fresh test context starts with none hidden)
  await page.getByRole('button', { name: 'Display settings' }).click();
  const dlg = page.getByRole('dialog', { name: 'Dashboard display settings' });
  const box = dlg.getByRole('checkbox', { name: 'Udhar overdue', exact: true });
  await expect(box).toBeChecked();
  await box.click();
  await expect(box).not.toBeChecked();
  await page.keyboard.press('Escape');
  await expect(title).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole('button', { name: 'Display settings' })).toBeVisible();
  await expect(page.getByRole('link', { name: /^Sales today/ })).toBeVisible(); // dashboard data loaded
  await expect(title).toHaveCount(0);

  await page.getByRole('button', { name: 'Display settings' }).click();
  await expect(dlg.getByRole('checkbox', { name: 'Udhar overdue', exact: true })).not.toBeChecked();
  await dlg.getByRole('button', { name: 'Show all' }).click();
  await expect(dlg.getByRole('checkbox', { name: 'Udhar overdue', exact: true })).toBeChecked();
  await page.keyboard.press('Escape');
  await expect(title).toBeVisible();
});
