import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { login, PW } from './helpers';

// TASK-98 schemes: Anjuman 'EMI: No' create (+ Title column), scheme list date filters (from/to/dateField),
// Members multi-status option, Dues 'Per month' view, Day Book 'Day-wise summary', Enrol 'Token paid by' CASH,
// Add Money tab (ACTIVE + WON preset) + CHEQUE needs a bank.
// Schemes cannot be deleted: every scheme this file creates is switched off (isActive=false) at the end of its test.
const rx = (s: string) => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
const inr = (n: number | string) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(n));
const istDay = (daysAgo = 0) => new Date(Date.now() - daysAgo * 864e5).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // YYYY-MM-DD
const stamp = () => String(Date.now()).slice(-7);
const mobile = () => '7' + String(Math.floor(Math.random() * 1e9)).padStart(9, '0');

type Branch = { id: number; name: string };
type Enrollment = { id: number; assignId: string; status: string; emisPaid: number; maturity: { paid: string }; payments: Array<{ id: number; emiNo: number | null; amount: string; medium: string; remark: string | null; bankAccount: { id: number } | null }> };

async function apiToken(request: APIRequestContext, user: string) {
  return (await (await request.post('/api/auth/login', { data: { login: user, password: PW } })).json()).accessToken as string;
}
const hdr = (token: string, branch: string) => ({ Authorization: `Bearer ${token}`, 'X-Branch-Id': branch });
async function apiJson(request: APIRequestContext, token: string, path: string, branch = 'all') {
  const r = await request.get(`/api${path}`, { headers: hdr(token, branch) });
  return { status: r.status(), body: await r.json().catch(() => null) };
}
async function apiPost(request: APIRequestContext, token: string, path: string, data: unknown, branch = 'all') {
  const r = await request.post(`/api${path}`, { headers: hdr(token, branch), data });
  return { status: r.status(), body: await r.json().catch(() => null) };
}
async function apiPatch(request: APIRequestContext, token: string, path: string, data: unknown, branch = 'all') {
  const r = await request.patch(`/api${path}`, { headers: hdr(token, branch), data });
  return r.status();
}
/** First branch the owner can see (GET /auth/me accessibleBranches). */
async function firstBranch(request: APIRequestContext, token: string): Promise<Branch> {
  const me = (await (await request.get('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })).json()) as { accessibleBranches: Branch[] };
  expect(me.accessibleBranches.length, 'owner must have a branch').toBeGreaterThan(0);
  return me.accessibleBranches[0]!;
}
/** CASH SAVING scheme (EMI 1000 x 3) on `branch`, started `startDaysAgo` days ago. */
async function seedScheme(request: APIRequestContext, token: string, branch: Branch, startDaysAgo: number) {
  const s = await apiPost(request, token, '/app/schemes', { type: 'CASH', name: `E2E T98 ${stamp()}`, emiAmount: 1000, tenureMonths: 3, startDate: istDay(startDaysAgo) }, String(branch.id));
  expect(s.status, JSON.stringify(s.body)).toBe(201);
  return s.body as { id: number; name: string; startDate: string; createdAt: string };
}
async function seedParty(request: APIRequestContext, token: string, name: string) {
  const p = await apiPost(request, token, '/app/parties', { type: 'CUSTOMER', name: `${name} ${stamp()}`, mobile: mobile() });
  expect(p.status, JSON.stringify(p.body)).toBe(201);
  return p.body as { id: number; name: string };
}
async function seedEnrollment(request: APIRequestContext, token: string, branch: Branch, schemeId: number, partyId: number, startDaysAgo: number, extra: Record<string, unknown> = {}) {
  const assignId = `T98${stamp()}`;
  const e = await apiPost(request, token, '/app/schemes/enrollments', { schemeId, partyId, assignId, displayName: `Member ${assignId}`, startDate: istDay(startDaysAgo), ...extra }, String(branch.id));
  expect(e.status, JSON.stringify(e.body)).toBe(201);
  return e.body as Enrollment;
}
const switchOff = (request: APIRequestContext, token: string, schemeId: number) => apiPatch(request, token, `/app/schemes/${schemeId}`, { isActive: false });

async function openAs(page: Page, path: string, branch: Branch) {
  await login(page, 'demo.owner');
  await page.waitForURL(/\/admin/);
  await page.goto(path);
  await page.getByRole('combobox', { name: 'Active branch' }).selectOption(String(branch.id));
}
async function pickParty(page: Page, comboName: string, name: string) {
  await page.getByRole('combobox', { name: comboName }).click();
  await page.getByPlaceholder('Search name / mobile').fill(name);
  await page.waitForResponse((r) => r.url().includes('/app/parties/search'));
  await page.getByRole('option', { name: rx(name) }).first().click();
}
const params = (url: string) => new URL(url).searchParams;

test('anjuman: EMI No hides EMI + tenure, posts 0/0 with a title; list shows "No EMI" and the Title column', async ({ page, request }) => {
  test.setTimeout(90_000);
  const token = await apiToken(request, 'demo.owner');
  const branch = await firstBranch(request, token);
  const s = stamp();
  const name = `Anj NoEMI ${s}`;
  const title = `T98 Title ${s}`;

  await openAs(page, '/app/schemes/anjuman', branch);
  await page.getByRole('button', { name: 'New anjuman' }).click();
  const dlg = page.getByRole('dialog', { name: 'New anjuman' });
  await dlg.locator('#sc-title').fill(title);
  await dlg.locator('#sc-name').fill(name);
  await expect(dlg.locator('#sc-emi')).toBeVisible(); // default EMI: Yes
  await dlg.getByRole('combobox', { name: 'Has EMI' }).click();
  await page.getByRole('option', { name: 'No, ad-hoc deposits' }).click();
  await expect(dlg.getByRole('combobox', { name: 'Has EMI' })).toContainText('No, ad-hoc deposits');
  await expect(dlg.locator('#sc-emi')).toHaveCount(0);
  await expect(dlg.locator('#sc-tenure')).toHaveCount(0);

  const [resp] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/app/schemes') && r.request().method() === 'POST'),
    dlg.getByRole('button', { name: 'Create', exact: true }).click(),
  ]);
  expect(resp.status(), JSON.stringify(await resp.json().catch(() => ''))).toBe(201);
  expect(resp.request().postDataJSON()).toMatchObject({ kind: 'ANJUMAN', name, title, emiAmount: 0, tenureMonths: 0 });
  const created = (await resp.json()) as { id: number; kind: string; tenureMonths: number; title: string | null };
  expect(created.kind).toBe('ANJUMAN');
  expect(created.tenureMonths).toBe(0);
  expect(created.title).toBe(title);
  await expect(dlg).toHaveCount(0);

  await page.getByRole('textbox', { name: 'Search scheme' }).fill(name);
  const row = page.getByRole('row').filter({ hasText: name });
  await expect(row).toHaveCount(1);
  await expect(row).toContainText('No EMI');
  await expect(row).toContainText(title);
  await expect(page.getByRole('columnheader', { name: 'Title', exact: true })).toBeVisible();

  expect(await switchOff(request, token, created.id)).toBe(200);
});

test('scheme list: From / To / Filter by send from, to, dateField and filter the rows', async ({ page, request }) => {
  test.setTimeout(90_000);
  const token = await apiToken(request, 'demo.owner');
  const branch = await firstBranch(request, token);
  const sd = istDay(37);
  const today = istDay(0);
  const scheme = await seedScheme(request, token, branch, 37);
  expect(scheme.startDate).toBe(sd);

  await openAs(page, '/app/schemes', branch);
  const list = (pred: (sp: URLSearchParams) => boolean) =>
    page.waitForResponse((r) => r.url().includes('/app/schemes?') && r.request().method() === 'GET' && pred(params(r.url())));
  const from = page.getByLabel('From', { exact: true });
  const to = page.getByLabel('To', { exact: true });

  // start-date range (default Filter by = Start date)
  const [r1] = await Promise.all([list((sp) => sp.get('from') === sd && !sp.has('to')), from.fill(sd)]);
  expect(params(r1.url()).get('dateField')).toBe('startDate');
  const [r2] = await Promise.all([list((sp) => sp.get('from') === sd && sp.get('to') === sd), to.fill(sd)]);
  expect(params(r2.url()).get('dateField')).toBe('startDate');
  const byStart = (await r2.json()).items as Array<{ id: number; startDate: string }>;
  expect(byStart.map((i) => i.id)).toContain(scheme.id);
  for (const it of byStart) expect(it.startDate).toBe(sd);
  await expect(page.getByRole('row').filter({ hasText: scheme.name })).toHaveCount(1);

  // Launch (created) date: the scheme was created today, so the 37-days-ago range drops it
  await page.getByRole('combobox', { name: 'Filter by' }).click();
  const [r3] = await Promise.all([
    list((sp) => sp.get('dateField') === 'createdAt' && sp.get('from') === sd && sp.get('to') === sd),
    page.getByRole('option', { name: 'Launch (created) date' }).click(),
  ]);
  expect(((await r3.json()).items as Array<{ id: number }>).map((i) => i.id)).not.toContain(scheme.id);
  await expect(page.getByRole('row').filter({ hasText: scheme.name })).toHaveCount(0);

  const [r4] = await Promise.all([
    list((sp) => sp.get('dateField') === 'createdAt' && sp.get('from') === today && sp.get('to') === today),
    (async () => { await to.fill(today); await from.fill(today); })(),
  ]);
  const byCreated = (await r4.json()).items as Array<{ id: number; createdAt: string }>;
  expect(byCreated.map((i) => i.id)).toContain(scheme.id);
  for (const it of byCreated) expect(new Date(it.createdAt).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })).toBe(today);
  await expect(page.getByRole('row').filter({ hasText: scheme.name })).toHaveCount(1);

  expect(await switchOff(request, token, scheme.id)).toBe(200);
});

