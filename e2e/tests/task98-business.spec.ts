import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { login, PW } from './helpers';

// TASK-98 business 'Alternate No': owner /admin/business #p-alt-mobile (save, invalid, clear -> null),
// platform New business wizard 'Alternate No' (step-1 validation, sent on create), BusinessDetail Overview row.
type Profile = { id: number; name: string; alternateMobile: string | null };

async function apiToken(request: APIRequestContext, user: string): Promise<string> {
  return (await (await request.post('/api/auth/login', { data: { login: user, password: PW } })).json()).accessToken as string;
}
const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
async function profile(request: APIRequestContext, token: string): Promise<Profile> {
  const r = await request.get('/api/admin/business', { headers: bearer(token) });
  expect(r.status()).toBe(200);
  return (await r.json()) as Profile;
}
/** The value <span> next to an Overview label on /platform/businesses/:id (Row = <div><span>k</span><span>v</span></div>). */
const overviewRow = (page: Page, label: string) => page.getByText(label, { exact: true }).locator('xpath=..');
const altNo = () => `98${String(Date.now()).slice(-8)}`;

test('owner business settings: Alternate No saves, re-shows after reload, shows on platform detail, clears to null', async ({ page, browser, request }) => {
  test.setTimeout(90_000);
  const owner = await apiToken(request, 'demo.owner');
  const orig = await profile(request, owner);
  const alt = altNo();
  try {
    await login(page, 'demo.owner');
    await page.waitForURL(/\/admin/);
    await page.goto('/admin/business');
    const input = page.locator('#p-alt-mobile');
    await expect(input).toHaveValue(orig.alternateMobile ?? '');
    const save = page.getByRole('button', { name: 'Save changes' });

    // invalid -> inline zod message, no PATCH
    let patched = false;
    page.on('request', (r) => { if (r.url().endsWith('/api/admin/business') && r.method() === 'PATCH') patched = true; });
    await input.fill('12345');
    await save.click();
    await expect(page.getByText('10-digit mobile number')).toBeVisible();
    expect(patched, 'invalid Alternate No must not be sent').toBe(false);

    // valid -> PATCH carries it, API + reload show it
    await input.fill(alt);
    const [res] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith('/api/admin/business') && r.request().method() === 'PATCH'),
      save.click(),
    ]);
    expect(res.status(), await res.text()).toBe(200);
    expect(res.request().postDataJSON().alternateMobile).toBe(alt);
    expect((await profile(request, owner)).alternateMobile).toBe(alt);
    await page.reload();
    await expect(page.locator('#p-alt-mobile')).toHaveValue(alt);

    // platform BusinessDetail Overview row shows it
    const sctx = await browser.newContext();
    const sp = await sctx.newPage();
    await login(sp, 'superadmin');
    await expect(sp).toHaveURL(/\/platform/);
    await sp.goto(`/platform/businesses/${orig.id}`);
    await expect(sp.getByRole('heading', { name: orig.name, exact: true })).toBeVisible();
    await expect(overviewRow(sp, 'Alternate No')).toContainText(alt);

    // clear -> blank is sent as null and stored as null; platform row falls back to '—'
    await page.locator('#p-alt-mobile').fill('');
    const [cleared] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith('/api/admin/business') && r.request().method() === 'PATCH'),
      page.getByRole('button', { name: 'Save changes' }).click(),
    ]);
    expect(cleared.status(), await cleared.text()).toBe(200);
    expect(cleared.request().postDataJSON().alternateMobile).toBeNull();
    expect((await profile(request, owner)).alternateMobile).toBeNull();
    await page.reload();
    await expect(page.locator('#p-alt-mobile')).toHaveValue('');
    await sp.reload();
    await expect(overviewRow(sp, 'Alternate No')).toContainText('—');
    await sctx.close();
  } finally {
    // restore the original value (null was already restored by the clear step)
    if (orig.alternateMobile) await request.patch('/api/admin/business', { headers: bearer(owner), data: { alternateMobile: orig.alternateMobile } });
  }
});

test('platform New business wizard: Alternate No validated on step 1, sent on create, shown on BusinessDetail', async ({ page, request }) => {
  test.setTimeout(90_000);
  const sa = await apiToken(request, 'superadmin');
  const plans = (await (await request.get('/api/platform/plans', { headers: bearer(sa) })).json()) as Array<{ id: number; name: string; isActive: boolean }>;
  const plan = plans.find((p) => p.isActive) ?? plans[0];
  test.skip(!plan, 'no plans on the platform');
  const stamp = String(Date.now()).slice(-8);
  const alt = altNo();
  const name = `E2E T98 Biz ${stamp}`;

  await login(page, 'superadmin');
  await expect(page).toHaveURL(/\/platform/);
  await page.goto('/platform/businesses');
  await page.getByRole('button', { name: 'New business' }).click();
  const dlg = page.getByRole('dialog');
  await expect(dlg).toContainText('New business · step 1 of 3');
  await dlg.getByLabel('Business name', { exact: true }).fill(name);
  await dlg.getByLabel('Owner name', { exact: true }).fill(`T98 Owner ${stamp}`);
  await dlg.getByLabel('Mobile', { exact: true }).fill(`97${stamp}`);

  // invalid Alternate No blocks Next
  await dlg.getByLabel('Alternate No', { exact: true }).fill('123');
  await dlg.getByRole('button', { name: 'Next' }).click();
  await expect(dlg.getByText('10-digit mobile number')).toBeVisible();
  await expect(dlg).toContainText('step 1 of 3');

  await dlg.getByLabel('Alternate No', { exact: true }).fill(alt);
  await dlg.getByRole('button', { name: 'Next' }).click();
  await expect(dlg).toContainText('step 2 of 3');
  await dlg.getByLabel('Owner login name', { exact: true }).fill(`T98 Owner ${stamp}`);
  await dlg.getByLabel('Username', { exact: true }).fill(`t98owner${stamp}`);
  await dlg.getByLabel('Password', { exact: true }).fill('E2eOwner@123');
  await dlg.getByRole('button', { name: 'Next' }).click();
  await expect(dlg).toContainText('step 3 of 3');
  await dlg.getByRole('combobox', { name: 'Plan' }).click();
  await page.getByRole('option', { name: new RegExp(`^${plan!.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} — `) }).click();

  const [res] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/api/platform/businesses') && r.request().method() === 'POST'),
    dlg.getByRole('button', { name: 'Create business' }).click(),
  ]);
  expect(res.status(), await res.text()).toBe(201);
  expect(res.request().postDataJSON().alternateMobile).toBe(alt);
  const biz = (await res.json()) as { id: number; alternateMobile: string | null };
  expect(biz.alternateMobile).toBe(alt);

  await page.waitForURL(new RegExp(`/platform/businesses/${biz.id}$`));
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  await expect(overviewRow(page, 'Alternate No')).toContainText(alt);
  const detail = (await (await request.get(`/api/platform/businesses/${biz.id}`, { headers: bearer(sa) })).json()) as { alternateMobile: string | null };
  expect(detail.alternateMobile).toBe(alt);
});
