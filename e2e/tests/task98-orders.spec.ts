import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { login, PW } from './helpers';

// TASK-98 orders: New Order extras (Labour ₹ / Wastage g / Jewellery type / Misc / Gold ₹/unit override) vs the server estTotal,
// #no-next-no preview = saved order no., Design upload/remove on Order Detail, IssueDialog wastage % / g, Ready to deliver 'All',
// All Orders 'Open (pending + in process)', bulk bar Print selected + Cancel selected (confirm -> MPIN -> failures dialog).
const rx = (s: string) => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
const inr = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n);
const RATE_UNIT_GRAMS: Record<string, number> = { GRAM_1: 1, GRAM_10: 10, TOLA: 11.6638, KG_1: 1000 }; // mirrors shared/contracts/masters.ts
// 1x1 transparent PNG (magic bytes 89 50 4E 47 pass the server's type sniff)
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

async function apiToken(request: APIRequestContext, user: string): Promise<string> {
  return (await (await request.post('/api/auth/login', { data: { login: user, password: PW } })).json()).accessToken as string;
}
const hdr = (token: string, branch = 'all', mpin?: string) => ({ Authorization: `Bearer ${token}`, 'X-Branch-Id': branch, ...(mpin ? { 'X-MPIN': mpin } : {}) });
async function apiJson(request: APIRequestContext, token: string, path: string, branch = 'all') {
  const r = await request.get(`/api${path}`, { headers: hdr(token, branch) });
  return { status: r.status(), body: await r.json().catch(() => null) };
}
async function apiPost(request: APIRequestContext, token: string, path: string, data: unknown, branch = 'all', mpin?: string) {
  const r = await request.post(`/api${path}`, { headers: hdr(token, branch, mpin), data });
  return { status: r.status(), body: await r.json().catch(() => null) };
}
let seq = 0;
async function party(request: APIRequestContext, token: string, type: 'CUSTOMER' | 'KARIGAR', tag: string) {
  const stamp = `${Date.now()}${seq++}`;
  const r = await apiPost(request, token, '/app/parties', { type, name: `${tag} ${stamp}`, mobile: '9' + stamp.slice(-9) });
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  return r.body as { id: number; name: string };
}
type Branch = { id: number; name: string };
type OrderItem = { id: number; status: string; fine: string; labour: string; wastageGm: string; jewelleryTypeId: number | null; itemName: { name: string } };
type Order = { id: number; orderNo: number; status: string; estTotal: string; goldRate: string | null; miscCharges: string; designUrl: string | null; branch: Branch; items: OrderItem[] };

