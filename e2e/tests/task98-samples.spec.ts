import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test';
import { login, PW } from './helpers';

// TASK-98 Samples / Tounch register (Inventory > Samples, /app/samples*): New sample with auto fine = gross x tounch / 100,
// Issue to karigar -> Return -> Melt (terminal: every further action is a 409), History sheet movements,
// and the SamplePicker inside the karigar IssueDialog ('Select samples') on Order Detail.
const rx = (s: string) => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
async function apiToken(request: APIRequestContext, user: string): Promise<string> {
  return (await (await request.post('/api/auth/login', { data: { login: user, password: PW } })).json()).accessToken as string;
}
const hdr = (token: string, branch = 'all') => ({ Authorization: `Bearer ${token}`, 'X-Branch-Id': branch });
async function apiJson(request: APIRequestContext, token: string, path: string, branch = 'all') {
  const r = await request.get(`/api${path}`, { headers: hdr(token, branch) });
  return { status: r.status(), body: await r.json().catch(() => null) };
}
async function apiSend(request: APIRequestContext, token: string, method: 'POST' | 'PATCH', path: string, data: unknown, branch = 'all') {
  const r = await request.fetch(`/api${path}`, { method, headers: hdr(token, branch), data });
  return { status: r.status(), body: await r.json().catch(() => null) };
}
let seq = 0;
async function party(request: APIRequestContext, token: string, type: 'CUSTOMER' | 'KARIGAR', tag: string) {
  const stamp = `${Date.now()}${seq++}`;
  const r = await apiSend(request, token, 'POST', '/app/parties', { type, name: `${tag} ${stamp}`, mobile: '8' + stamp.slice(-9) });
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  return r.body as { id: number; name: string };
}
type Branch = { id: number; name: string };
type Ref = { id: number; name: string } | null;
type Sample = {
  id: number; sampleNo: number; metal: string; grossWt: string; tounchPercent: string; fine: string; status: 'IN_HAND' | 'ISSUED' | 'RETURNED' | 'MELTED';
  note: string | null; party: Ref; karigar: Ref; branch: Branch;
  movements?: Array<{ action: string; karigar: Ref; party: Ref; note: string | null; user: string | null }>;
};

