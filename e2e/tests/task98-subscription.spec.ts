import { expect, test, type APIRequestContext } from '@playwright/test';
import { login, pwFor } from './helpers';

// TASK-98 subscription (owner /admin/subscription): 'Available plans' cards, Renew / Choose plan prefill #pay-amount,
// UPI UTR must be 12 digits (inline error + Submit disabled), history Plan / Plan type columns, Receipt on a CONFIRMED
// payment; platform /platform/payments 'Plan' column.
type AvailablePlan = { id: number; name: string; durationDays: number; price: string; maxBranches: number; maxUsers: number };
type SubView = { planId: number; planName: string; availablePlans: AvailablePlan[]; payments: Array<{ id: number; status: string }> };

async function apiToken(request: APIRequestContext, user: string): Promise<string> {
  return (await (await request.post('/api/auth/login', { data: { login: user, password: pwFor(user) } })).json()).accessToken as string;
}
const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
async function subView(request: APIRequestContext, token: string): Promise<SubView> {
  const r = await request.get('/api/admin/subscription', { headers: bearer(token) });
  expect(r.status()).toBe(200);
  return (await r.json()) as SubView;
}
const inr = (n: number | string) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(n));
/** Same rule as SubscriptionView durationLabel. */
const durationLabel = (days: number): string => {
  const months = Math.round(days / 30.4);
  if (months >= 1 && Math.abs(months * 30.4 - days) <= 3) return `${months} ${months === 1 ? 'month' : 'months'}`;
  return `${days} ${days === 1 ? 'day' : 'days'}`;
};

test('available plans: one card per active plan; Renew / Choose plan prefill the amount; Clear plan resets', async ({ page, request }) => {
  const token = await apiToken(request, 'demo.owner');
  const view = await subView(request, token);
  test.skip(view.availablePlans.length === 0, 'no active plans on the platform (section is not rendered)');

  await login(page, 'demo.owner');
  await page.waitForURL(/\/admin/);
  await page.goto('/admin/subscription');
  const plans = page.getByRole('region', { name: 'Available plans' });
  await expect(plans.getByRole('heading', { name: 'Available plans' })).toBeVisible();
  await expect(plans.getByRole('button', { name: /^(Renew|Choose plan) / })).toHaveCount(view.availablePlans.length);
  for (const p of view.availablePlans) {
    await expect(plans).toContainText(p.name);
    await expect(plans).toContainText(`${inr(p.price)} / ${durationLabel(p.durationDays)}`);
  }

  const current = view.availablePlans.find((p) => p.id === view.planId);
  const other = view.availablePlans.find((p) => p.id !== view.planId);
  const pay = page.locator('#subscription-pay');
  const amount = page.locator('#pay-amount');
  await expect(amount).toHaveValue('');

  if (current) {
    await expect(plans.getByText('Current plan', { exact: true })).toBeVisible();
    await plans.getByRole('button', { name: `Renew ${current.name}`, exact: true }).click();
    await expect(amount).toHaveValue(String(Number(current.price)));
    await expect(amount).toBeFocused();
    await expect(pay).toContainText(`Paying for ${current.name} · ${durationLabel(current.durationDays)} · ${inr(current.price)}`);
  }
  if (other) {
    await plans.getByRole('button', { name: `Choose plan ${other.name}`, exact: true }).click();
    await expect(amount).toHaveValue(String(Number(other.price)));
    await expect(pay).toContainText(`Paying for ${other.name}`);
  }
  await pay.getByRole('button', { name: 'Clear plan' }).click();
  await expect(pay).not.toContainText('Paying for');
  await expect(amount).toHaveValue('');
});

test('submit payment: UPI with an 11-digit UTR shows the inline error and keeps Submit disabled; 12 digits clears it', async ({ page }) => {
  await login(page, 'demo.owner');
  await page.waitForURL(/\/admin/);
  await page.goto('/admin/subscription');
  const submit = page.getByRole('button', { name: 'Submit payment proof' });
  await page.locator('#pay-amount').fill('100');
  await expect(page.locator('#pay-method')).toContainText('UPI'); // default method

  await page.locator('#pay-utr').fill('12345678901');
  await expect(page.locator('#pay-utr-error')).toHaveText('UPI UTR must be exactly 12 digits');
  await expect(page.locator('#pay-utr')).toHaveAttribute('aria-invalid', 'true');
  await expect(submit).toBeDisabled();

  await page.locator('#pay-utr').fill('123456789012');
  await expect(page.locator('#pay-utr-error')).toHaveCount(0);
  await expect(submit).toBeEnabled();
  // not submitted: leaves no payment behind
});