/** Owner token with MPIN 1234, the first accessible branch (= option index 1 of 'Active branch') and the first GOLD item name. */
async function setup(request: APIRequestContext) {
  const token = await apiToken(request, 'demo.owner');
  await request.post('/api/auth/mpin', { headers: { Authorization: `Bearer ${token}` }, data: { password: PW, mpin: '1234' } });
  const me = (await (await request.get('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })).json()) as { accessibleBranches: Branch[] };
  const branch = me.accessibleBranches[0]!;
  const names = (await apiJson(request, token, '/app/item-names?page=1&pageSize=100')).body.items as Array<{ id: number; name: string; group: { stockClass: string } }>;
  const gold = names.find((n) => n.group.stockClass === 'GOLD');
  expect(gold, 'demo data must have a GOLD item name').toBeTruthy();
  return { token, branch, itemName: gold! };
}
async function apiOrder(request: APIRequestContext, token: string, branchId: number, partyId: number, itemNameId: number): Promise<Order> {
  const r = await apiPost(request, token, '/app/orders', { partyId, items: [{ itemNameId, metal: 'GOLD', touch: 91.6, gross: 5 }] }, String(branchId));
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  return r.body as Order;
}
const cancel = (request: APIRequestContext, token: string, id: number) => request.post(`/api/app/orders/${id}/cancel`, { headers: hdr(token, 'all', '1234') });
async function ownerOn(page: Page, path: string, branchId?: number) {
  await login(page, 'demo.owner');
  await page.waitForURL(/\/admin/);
  await page.goto(path);
  if (branchId != null) await page.getByRole('combobox', { name: 'Active branch' }).selectOption(String(branchId));
}

test('new order: labour / wastage g / jewellery type / misc / gold override -> UI estimate = server estTotal; #no-next-no = saved no.', async ({ page, request }) => {
  test.setTimeout(120_000);
  const { token, branch, itemName } = await setup(request);
  const customer = await party(request, token, 'CUSTOMER', 'T98OrdCust');
  const jt = ((await apiJson(request, token, '/app/jewellery-types')).body as Array<{ id: number; name: string; stockClass: string | null }>).find((x) => !x.stockClass || x.stockClass === 'GOLD');
  const basis = (await apiJson(request, token, '/app/settings')).body['calc.basis'].sale as 'NET' | 'GROSS' | 'FINE';
  const unit = RATE_UNIT_GRAMS[(await apiJson(request, token, '/app/rates/current', String(branch.id))).body.gold.rateUnit as string]!;

  await ownerOn(page, '/app/orders/new', branch.id);
  const preview = page.locator('#no-next-no');
  await expect(preview).toContainText(/Order no\. #\d+ \(preview\)/);
  const previewNo = Number((await preview.textContent())!.match(/#(\d+)/)![1]);

  await page.getByRole('combobox', { name: 'Customer' }).click();
  await page.getByPlaceholder('Search name / mobile').fill(customer.name);
  await page.waitForResponse((r) => r.url().includes('/app/parties/search'));
  await page.getByRole('option', { name: rx(customer.name) }).first().click();
  await page.getByRole('combobox', { name: 'Rate type' }).click();
  await page.getByRole('option', { name: 'Fixed (today)' }).click();
  await page.locator('#no-misc').fill('250');
  await page.locator('#no-gold-override').fill('60000');

  await page.getByRole('combobox', { name: 'Item name' }).click();
  await page.getByRole('option', { name: itemName.name, exact: true }).click();
  if (jt) {
    await page.getByRole('combobox', { name: 'Jewellery type' }).click();
    await page.getByRole('option', { name: jt.name, exact: true }).click();
  }
  await page.getByRole('spinbutton', { name: 'Gross' }).fill('10');
  await page.getByRole('spinbutton', { name: 'Touch' }).fill('91.6');
  await page.getByRole('spinbutton', { name: 'Wastage g', exact: true }).fill('0.5');
  await page.getByRole('spinbutton', { name: 'Making', exact: true }).fill('100'); // PER_GRAM (default unit) -> 10 g x 100
  await page.getByRole('spinbutton', { name: 'Other', exact: true }).fill('50');
  await page.getByRole('spinbutton', { name: 'Labour ₹' }).fill('300');
  await page.locator('#no-design').setInputFiles({ name: 'design.png', mimeType: 'image/png', buffer: PNG });

  // expected (server createOrder + orderLineExtras): metal on the sale basis + making + other + wastage-g metal (FINE only) + labour, + misc
  const perGram = 60000 / unit;
  const metal = (basis === 'FINE' ? 9.16 : 10) * perGram;
  const wMetal = basis === 'FINE' ? 0.5 * perGram : 0;
  const expected = metal + 10 * 100 + 50 + wMetal + 300 + 250;
  const estimate = page.getByText('Estimated total', { exact: true }).locator('xpath=following-sibling::span[1]');
  await expect(page.getByText(`${inr(300)} · ${inr(250)}`)).toBeVisible(); // Labour · misc charges
  await expect(page.getByText('9.660 g gold', { exact: false })).toBeVisible(); // 10 x 91.6% + 0.5 g wastage

  const uiShown = await estimate.textContent();
  const [created, design] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/app/orders') && r.request().method() === 'POST'),
    page.waitForResponse((r) => /\/app\/orders\/\d+\/design$/.test(r.url()) && r.request().method() === 'POST'),
    page.getByRole('button', { name: 'Create order' }).click(),
  ]);
  expect(created.status(), JSON.stringify(await created.json().catch(() => ''))).toBe(201);
  expect(design.status(), 'design uploaded right after create').toBe(201);
  const body = created.request().postDataJSON();
  expect(Number(body.goldRate)).toBe(60000);
  expect(Number(body.miscCharges)).toBe(250);
  expect(body.rateType).toBe('FIXED');
  expect(Number(body.items[0].labour)).toBe(300);
  expect(Number(body.items[0].wastageGm)).toBe(0.5);
  if (jt) expect(body.items[0].jewelleryTypeId).toBe(jt.id);

  const order = (await created.json()) as Order;
  expect(order.orderNo, '#no-next-no preview matches the saved order no.').toBe(previewNo);
  expect(Number(order.estTotal)).toBeCloseTo(expected, 1);
  expect(uiShown, 'UI estimate equals the server estTotal').toBe(inr(Number(order.estTotal)));
  expect(Number(order.goldRate)).toBe(60000); // FIXED locks the override
  expect(Number(order.miscCharges)).toBe(250);
  expect(Number(order.items[0]!.labour)).toBe(300);
  expect(Number(order.items[0]!.wastageGm)).toBeCloseTo(0.5, 3);
  expect(Number(order.items[0]!.fine)).toBeCloseTo(9.66, 3);
  if (jt) expect(order.items[0]!.jewelleryTypeId).toBe(jt.id);

  await page.waitForURL(new RegExp(`/app/orders/${order.id}$`));
  await expect(page.getByText(`Est. ${inr(Number(order.estTotal))} (incl. misc ${inr(250)})`, { exact: false })).toBeVisible();
  if (jt) await expect(page.getByRole('cell', { name: jt.name, exact: true })).toBeVisible();
  await expect(page.getByRole('img', { name: `Order #${order.orderNo} design` })).toBeVisible();

  expect((await cancel(request, token, order.id)).status()).toBe(204);
});

test('order detail: Design upload (PNG) -> preview + Replace; Remove -> "No design file."; non-image rejected by the API', async ({ page, request }) => {
  test.setTimeout(90_000);
  const { token, branch, itemName } = await setup(request);
  const customer = await party(request, token, 'CUSTOMER', 'T98Design');
  const order = await apiOrder(request, token, branch.id, customer.id, itemName.id);

  // server sniffs magic bytes: a text file named .png is a 400
  const bad = await request.post(`/api/app/orders/${order.id}/design`, { headers: hdr(token), multipart: { file: { name: 'fake.png', mimeType: 'image/png', buffer: Buffer.from('not an image') } } });
  expect(bad.status()).toBe(400);

  await ownerOn(page, `/app/orders/${order.id}`);
  await expect(page.getByText('No design file.')).toBeVisible();
  const [up] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith(`/app/orders/${order.id}/design`) && r.request().method() === 'POST'),
    page.locator('input[type="file"][aria-label="Design file"]').setInputFiles({ name: 'design.png', mimeType: 'image/png', buffer: PNG }),
  ]);
  expect(up.status()).toBe(201);
  await expect(page.getByRole('img', { name: `Order #${order.orderNo} design` })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Replace design' })).toBeVisible();
  const stream = await request.get(`/api/app/orders/${order.id}/design`, { headers: hdr(token) });
  expect(stream.status()).toBe(200);
  expect(stream.headers()['content-type']).toContain('image/png');

  const [del] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith(`/app/orders/${order.id}/design`) && r.request().method() === 'DELETE'),
    page.getByRole('button', { name: 'Remove design' }).click(),
  ]);
  expect(del.status()).toBe(204);
  await expect(page.getByText('No design file.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Upload design' })).toBeVisible();
  expect(((await apiJson(request, token, `/app/orders/${order.id}`)).body as Order).designUrl).toBeNull();
  expect((await request.get(`/api/app/orders/${order.id}/design`, { headers: hdr(token) })).status()).toBe(404);

  expect((await cancel(request, token, order.id)).status()).toBe(204);
});