/** Owner token and the first accessible branch (samples are registered at one branch: X-Branch-Id must be concrete). */
async function setup(request: APIRequestContext) {
  const token = await apiToken(request, 'demo.owner');
  const me = (await (await request.get('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })).json()) as { accessibleBranches: Branch[] };
  return { token, branch: me.accessibleBranches[0]! };
}
async function apiSample(request: APIRequestContext, token: string, branchId: number, body: Record<string, unknown>): Promise<Sample> {
  const r = await apiSend(request, token, 'POST', '/app/samples', body, String(branchId));
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  return r.body as Sample;
}
const getSample = async (request: APIRequestContext, token: string, id: number) => (await apiJson(request, token, `/app/samples/${id}`)).body as Sample;
async function ownerOn(page: Page, path: string, branchId: number) {
  await login(page, 'demo.owner');
  await page.waitForURL(/\/admin/);
  await page.goto(path);
  await page.getByRole('combobox', { name: 'Active branch' }).selectOption(String(branchId));
}
/** PartyCombobox (cmdk popover): open the trigger, type, wait for the search, pick the matching option. */
async function pickParty(page: Page, scope: Locator, comboName: string, placeholder: string, name: string) {
  await scope.getByRole('combobox', { name: comboName }).click();
  await page.getByPlaceholder(placeholder).fill(name);
  await page.waitForResponse((r) => r.url().includes('/app/parties/search'));
  await page.getByRole('option', { name: rx(name) }).first().click();
}

test('samples: new (auto fine) -> issue to karigar -> return -> melt (terminal, 409 after) -> history movements', async ({ page, request }) => {
  test.setTimeout(120_000);
  const { token, branch } = await setup(request);
  const karigar = await party(request, token, 'KARIGAR', 'T98SmpKari');
  const stamp = Date.now();

  await ownerOn(page, '/app/inventory/samples', branch.id);
  await expect(page.getByRole('heading', { name: 'Samples', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'New sample', exact: true }).click();
  const form = page.getByRole('dialog', { name: 'New sample' });
  await expect(form).toBeVisible();

  // fine follows gross x tounch / 100 (3 dp) until typed over
  await page.locator('#sm-gross').fill('12.345');
  await page.locator('#sm-tounch').fill('91.6');
  await expect(page.locator('#sm-fine')).toHaveValue('11.308'); // 12.345 x 91.6 / 100 = 11.30802
  await expect(form.getByText('Auto = gross × tounch / 100')).toBeVisible();
  await page.locator('#sm-fine').fill('11');
  await expect(form.getByRole('button', { name: 'Use auto (11.308 g)' })).toBeVisible();
  await form.getByRole('button', { name: 'Use auto (11.308 g)' }).click();
  await expect(page.locator('#sm-fine')).toHaveValue('11.308');
  await page.locator('#sm-tounch').fill('75');
  await expect(page.locator('#sm-fine')).toHaveValue('9.259'); // 12.345 x 75 / 100 = 9.25875 -> 9.259
  await page.locator('#sm-note').fill(`T98 smp ${stamp}`);

  const [created] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/app/samples') && r.request().method() === 'POST'),
    form.getByRole('button', { name: 'Save sample' }).click(),
  ]);
  expect(created.status(), JSON.stringify(await created.json().catch(() => ''))).toBe(201);
  const sent = created.request().postDataJSON();
  expect(sent.fine, 'auto fine is left to the server (omitted)').toBeUndefined();
  expect(sent.metal).toBe('GOLD');
  const s = (await created.json()) as Sample;
  expect(s.fine).toBe('9.259');
  expect(s.grossWt).toBe('12.345');
  expect(s.status).toBe('IN_HAND');
  expect(s.branch.id).toBe(branch.id);
  await expect(form).toHaveCount(0);

  // find our row by sample no.
  await Promise.all([
    page.waitForResponse((r) => /\/app\/samples\?/.test(r.url()) && new URL(r.url()).searchParams.get('q') === `#${s.sampleNo}`),
    page.locator('#samples-q').fill(`#${s.sampleNo}`),
  ]);
  const row = page.getByRole('row').filter({ has: page.getByRole('button', { name: `Open sample #${s.sampleNo}`, exact: true }) });
  await expect(row).toHaveCount(1);
  await expect(row).toContainText('9.259');
  await expect(row).toContainText('75.00');
  await expect(row).toContainText('In hand');
  await expect(row.getByRole('button', { name: 'Return', exact: true })).toHaveCount(0);

  // Issue -> karigar
  await row.getByRole('button', { name: 'Issue', exact: true }).click();
  const issueDlg = page.getByRole('dialog', { name: `Issue sample #${s.sampleNo}` });
  await expect(issueDlg).toContainText('GOLD · 12.345 g · 75.00% · fine 9.259 g');
  await pickParty(page, issueDlg, 'Issue to karigar', 'Search karigar', karigar.name);
  await page.locator('#sa-note').fill('to karigar');
  const [issued] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith(`/app/samples/${s.id}/issue`) && r.request().method() === 'POST'),
    issueDlg.getByRole('button', { name: 'Issue sample' }).click(),
  ]);
  expect(issued.status(), JSON.stringify(await issued.json().catch(() => ''))).toBe(200);
  expect(issued.request().postDataJSON().karigarId).toBe(karigar.id);
  await expect(row).toContainText('Issued');
  await expect(row).toContainText(karigar.name);
  await expect(row.getByRole('button', { name: 'Edit', exact: true })).toHaveCount(0); // ISSUED is not editable
  // ISSUED cannot be issued again
  expect((await apiSend(request, token, 'POST', `/app/samples/${s.id}/issue`, {}, String(branch.id))).status).toBe(409);

  // Return
  await row.getByRole('button', { name: 'Return', exact: true }).click();
  const retDlg = page.getByRole('dialog', { name: `Return sample #${s.sampleNo}` });
  await page.locator('#sa-note').fill('back in hand');
  const [returned] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith(`/app/samples/${s.id}/return`) && r.request().method() === 'POST'),
    retDlg.getByRole('button', { name: 'Mark returned' }).click(),
  ]);
  expect(returned.status()).toBe(200);
  await expect(row).toContainText('Returned');
  await expect(row.getByRole('button', { name: 'Issue', exact: true })).toBeVisible(); // RETURNED can be issued again

  // Melt (terminal)
  await row.getByRole('button', { name: 'Melt', exact: true }).click();
  const meltDlg = page.getByRole('dialog', { name: `Melt sample #${s.sampleNo}` });
  await expect(meltDlg).toContainText('Melting is final');
  await page.locator('#sa-note').fill('melted');
  const [melted] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith(`/app/samples/${s.id}/melt`) && r.request().method() === 'POST'),
    meltDlg.getByRole('button', { name: 'Mark melted' }).click(),
  ]);
  expect(melted.status()).toBe(200);
  await expect(row).toContainText('Melted');
  for (const b of ['Issue', 'Return', 'Edit', 'Melt']) await expect(row.getByRole('button', { name: b, exact: true })).toHaveCount(0);
  await expect(row.getByRole('button', { name: 'History', exact: true })).toBeVisible();

  // every further action on a MELTED sample is a 409 (and nothing changes)
  const b = String(branch.id);
  expect((await apiSend(request, token, 'POST', `/app/samples/${s.id}/issue`, { karigarId: karigar.id }, b)).status).toBe(409);
  expect((await apiSend(request, token, 'POST', `/app/samples/${s.id}/return`, {}, b)).status).toBe(409);
  expect((await apiSend(request, token, 'POST', `/app/samples/${s.id}/melt`, {}, b)).status).toBe(409);
  expect((await apiSend(request, token, 'PATCH', `/app/samples/${s.id}`, { note: 'x' }, b)).status).toBe(409);
  const after = await getSample(request, token, s.id);
  expect(after.status).toBe('MELTED');
  expect(after.movements!.map((m) => m.action)).toEqual(['CREATED', 'ISSUED', 'RETURNED', 'MELTED']);
  expect(after.movements![1]!.karigar?.id).toBe(karigar.id);
  expect(after.movements!.map((m) => m.note)).toEqual([`T98 smp ${stamp}`, 'to karigar', 'back in hand', 'melted']);

  // MELTED filter lists it; History sheet shows the movements oldest first
  await page.getByRole('combobox', { name: 'Sample status', exact: true }).click();
  await Promise.all([
    page.waitForResponse((r) => /\/app\/samples\?/.test(r.url()) && new URL(r.url()).searchParams.get('status') === 'MELTED'),
    page.getByRole('option', { name: 'Melted', exact: true }).click(),
  ]);
  await expect(row).toHaveCount(1);
  await row.getByRole('button', { name: 'History', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: `Sample #${s.sampleNo}` });
  await expect(sheet).toBeVisible();
  const moves = sheet.locator('ol > li');
  await expect(moves).toHaveCount(4);
  const labels = ['Created', 'Issued', 'Returned', 'Melted'];
  for (const [i, label] of labels.entries()) await expect(moves.nth(i).locator('span.font-medium')).toHaveText(label);
  await expect(moves.nth(1)).toContainText(`To ${karigar.name}`);
  await expect(moves.nth(1)).toContainText('to karigar');
  await expect(moves.nth(3)).toContainText('melted');
  await expect(sheet).toContainText('9.259 g');
  await expect(sheet).toContainText(branch.name);
});