test('payment with a plan: platform Payments Plan column; after confirm the owner history shows Plan / Plan type + Receipt', async ({ page, browser, request }) => {
  test.setTimeout(90_000);
  const owner = await apiToken(request, 'demo.owner');
  const view = await subView(request, owner);
  const plan = view.availablePlans.find((p) => p.id === view.planId) ?? view.availablePlans[0];
  test.skip(!plan, 'no active plan to pay for');
  const utr = String(Date.now()).slice(-12);
  const created = await request.post('/api/admin/subscription/payments', { headers: bearer(owner), data: { amount: 1, method: 'UPI', utr, planId: plan!.id } });
  expect(created.status(), await created.text()).toBe(201);
  const paymentId = ((await created.json()) as { id: number }).id;

  // platform (own browser context): PENDING row shows the requested plan in the 'Plan' column (2nd, after Business)
  const sctx = await browser.newContext();
  const sp = await sctx.newPage();
  await login(sp, 'superadmin');
  await expect(sp).toHaveURL(/\/platform/);
  await sp.goto('/platform/payments');
  await expect(sp.getByRole('columnheader', { name: 'Plan', exact: true })).toBeVisible();
  const pRow = sp.getByRole('row').filter({ hasText: utr });
  await expect(pRow).toHaveCount(1);
  await expect(pRow.getByRole('cell').nth(1)).toHaveText(plan!.name);
  await expect(pRow).toContainText('PENDING');

  // confirm via the platform API (owner-side receipt is only offered for CONFIRMED)
  const sa = await apiToken(request, 'superadmin');
  const review = await request.patch(`/api/platform/payments/${paymentId}`, { headers: bearer(sa), data: { status: 'CONFIRMED' } });
  expect(review.status(), await review.text()).toBe(200);
  expect(((await review.json()) as { planName: string | null }).planName).toBe(plan!.name);
  await sp.reload();
  await expect(pRow).toContainText('CONFIRMED');
  await sctx.close();

  // owner history: Plan + Plan type columns, Receipt button on the confirmed row
  await login(page, 'demo.owner');
  await page.waitForURL(/\/admin/);
  await page.goto('/admin/subscription');
  await expect(page.getByRole('columnheader', { name: 'Plan', exact: true })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Plan type', exact: true })).toBeVisible();
  const row = page.getByRole('row').filter({ hasText: utr });
  await expect(row).toHaveCount(1);
  await expect(row.getByRole('cell').nth(1)).toHaveText(plan!.name);
  await expect(row.getByRole('cell').nth(2)).toHaveText(durationLabel(plan!.durationDays));
  await expect(row).toContainText('CONFIRMED');
  await row.getByRole('button', { name: `Download receipt ${paymentId}`, exact: true }).click();

  const dlg = page.getByRole('dialog', { name: 'Subscription receipt' });
  await expect(dlg).toBeVisible();
  await expect(dlg).toContainText('SUBSCRIPTION PAYMENT RECEIPT');
  await expect(dlg).toContainText(`Receipt no${paymentId}`);
  await expect(dlg).toContainText(`Plan${plan!.name}`);
  await expect(dlg).toContainText(`Plan type${durationLabel(plan!.durationDays)}`);
  await expect(dlg).toContainText(`UTR${utr}`);
  await expect(dlg).toContainText(inr(1));
  await expect(dlg.getByRole('button', { name: 'PDF' })).toBeVisible();
  await expect(dlg.getByRole('button', { name: 'Print' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dlg).toHaveCount(0);

  // a PENDING / REJECTED row has no Receipt button
  const nonConfirmed = view.payments.find((p) => p.status !== 'CONFIRMED');
  if (nonConfirmed) await expect(page.getByRole('button', { name: `Download receipt ${nonConfirmed.id}`, exact: true })).toHaveCount(0);
});