test('issue dialog: Wastage % (#ki-wst-pct) and Wastage g (#ki-wst-gm) are sent and stored on the karigar issue', async ({ page, request }) => {
  test.setTimeout(90_000);
  const { token, branch, itemName } = await setup(request);
  const customer = await party(request, token, 'CUSTOMER', 'T98IssCust');
  const karigar = await party(request, token, 'KARIGAR', 'T98IssKari');
  const order = await apiOrder(request, token, branch.id, customer.id, itemName.id);

  await ownerOn(page, `/app/orders/${order.id}`, branch.id); // the issue posts to the active branch
  await page.getByRole('checkbox', { name: `Select ${itemName.name}` }).check();
  await page.getByRole('button', { name: 'Issue 1 to karigar' }).click();
  const dlg = page.getByRole('dialog');
  await expect(dlg).toContainText('Issue 1 item to karigar');
  await dlg.getByRole('combobox', { name: 'Karigar' }).click();
  await page.getByPlaceholder('Search karigar').fill(karigar.name);
  await page.waitForResponse((r) => r.url().includes('/app/parties/search'));
  await page.getByRole('option', { name: rx(karigar.name) }).first().click();
  await page.locator('#ki-wst-pct').fill('2.5');
  await page.locator('#ki-wst-gm').fill('0.35');
  const [res] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/app/karigar-issues') && r.request().method() === 'POST'),
    dlg.getByRole('button', { name: 'Issue', exact: true }).click(),
  ]);
  expect(res.status(), JSON.stringify(await res.json().catch(() => ''))).toBe(201);
  const sent = res.request().postDataJSON();
  expect(sent.wastagePercent).toBe(2.5);
  expect(sent.wastageGm).toBe(0.35);
  const issue = (await res.json()) as { id: number; issueNo: number };
  const stored = (await apiJson(request, token, `/app/karigar-issues/${issue.id}`, String(branch.id))).body as { wastagePercent: string | null; wastageGm: string | null };
  expect(Number(stored.wastagePercent)).toBeCloseTo(2.5, 3);
  expect(Number(stored.wastageGm)).toBeCloseTo(0.35, 3);
  await expect(page.getByRole('cell', { name: `#${issue.issueNo} ${karigar.name}` })).toBeVisible();
  // shortcut: the open issue stays (receiving it would tag a finished stock piece); the order is left IN_PROCESS
});