test('members: multi-status options send a comma list and only those statuses come back', async ({ page }) => {
  await login(page, 'demo.owner');
  await page.waitForURL(/\/admin/);
  await page.goto('/app/schemes/members');
  const status = page.getByRole('combobox', { name: 'Status', exact: true });
  await expect(status).toHaveText('All statuses');

  for (const [label, value] of [['ACTIVE + WON', 'ACTIVE,WON'], ['WON + WITHDRAWN', 'WON,WITHDRAWN']] as const) {
    await status.click();
    const [resp] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/app/schemes/enrollments?') && params(r.url()).get('status') === value),
      page.getByRole('option', { name: label, exact: true }).click(),
    ]);
    expect(resp.status(), label).toBe(200);
    const allowed = value.split(',');
    for (const it of (await resp.json()).items as Array<{ status: string }>) expect(allowed, label).toContain(it.status);
    await expect(status).toHaveText(label);
  }
});

test('dues: Per month lists one row per unpaid due EMI (EMI # / EMI date / amount)', async ({ page, request }) => {
  test.setTimeout(90_000);
  const token = await apiToken(request, 'demo.owner');
  const branch = await firstBranch(request, token);
  const scheme = await seedScheme(request, token, branch, 50);
  const party = await seedParty(request, token, 'DuesMonth');
  // started 45 days ago, nothing paid: EMI 1 (45 days ago) + EMI 2 (~15 days ago) are due, EMI 3 is still in the future
  const enr = await seedEnrollment(request, token, branch, scheme.id, party.id, 45);

  await openAs(page, '/app/schemes/dues', branch);
  const [flat] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/app/schemes/dues?') && params(r.url()).get('q') === enr.assignId && !params(r.url()).has('perMonth')),
    page.getByRole('textbox', { name: 'Customer' }).fill(enr.assignId),
  ]);
  expect(flat.status()).toBe(200);
  const flatRow = page.getByRole('row').filter({ hasText: enr.assignId });
  await expect(flatRow).toHaveCount(1);
  await expect(flatRow).toContainText(inr(2000)); // 2 EMIs due x 1000

  const [monthsResp] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/app/schemes/dues?') && params(r.url()).get('perMonth') === 'true' && params(r.url()).get('q') === enr.assignId),
    page.getByRole('button', { name: 'Per month' }).click(),
  ]);
  expect(monthsResp.status()).toBe(200);
  const months = (await monthsResp.json()) as Array<{ enrollmentId: number; emiNo: number; emiDate: string; amount: string }>;
  const mine = months.filter((m) => m.enrollmentId === enr.id);
  expect(mine.map((m) => m.emiNo)).toEqual([1, 2]);
  expect(mine[0]!.emiDate).toBe(istDay(45));
  for (const m of mine) expect(Number(m.amount)).toBe(1000);

  await expect(page.getByRole('columnheader', { name: 'EMI #', exact: true })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'EMI date', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Flat list' })).toHaveCount(1); // the Per month toggle flipped its label
  const rows = page.getByRole('row').filter({ hasText: enr.assignId });
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0).getByRole('cell').nth(6)).toHaveText('1');
  await expect(rows.nth(1).getByRole('cell').nth(6)).toHaveText('2');
  await expect(rows.nth(0).getByRole('cell').nth(8)).toHaveText(inr(1000));
  await expect(rows.nth(0)).toContainText(party.name);

  // back to the flat list
  await page.getByRole('button', { name: 'Flat list' }).click();
  await expect(page.getByRole('columnheader', { name: 'EMI #', exact: true })).toHaveCount(0);
  await expect(page.getByRole('row').filter({ hasText: enr.assignId })).toHaveCount(1);

  expect(await switchOff(request, token, scheme.id)).toBe(200);
});

