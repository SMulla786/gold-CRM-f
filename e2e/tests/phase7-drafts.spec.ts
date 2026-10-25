import { expect, test, type APIRequestContext } from '@playwright/test';
import { login, PW } from './helpers';

// Phase 7 showroom drafts: salesperson carts stock → manager approves a discount → cashier bills it.
// Driven as demo.owner (who holds showroom_drafts + draft_approvals + billing.sell_bill); per-role 403s are backend-tested.
async function apiToken(request: APIRequestContext, user: string): Promise<string> {
  return (await (await request.post('/api/auth/login', { data: { login: user, password: PW } })).json()).accessToken as string;
}
async function apiJson(request: APIRequestContext, token: string, path: string, branch = 'all') {
  const r = await request.get(`/api${path}`, { headers: { Authorization: `Bearer ${token}`, 'X-Branch-Id': branch } });
  return { status: r.status(), body: await r.json().catch(() => null) };
}
async function apiPost(request: APIRequestContext, token: string, path: string, data: unknown, branch = 'all') {
  const r = await request.post(`/api${path}`, { headers: { Authorization: `Bearer ${token}`, 'X-Branch-Id': branch }, data });
  return { status: r.status(), body: await r.json().catch(() => null) };
}
const rx = (s: string) => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

/** Fresh AVAILABLE TAG item via API, so the cart always has known, undepleted stock. */
async function newTagItem(request: APIRequestContext, token: string) {
  const branch = (await apiJson(request, token, '/app/stock?page=1&pageSize=1')).body.items[0].branch as { id: number; name: string };
  const names = (await apiJson(request, token, '/app/item-names?stockClass=GOLD&page=1&pageSize=50')).body.items as Array<{ id: number; method: string; tagPrefix: string | null }>;
  const tagName = names.find((n) => n.tagPrefix && (n.method === 'TAG' || n.method === 'BOTH'))!;
  const entry = await apiPost(request, token, '/app/stock/entries', { stockClass: 'GOLD', method: 'TAG', branchId: branch.id, rows: [{ itemNameId: tagName.id, gross: 10, tunch: 91.67, pcs: 1 }] }, String(branch.id));
  expect(entry.status, JSON.stringify(entry.body)).toBe(201);
  return { branch, item: entry.body.items[0] as { id: number; tagNo: string } };
}
const freshCustomer = (request: APIRequestContext, token: string) =>
  apiPost(request, token, '/app/parties', { type: 'CUSTOMER', name: `DraftCust ${Date.now()}`, mobile: '9' + String(Date.now()).slice(-9) }).then((r) => r.body);
const draftByParty = async (request: APIRequestContext, token: string, partyId: number) =>
  ((await apiJson(request, token, '/app/drafts?page=1&pageSize=50')).body.items as any[]).find((d) => d.party?.id === partyId);