test('samples API: server fine is gross x tounch / 100 half-up; explicit fine kept; edit recomputes; branch + karigar type checks', async ({ request }) => {
  const { token, branch } = await setup(request);
  const b = String(branch.id);
  const customer = await party(request, token, 'CUSTOMER', 'T98SmpCust');

  // 1.235 x 50 / 100 = 0.6175 -> 0.618 (Decimal half-up, no float drift)
  const s1 = await apiSample(request, token, branch.id, { metal: 'GOLD', grossWt: 1.235, tounchPercent: 50, note: 'T98 api' });
  expect(s1.fine).toBe('0.618');
  expect(s1.tounchPercent).toBe('50.000');
  const s2 = await apiSample(request, token, branch.id, { metal: 'SILVER', grossWt: 10, tounchPercent: 92.5, fine: 9 });
  expect(s2.fine, 'explicit fine is kept').toBe('9.000');
  expect(s2.sampleNo).toBeGreaterThan(s1.sampleNo);

  // edit gross without fine -> fine recomputed; party set
  const ed = await apiSend(request, token, 'PATCH', `/app/samples/${s1.id}`, { grossWt: 2, partyId: customer.id }, b);
  expect(ed.status, JSON.stringify(ed.body)).toBe(200);
  expect((ed.body as Sample).fine).toBe('1.000');
  expect((ed.body as Sample).party?.id).toBe(customer.id);
  expect(((ed.body as Sample & { movements: Array<{ action: string }> }).movements).map((m) => m.action)).toEqual(['CREATED', 'EDITED']);

  // karigarId must be a KARIGAR party; a sample needs one concrete branch
  expect((await apiSend(request, token, 'POST', `/app/samples/${s1.id}/issue`, { karigarId: customer.id }, b)).status).toBe(400);
  expect((await apiSend(request, token, 'POST', '/app/samples', { metal: 'GOLD', grossWt: 1, tounchPercent: 90 }, 'all')).status).toBe(400);
  expect((await apiSend(request, token, 'POST', '/app/samples', { metal: 'GOLD', grossWt: 1, tounchPercent: 101 }, b)).status).toBe(400);
  // return is only from ISSUED
  expect((await apiSend(request, token, 'POST', `/app/samples/${s1.id}/return`, {}, b)).status).toBe(409);

  // picker search: default IN_HAND + RETURNED; MELTED drops out
  const find = async (statuses?: string) => (await apiJson(request, token, `/app/samples/search?q=%23${s2.sampleNo}${statuses ? `&statuses=${statuses}` : ''}`, b)).body as Sample[];
  expect((await find()).some((x) => x.id === s2.id)).toBe(true);
  expect((await apiSend(request, token, 'POST', `/app/samples/${s2.id}/melt`, {}, b)).status).toBe(200);
  expect((await find()).some((x) => x.id === s2.id)).toBe(false);
  expect((await find('MELTED')).some((x) => x.id === s2.id)).toBe(true);
  // cleanup: retire s1 so it does not crowd the picker
  expect((await apiSend(request, token, 'POST', `/app/samples/${s1.id}/melt`, {}, b)).status).toBe(200);
});