test('day book: Day-wise summary has one row per day of the range, matching the API days', async ({ page, request }) => {
  test.setTimeout(90_000);
  const token = await apiToken(request, 'demo.owner');
  const branch = await firstBranch(request, token);
  const scheme = await seedScheme(request, token, branch, 10);
  const party = await seedParty(request, token, 'DayBook');
  await seedEnrollment(request, token, branch, scheme.id, party.id, 10, { tokenAmount: 500 }); // TOKEN payment today -> SCHEME money in

  await openAs(page, '/app/schemes/day-book', branch);
  const section = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Day-wise summary' }) });
  await expect(section).toBeVisible(); // default range today..today -> one day row
  await expect(section.locator('tbody tr')).toHaveCount(1);

  const [from, to] = [istDay(2), istDay(0)];
  const [resp] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/app/schemes/day-book?') && params(r.url()).get('from') === from && params(r.url()).get('to') === to),
    page.locator('#db-from').fill(from),
  ]);
  expect(resp.status()).toBe(200);
  const db = (await resp.json()) as { opening: string; closing: string; days: Array<{ date: string; opening: string; moneyIn: string; moneyOut: string; closing: string; txnCount: number }> };
  expect(db.days.map((d) => d.date)).toEqual([istDay(2), istDay(1), istDay(0)]);
  expect(db.days[0]!.opening).toBe(db.opening);
  expect(db.days[2]!.closing).toBe(db.closing);
  for (let i = 1; i < db.days.length; i++) expect(db.days[i]!.opening).toBe(db.days[i - 1]!.closing);
  expect(db.days[2]!.txnCount, 'the token paid today counts').toBeGreaterThanOrEqual(1);

  const rows = section.locator('tbody tr');
  await expect(rows).toHaveCount(3);
  for (const [i, d] of db.days.entries()) {
    const cells = rows.nth(i).getByRole('cell');
    const shown = await page.evaluate((s) => new Date(s).toLocaleDateString('en-IN'), d.date); // same formatter as the page
    await expect(cells.nth(0)).toHaveText(String(i + 1));
    await expect(cells.nth(1)).toHaveText(shown);
    await expect(cells.nth(2)).toHaveText(inr(d.opening));
    await expect(cells.nth(3)).toHaveText(inr(d.moneyIn));
    await expect(cells.nth(4)).toHaveText(inr(d.moneyOut));
    await expect(cells.nth(5)).toHaveText(inr(d.closing));
    await expect(cells.nth(6)).toHaveText(String(d.txnCount));
  }

  expect(await switchOff(request, token, scheme.id)).toBe(200);
});