test('draft: cart → approve with discount → cashier bills it → BILLED; re-billing the same draft → 409', async ({ page, request }) => {
  test.setTimeout(90_000);
  const token = await apiToken(request, 'demo.owner');
  const { branch, item: a } = await newTagItem(request, token);
  const { item: b } = await newTagItem(request, token);
  const party = await freshCustomer(request, token); // party-linked so the sell bill can carry the balance

  // 1) salesperson carts the two items from the stock list → checkout draft
  await login(page, 'demo.owner');
  await page.waitForURL(/\/admin/);
  await page.goto('/app/inventory/stock');
  await page.getByRole('combobox', { name: 'Active branch' }).selectOption({ label: branch.name });
  await page.getByRole('checkbox', { name: `Select ${a.tagNo}` }).check();
  await page.getByRole('checkbox', { name: `Select ${b.tagNo}` }).check();
  await page.getByRole('button', { name: 'Add to cart' }).click();
  await expect(page.getByRole('dialog')).toContainText('Checkout 2 items');
  await page.getByRole('combobox', { name: 'Customer' }).click();
  await page.getByPlaceholder('Search name / mobile').fill(party.name);
  await page.waitForResponse((r) => r.url().includes('/app/parties/search'));
  await page.getByRole('option', { name: rx(party.name) }).first().click();
  await page.locator('#cd-disc').fill('500');
  await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/app/drafts') && r.request().method() === 'POST' && r.status() === 201),
    page.getByRole('button', { name: 'Send for approval' }).click(),
  ]);
  const draft = await draftByParty(request, token, party.id);
  expect(draft?.status, 'draft created PENDING').toBe('PENDING');

  // 2) manager approves with an adjusted discount
  await page.goto('/app/billing/approvals');
  await page.waitForResponse((r) => r.url().includes('/app/drafts') && r.url().includes('status=PENDING'));
  const card = page.locator('div').filter({ has: page.getByText(`Draft #${draft.draftNo} ·`) }).filter({ has: page.getByRole('button', { name: 'Approve' }) }).first();
  await card.getByRole('button', { name: 'Approve' }).click();
  await page.locator('#ap-disc').fill('1000');
  await Promise.all([
    page.waitForResponse((r) => rx(`/app/drafts/${draft.id}/decision`).test(r.url()) && r.request().method() === 'POST'),
    page.getByRole('dialog').getByRole('button', { name: 'Approve' }).click(),
  ]);
  expect((await apiJson(request, token, `/app/drafts/${draft.id}`)).body.status).toBe('APPROVED');

  // 3) cashier retrieves it by number on the Sell Bill and saves → draft BILLED
  await page.goto('/app/billing');
  await page.getByRole('combobox', { name: 'Active branch' }).selectOption({ label: branch.name });
  await page.waitForResponse((r) => r.url().includes('/app/bills/next-no') && r.status() === 200);
  await page.getByRole('textbox', { name: 'Draft number' }).fill(String(draft.draftNo));
  await Promise.all([
    page.waitForResponse((r) => r.url().includes(`/app/drafts/by-no/${draft.draftNo}`) && r.status() === 200),
    page.getByRole('button', { name: 'Retrieve draft' }).click(),
  ]);
  await expect(page.getByText(/approved discount pre-filled/i)).toBeVisible(); // draft loaded
  await page.getByRole('spinbutton', { name: 'Rate' }).first().fill('165000'); // give line 1 a value
  const [sold] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/app/bills') && r.request().method() === 'POST'),
    page.getByRole('button', { name: 'Save sell bill' }).click(),
  ]);
  expect(sold.status(), JSON.stringify(await sold.json().catch(() => ''))).toBe(201);
  const billed = (await apiJson(request, token, `/app/drafts/${draft.id}`)).body;
  expect(billed.status).toBe('BILLED');
  expect(billed.billId).toBe((await sold.json()).id);

  // 4) a second bill reusing the same (now BILLED) draft is rejected
  const { item: c } = await newTagItem(request, token);
  // a line valid on its own (gold rate within limits), so the only failure is the already-BILLED draft
  const reuse = await apiPost(request, token, '/app/bills', { kind: 'SELL', billType: 'ROUGH', partyId: party.id, items: [{ stockItemId: c.id, gross: 10, rate: 165000 }], payments: [{ mode: 'CASH', amount: 165000 }], draftId: draft.id }, String(branch.id));
  expect(reuse.status, JSON.stringify(reuse.body)).toBe(409); // draft already BILLED
});

test('draft: reject records the reason', async ({ page, request }) => {
  test.setTimeout(60_000);
  const token = await apiToken(request, 'demo.owner');
  const { branch, item } = await newTagItem(request, token);
  const who = `Rej ${Date.now()}`;
  // seed a PENDING draft via API (checkout UI is covered by the first test)
  const created = await apiPost(request, token, '/app/drafts', { stockItemIds: [item.id], customerName: who, requestedDiscount: 2000, requestedDiscountUnit: 'FIXED' }, String(branch.id));
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  const draftNo = created.body.draftNo;

  await login(page, 'demo.owner');
  await page.waitForURL(/\/admin/);
  await page.goto('/app/billing/approvals');
  await page.waitForResponse((r) => r.url().includes('/app/drafts') && r.url().includes('status=PENDING'));
  const card = page.locator('div').filter({ has: page.getByText(`Draft #${draftNo} ·`) }).filter({ has: page.getByRole('button', { name: 'Reject' }) }).first();
  await card.getByRole('button', { name: 'Reject' }).click();
  await page.locator('#rj-reason').fill('Discount too high for this margin');
  await Promise.all([
    page.waitForResponse((r) => rx(`/app/drafts/${created.body.id}/decision`).test(r.url()) && r.request().method() === 'POST'),
    page.getByRole('dialog').getByRole('button', { name: 'Reject' }).click(),
  ]);
  const after = (await apiJson(request, token, `/app/drafts/${created.body.id}`)).body;
  expect(after.status).toBe('REJECTED');
  expect(after.rejectionReason).toBe('Discount too high for this margin');
});