test('karigar IssueDialog: Select samples picker -> picked sample issued to the same karigar, unpicked one stays in hand', async ({ page, request }) => {
  test.setTimeout(120_000);
  const { token, branch } = await setup(request);
  const b = String(branch.id);
  const names = (await apiJson(request, token, '/app/item-names?page=1&pageSize=100')).body.items as Array<{ id: number; name: string; group: { stockClass: string } }>;
  const itemName = names.find((n) => n.group.stockClass === 'GOLD');
  expect(itemName, 'demo data must have a GOLD item name').toBeTruthy();
  const customer = await party(request, token, 'CUSTOMER', 'T98SmpOrd');
  const karigar = await party(request, token, 'KARIGAR', 'T98SmpIssKari');
  const ord = await apiSend(request, token, 'POST', '/app/orders', { partyId: customer.id, items: [{ itemNameId: itemName!.id, metal: 'GOLD', touch: 91.6, gross: 5 }] }, b);
  expect(ord.status, JSON.stringify(ord.body)).toBe(201);
  const order = ord.body as { id: number };
  const tag = `T98pick${Date.now()}`;
  const s1 = await apiSample(request, token, branch.id, { metal: 'GOLD', grossWt: 1.5, tounchPercent: 91.6, note: tag });
  const s2 = await apiSample(request, token, branch.id, { metal: 'GOLD', grossWt: 2, tounchPercent: 75, note: tag });

  await ownerOn(page, `/app/orders/${order.id}`, branch.id);
  await page.getByRole('checkbox', { name: `Select ${itemName!.name}` }).check();
  await page.getByRole('button', { name: 'Issue 1 to karigar' }).click();
  const dlg = page.getByRole('dialog', { name: 'Issue 1 item to karigar' });
  await expect(dlg).toBeVisible();
  await pickParty(page, dlg, 'Karigar', 'Search karigar', karigar.name);

  const toggle = dlg.getByRole('button', { name: /^Select samples/ });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await Promise.all([
    page.waitForResponse((r) => r.url().includes('/app/samples/search') && new URL(r.url()).searchParams.get('q') === tag),
    dlg.getByRole('searchbox', { name: 'Search samples' }).fill(tag),
  ]);
  const found = dlg.getByRole('list', { name: 'Samples found' });
  const opt = (no: number) => found.getByRole('button', { name: new RegExp(`^#${no} · GOLD · `) });
  await expect(opt(s1.sampleNo)).toContainText(`#${s1.sampleNo} · GOLD · 1.500 g · 91.60% · fine 1.374 g`);
  await opt(s1.sampleNo).click();
  await opt(s2.sampleNo).click();
  await expect(opt(s1.sampleNo)).toHaveAttribute('aria-pressed', 'true');
  await expect(dlg.getByRole('button', { name: 'Select samples (2)' })).toBeVisible();
  // drop s2 via its chip
  await dlg.getByRole('button', { name: `Remove sample #${s2.sampleNo}`, exact: true }).click();
  await expect(opt(s2.sampleNo)).toHaveAttribute('aria-pressed', 'false');
  await expect(dlg.getByRole('button', { name: 'Select samples (1)' })).toBeVisible();

  const [res] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/app/karigar-issues') && r.request().method() === 'POST'),
    dlg.getByRole('button', { name: 'Issue', exact: true }).click(),
  ]);
  expect(res.status(), JSON.stringify(await res.json().catch(() => ''))).toBe(201);
  await expect(dlg).toHaveCount(0);

  // the FE issues each picked sample after the issue saves (or the backend does it via sampleIds) -> either way the sample ends ISSUED to that karigar
  await expect.poll(async () => (await getSample(request, token, s1.id)).status, { timeout: 10_000 }).toBe('ISSUED');
  const got1 = await getSample(request, token, s1.id);
  expect(got1.karigar?.id).toBe(karigar.id);
  expect(got1.movements!.at(-1)!.action).toBe('ISSUED');
  expect((await getSample(request, token, s2.id)).status, 'unpicked sample stays in hand').toBe('IN_HAND');
  // the picker (IN_HAND + RETURNED) no longer offers the issued one
  const left = (await apiJson(request, token, `/app/samples/search?q=${tag}`, b)).body as Sample[];
  expect(left.map((x) => x.id)).toEqual([s2.id]);

  // cleanup: retire both samples (terminal) so they do not crowd the picker; the order stays IN_PROCESS with an open karigar issue
  for (const s of [s1, s2]) expect((await apiSend(request, token, 'POST', `/app/samples/${s.id}/melt`, {}, b)).status).toBe(200);
});