test('enrol: Token paid by CASH posts a CASH joining token without an EMI slot (CHEQUE asks for a bank)', async ({ page, request }) => {
  test.setTimeout(90_000);
  const token = await apiToken(request, 'demo.owner');
  const branch = await firstBranch(request, token);
  const scheme = await seedScheme(request, token, branch, 10);
  const party = await seedParty(request, token, 'TokenCash');
  const assign = `T98TK${stamp()}`;

  await openAs(page, '/app/schemes/enroll', branch);
  await page.getByRole('combobox', { name: 'Scheme' }).click();
  await page.getByRole('option', { name: rx(scheme.name) }).click();
  await pickParty(page, 'Party', party.name);
  await page.locator('#en-assign').fill(assign);
  await page.locator('#en-start').fill(istDay(10));

  const medium = page.getByRole('combobox', { name: 'Token medium' });
  await expect(medium).toHaveCount(0); // token 0 -> no 'Token paid by'
  await page.locator('#en-token').fill('500');
  await expect(medium).toHaveText('TOKEN (cash)');

  // a bank medium needs a bank before Enrol is allowed
  await medium.click();
  await page.getByRole('option', { name: 'CHEQUE', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Token bank account' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Enrol member' })).toBeDisabled();

  await medium.click();
  await page.getByRole('option', { name: 'CASH', exact: true }).click();
  await expect(medium).toHaveText('CASH');
  await expect(page.getByRole('combobox', { name: 'Token bank account' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Enrol member' })).toBeEnabled();

  const [resp] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/app/schemes/enrollments') && r.request().method() === 'POST'),
    page.getByRole('button', { name: 'Enrol member' }).click(),
  ]);
  expect(resp.status(), JSON.stringify(await resp.json().catch(() => ''))).toBe(201);
  const body = resp.request().postDataJSON();
  expect(body.tokenMedium).toBe('CASH');
  expect(Number(body.tokenAmount)).toBe(500);
  expect(body.tokenBankAccountId).toBeUndefined();
  expect(body.firstPayment).toBeUndefined();

  const det = (await resp.json()) as Enrollment;
  expect(det.payments.length).toBe(1);
  expect(det.payments[0]!.medium).toBe('CASH');
  expect(det.payments[0]!.emiNo, 'a joining token never takes an EMI slot').toBeNull();
  expect(det.payments[0]!.remark).toBe('Joining token');
  expect(Number(det.payments[0]!.amount)).toBe(500);
  expect(det.emisPaid).toBe(0);
  expect(Number(det.maturity.paid)).toBe(500);
  await page.waitForURL(new RegExp(`/app/schemes/members/${det.id}$`));

  expect(await switchOff(request, token, scheme.id)).toBe(200);
});