test('ready to deliver: "All (ready and delivered)" sends statuses=READY,DELIVERED', async ({ page }) => {
  await ownerOn(page, '/app/orders/ready');
  await page.getByRole('combobox', { name: 'Show orders' }).click();
  const [resp] = await Promise.all([
    page.waitForResponse((r) => /\/app\/orders\?/.test(r.url()) && decodeURIComponent(r.url()).includes('statuses=READY,DELIVERED')),
    page.getByRole('option', { name: 'All (ready and delivered)' }).click(),
  ]);
  expect(resp.status()).toBe(200);
  for (const o of ((await resp.json()) as { items: Order[] }).items) expect(['READY', 'DELIVERED']).toContain(o.status);
  await expect(page.getByText('Ready and delivered', { exact: true })).toBeVisible(); // 'Listed' tile caption
});

test('all orders: "Open (pending + in process)" sends statuses=PENDING,IN_PROCESS', async ({ page }) => {
  await ownerOn(page, '/app/orders');
  await page.getByRole('combobox', { name: 'Status', exact: true }).click();
  const [resp] = await Promise.all([
    page.waitForResponse((r) => /\/app\/orders\?/.test(r.url()) && decodeURIComponent(r.url()).includes('statuses=PENDING,IN_PROCESS')),
    page.getByRole('option', { name: 'Open (pending + in process)' }).click(),
  ]);
  expect(resp.status()).toBe(200);
  for (const o of ((await resp.json()) as { items: Order[] }).items) expect(['PENDING', 'IN_PROCESS']).toContain(o.status);
  await expect(page.getByRole('combobox', { name: 'Status', exact: true })).toContainText('Open (pending + in process)');
});