test('Add Money tab: preset ACTIVE + WON; CHEQUE needs a bank (UI disabled, API 400), then saves with one', async ({ page, request }) => {
  test.setTimeout(90_000);
  const token = await apiToken(request, 'demo.owner');
  const branch = await firstBranch(request, token);
  const scheme = await seedScheme(request, token, branch, 10);
  const party = await seedParty(request, token, 'AddMoney');
  const enr = await seedEnrollment(request, token, branch, scheme.id, party.id, 10);

  await openAs(page, '/app/schemes', branch);
  const [first] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/app/schemes/enrollments?') && params(r.url()).get('status') === 'ACTIVE,WON'),
    page.getByRole('main').getByRole('link', { name: 'Add Money', exact: true }).click(),
  ]);
  await page.waitForURL(/\/app\/schemes\/add-money$/);
  await expect(page.getByRole('heading', { name: 'Add money', exact: true })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Status', exact: true })).toHaveText('ACTIVE + WON');
  for (const it of (await first.json()).items as Array<{ status: string }>) expect(['ACTIVE', 'WON']).toContain(it.status);

  await Promise.all([
    page.waitForResponse((r) => r.url().includes('/app/schemes/enrollments?') && params(r.url()).get('q') === enr.assignId),
    page.getByPlaceholder('Search assign / name / mobile…').fill(enr.assignId),
  ]);
  const row = page.getByRole('row').filter({ hasText: enr.assignId });
  await expect(row).toHaveCount(1);
  await row.getByRole('button', { name: 'Add money' }).click();
  const dlg = page.getByRole('dialog', { name: /^Add money/ });
  const save = dlg.getByRole('button', { name: 'Add payment' });
  await expect(save).toBeEnabled(); // CASH + EMI amount prefilled
  await dlg.getByRole('combobox', { name: 'Medium' }).click();
  await page.getByRole('option', { name: 'CHEQUE', exact: true }).click();
  const bankSel = dlg.getByRole('combobox', { name: 'Bank account' });
  await expect(bankSel).toBeVisible();
  await expect(save).toBeDisabled();

  // the contract refuses CHEQUE without a bank too
  const bad = await apiPost(request, token, '/app/schemes/payments', { enrollmentId: enr.id, amount: 1000, medium: 'CHEQUE' }, String(branch.id));
  expect(bad.status, JSON.stringify(bad.body)).toBe(400);

  const banks = (await apiJson(request, token, '/app/bank-accounts', String(branch.id))).body as Array<{ id: number; branchId: number; bankName: string; accountNo: string }> | null;
  const bank = banks?.find((b) => b.branchId === branch.id) ?? banks?.[0];
  test.skip(!bank, 'no bank account in demo data to complete the CHEQUE payment');
  await bankSel.click();
  await page.getByRole('option', { name: rx(`${bank!.bankName} · ${bank!.accountNo}`) }).first().click();
  await expect(save).toBeEnabled();
  const [pay] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/app/schemes/payments') && r.request().method() === 'POST'),
    save.click(),
  ]);
  expect(pay.status(), JSON.stringify(await pay.json().catch(() => ''))).toBe(201);
  expect(pay.request().postDataJSON()).toMatchObject({ enrollmentId: enr.id, medium: 'CHEQUE', bankAccountId: bank!.id });
  const det = (await pay.json()) as Enrollment;
  const last = det.payments.at(-1)!;
  expect(last.medium).toBe('CHEQUE');
  expect(last.bankAccount?.id).toBe(bank!.id);
  expect(last.emiNo).toBe(1);
  await expect(page.getByRole('dialog', { name: 'Payment receipt' })).toBeVisible();

  expect(await switchOff(request, token, scheme.id)).toBe(200);
});