test('all orders bulk bar: Print selected -> ?print=ids; Cancel selected -> confirm -> MPIN -> failures listed', async ({ page, request }) => {
  test.setTimeout(120_000);
  const { token, branch, itemName } = await setup(request);
  const customer = await party(request, token, 'CUSTOMER', 'T98Bulk');
  const karigar = await party(request, token, 'KARIGAR', 'T98BulkKari');
  const o1 = await apiOrder(request, token, branch.id, customer.id, itemName.id);
  const o2 = await apiOrder(request, token, branch.id, customer.id, itemName.id);
  // o2's item goes to a karigar -> the server refuses to cancel it (item ASSIGNED)
  const iss = await apiPost(request, token, '/app/karigar-issues', { karigarId: karigar.id, orderItemIds: [o2.items[0]!.id] }, String(branch.id));
  expect(iss.status, JSON.stringify(iss.body)).toBe(201);

  await ownerOn(page, '/app/orders');
  const search = async () => {
    await Promise.all([
      page.waitForResponse((r) => /\/app\/orders\?/.test(r.url()) && new URL(r.url()).searchParams.get('q') === customer.name),
      page.getByPlaceholder('Search order / party / mobile…').fill(customer.name),
    ]);
    await expect(page.locator(`a[href="/app/orders/${o1.id}"]`)).toBeVisible();
    await expect(page.locator(`a[href="/app/orders/${o2.id}"]`)).toBeVisible();
  };
  await search();
  const bar = page.locator('#orders-bulk-bar');
  await expect(bar).toHaveCount(0);
  await page.getByRole('checkbox', { name: 'Choose all orders on this page' }).check();
  await expect(bar).toContainText('2 selected');

  // Print selected -> batch slips
  await page.locator('#orders-bulk-print').click();
  await page.waitForURL(/\/app\/orders\?print=/);
  const ids = new URL(page.url()).searchParams.get('print')!.split(',').map(Number).sort((a, b) => a - b);
  expect(ids).toEqual([o1.id, o2.id].sort((a, b) => a - b));
  await expect(page.getByText('Order slips: 2.', { exact: false })).toBeVisible();
  await expect(page.locator('#orders-print-all')).toBeVisible();
  await expect(page.locator('.print-area')).toContainText(`#${o1.orderNo}`);
  await expect(page.locator('.print-area')).toContainText(`#${o2.orderNo}`);

  // back to the list (selection is page-local, so pick both again)
  await page.goto('/app/orders');
  await search();
  await page.getByRole('checkbox', { name: `Choose order ${o1.orderNo}`, exact: true }).check();
  await page.getByRole('checkbox', { name: `Choose order ${o2.orderNo}`, exact: true }).check();
  await expect(bar).toContainText('2 selected');
  await page.locator('#orders-bulk-cancel').click();
  const confirm = page.getByRole('dialog', { name: 'Cancel selected orders?' });
  await expect(confirm).toContainText('Orders to cancel: 2.');
  await page.locator('#orders-bulk-cancel-continue').click();
  const mpin = page.getByRole('dialog', { name: 'Cancel selected orders (2)' });
  await expect(mpin).toBeVisible();
  await mpin.getByLabel('MPIN').fill('1234');
  const [res] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/app/orders/bulk-cancel') && r.request().method() === 'POST'),
    mpin.getByRole('button', { name: 'Confirm' }).click(),
  ]);
  expect(res.status(), JSON.stringify(await res.json().catch(() => ''))).toBe(200);
  const out = (await res.json()) as { cancelled: number[]; failed: Array<{ id: number; reason: string }> };
  expect(out.cancelled).toEqual([o1.id]);
  expect(out.failed.map((f) => f.id)).toEqual([o2.id]);

  const failed = page.locator('#orders-bulk-failed');
  await expect(page.getByRole('dialog', { name: 'Orders not cancelled' })).toBeVisible();
  await expect(failed).toContainText(`Order #${o2.orderNo}`);
  await expect(failed).toContainText('Receive or close the open karigar issue before cancelling');
  await expect(failed).not.toContainText(`Order #${o1.orderNo}:`);
  await page.getByRole('dialog', { name: 'Orders not cancelled' }).getByRole('button', { name: 'OK' }).click();
  await expect(bar).toHaveCount(0);

  expect(((await apiJson(request, token, `/app/orders/${o1.id}`)).body as Order).status).toBe('CANCELLED');
  expect(((await apiJson(request, token, `/app/orders/${o2.id}`)).body as Order).status).not.toBe('CANCELLED');
});
