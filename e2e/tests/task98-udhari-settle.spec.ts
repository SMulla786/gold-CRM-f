import { expect, test, type APIRequestContext } from '@playwright/test';
import { login, PW } from './helpers';

// TASK-98 udhari: New Udhar settling a PURCHASE bill (money given, capped at the bill due: UI hint + 409),
// delete restores the bill's paid; receipt reprint keeps its own Old / New balance after a later udhar.
const rx = (s: string) => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
type Branch = { id: number; name: string; isAdminNode: boolean };
type Bal = { amount: string; gold: string; silver: string };
type Txn = { id: number; txnNo: number; old: Bal; final: Bal; settleBill: { id: number; billNo: string } | null };

async function apiToken(request: APIRequestContext, user: string): Promise<string> {
  return (await (await request.post('/api/auth/login', { data: { login: user, password: PW } })).json()).accessToken as string;
}
const hdr = (token: string, branch = 'all', mpin?: string) => ({ Authorization: `Bearer ${token}`, 'X-Branch-Id': branch, ...(mpin ? { 'X-MPIN': mpin } : {}) });
async function apiGet(request: APIRequestContext, token: string, path: string, branch = 'all') {
  const r = await request.get(`/api${path}`, { headers: hdr(token, branch) });
  return { status: r.status(), body: await r.json().catch(() => null) };
}
async function apiPost(request: APIRequestContext, token: string, path: string, data: unknown, branch = 'all') {
  const r = await request.post(`/api${path}`, { headers: hdr(token, branch), data });
  return { status: r.status(), body: await r.json().catch(() => null) };
}
/** First concrete (non admin-node) branch of the owner: bills and udhar post to one branch. */
async function postingBranch(request: APIRequestContext, token: string): Promise<Branch> {
  const me = (await apiGet(request, token, '/auth/me')).body as { accessibleBranches: Branch[] };
  const b = me.accessibleBranches.find((x) => !x.isAdminNode) ?? me.accessibleBranches[0];
  expect(b, 'owner needs a branch').toBeTruthy();
  return b!;
}
async function newParty(request: APIRequestContext, token: string, type: 'CUSTOMER' | 'SUPPLIER', name: string) {
  const p = await apiPost(request, token, '/app/parties', { type, name, mobile: `9${String(Date.now()).slice(-9)}` });
  expect(p.status, JSON.stringify(p.body)).toBe(201);
  return p.body as { id: number; name: string };
}
async function billPaid(request: APIRequestContext, token: string, billId: number, branch: string) {
  const b = (await apiGet(request, token, `/app/bills/${billId}`, branch)).body as { final: string; paid: string; balance: string };
  return { final: Number(b.final), paid: Number(b.paid), balance: Number(b.balance) };
}

test('udhar settles a PURCHASE bill: picker "Purchase · ", > due blocked (hint + 409), <= due raises paid, delete restores', async ({ page, request }) => {
  test.setTimeout(120_000);
  const token = await apiToken(request, 'demo.owner');
  await request.post('/api/auth/mpin', { headers: { Authorization: `Bearer ${token}` }, data: { password: PW, mpin: '1234' } });
  const branch = await postingBranch(request, token);
  const bid = String(branch.id);
  const stamp = Date.now();
  const supplier = await newParty(request, token, 'SUPPLIER', `T98 Supplier ${stamp}`);

  // open purchase bill (ROUGH, no payment): 1 g, metal rate 0 (skips the shop's rate limits), FIXED labour ₹5000 -> whole final due
  const names = (await apiGet(request, token, '/app/item-names?page=1&pageSize=50&stockClass=GOLD')).body.items as Array<{ id: number }>;
  expect(names.length, 'demo data must have a GOLD item name').toBeGreaterThan(0);
  const pb = await apiPost(request, token, '/app/bills', { kind: 'PURCHASE', billType: 'ROUGH', partyId: supplier.id, items: [{ itemNameId: names[0]!.id, gross: 1, tunch: 100, rate: 0, labour: 5000, labourUnit: 'FIXED' }], payments: [] }, bid);
  expect(pb.status, JSON.stringify(pb.body)).toBe(201);
  const bill = pb.body as { id: number; billNo: string; final: string };
  const start = await billPaid(request, token, bill.id, bid);
  expect(start.paid).toBe(0);
  expect(start.balance).toBeGreaterThan(1000);
  const pending = (await apiGet(request, token, `/app/udhar/pending-bills?partyId=${supplier.id}&page=1&pageSize=50`, bid)).body.items as Array<{ id: number; kind: string; balance: string }>;
  const due = pending.find((b) => b.id === bill.id)!;
  expect(due, 'purchase bill listed as pending').toBeTruthy();
  expect(due.kind).toBe('PURCHASE');

  await login(page, 'demo.owner');
  await page.waitForURL(/\/admin/);
  await page.goto('/app/udhari');
  await page.getByRole('combobox', { name: 'Active branch' }).selectOption(bid);
  await page.getByRole('combobox', { name: 'Party' }).click();
  await page.getByPlaceholder('Search name / mobile').fill(supplier.name);
  await page.waitForResponse((r) => r.url().includes('/app/parties/search'));
  await page.getByRole('option', { name: rx(supplier.name) }).first().click();

  // settle picker lists the purchase bill with the 'Purchase · ' prefix
  await page.getByRole('combobox', { name: 'Settle bill' }).click();
  await page.getByRole('option', { name: rx(`Purchase · ${bill.billNo} · balance ₹${due.balance}`) }).click();
  await expect(page.getByRole('combobox', { name: 'Settle bill' })).toContainText(`Purchase · ${bill.billNo}`);

  const hint = page.getByText(`Enter the amount paid (cash / online given), up to ₹${due.balance}, to settle this purchase bill.`);
  const save = page.getByRole('button', { name: 'Save udhar' });
  await expect(hint).toBeVisible(); // nothing given yet
  await expect(save).toBeDisabled();
  await page.locator('#u-cashin').fill('1000'); // money received does not settle a purchase bill
  await expect(hint).toBeVisible();
  await expect(save).toBeDisabled();
  await page.locator('#u-cashin').fill('0');

  // more than the due -> still blocked
  await page.locator('#u-cashout').fill(String(Number(due.balance) + 1));
  await expect(hint).toBeVisible();
  await expect(save).toBeDisabled();

  // within the due -> saves, bill paid goes up by the money given
  await page.locator('#u-cashout').fill('1000');
  await expect(hint).toHaveCount(0);
  await expect(save).toBeEnabled();
  const [created] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/app/udhar') && r.request().method() === 'POST'),
    save.click(),
  ]);
  expect(created.status(), JSON.stringify(await created.json().catch(() => ''))).toBe(201);
  expect(created.request().postDataJSON()).toMatchObject({ partyId: supplier.id, settleBillId: bill.id, cashOut: 1000, cashIn: 0 });
  const txn = (await created.json()) as Txn;
  expect(txn.settleBill?.id).toBe(bill.id);
  const afterPay = await billPaid(request, token, bill.id, bid);
  expect(afterPay.paid).toBeCloseTo(1000, 2);
  expect(afterPay.balance).toBeCloseTo(start.balance - 1000, 2);

  // API: paying more than the remaining due is a 409 and changes nothing
  const over = await apiPost(request, token, '/app/udhar', { partyId: supplier.id, cashOut: afterPay.balance + 1, settleBillId: bill.id }, bid);
  expect(over.status, JSON.stringify(over.body)).toBe(409);
  expect(JSON.stringify(over.body)).toContain('Paid amount exceeds the bill due');
  expect((await billPaid(request, token, bill.id, bid)).paid).toBeCloseTo(1000, 2);

  // receipt shows the settled bill; Delete (MPIN) gives the payment back to the bill
  await expect(page.getByText(`Saved udhar #${txn.txnNo}.`)).toBeVisible();
  await page.getByRole('link', { name: 'View / print receipt' }).click();
  await page.waitForURL(new RegExp(`/app/udhari/txn/${txn.id}$`));
  await expect(page.locator('.print-area').getByRole('link', { name: bill.billNo, exact: true })).toBeVisible();
  await page.getByRole('main').getByRole('button', { name: 'Delete', exact: true }).click();
  await page.getByLabel('MPIN').fill('1234');
  const [del] = await Promise.all([
    page.waitForResponse((r) => new RegExp(`/app/udhar/${txn.id}$`).test(r.url()) && r.request().method() === 'DELETE'),
    page.getByRole('dialog').getByRole('button', { name: 'Confirm' }).click(),
  ]);
  expect([200, 204]).toContain(del.status());
  await page.waitForURL(/\/app\/udhari\/list$/);
  const restored = await billPaid(request, token, bill.id, bid);
  expect(restored.paid).toBe(0);
  expect(restored.balance).toBeCloseTo(start.balance, 2);

  // cleanup: delete the purchase bill (its stock back out)
  const rm = await request.delete(`/api/app/bills/${bill.id}?returnStock=true`, { headers: hdr(token, bid, '1234') });
  expect(rm.status()).toBe(204);
});

test('udhar receipt reprint keeps its own Old / New balance after a later udhar for the same party', async ({ page, request }) => {
  test.setTimeout(90_000);
  const token = await apiToken(request, 'demo.owner');
  await request.post('/api/auth/mpin', { headers: { Authorization: `Bearer ${token}` }, data: { password: PW, mpin: '1234' } });
  const branch = await postingBranch(request, token);
  const bid = String(branch.id);
  const party = await newParty(request, token, 'CUSTOMER', `T98 Reprint ${Date.now()}`);

  const a = await apiPost(request, token, '/app/udhar', { partyId: party.id, cashOut: 1000 }, bid);
  expect(a.status, JSON.stringify(a.body)).toBe(201);
  const txnA = a.body as Txn;
  expect(txnA.old.amount).toBe('0.00');
  expect(txnA.final.amount).toBe('1000.00');
  const b = await apiPost(request, token, '/app/udhar', { partyId: party.id, cashOut: 500 }, bid);
  expect(b.status, JSON.stringify(b.body)).toBe(201);
  const txnB = b.body as Txn;
  expect(txnB.old.amount).toBe('1000.00');
  expect(txnB.final.amount).toBe('1500.00');

  // API: A re-read after B is unchanged
  const aAgain = (await apiGet(request, token, `/app/udhar/${txnA.id}`)).body as Txn;
  expect(aAgain.old).toEqual(txnA.old);
  expect(aAgain.final).toEqual(txnA.final);

  await login(page, 'demo.owner');
  await page.waitForURL(/\/admin/);
  const rows = (label: RegExp) => page.locator('.print-area .justify-between').filter({ hasText: label });
  await page.goto(`/app/udhari/txn/${txnA.id}`);
  await expect(page.getByRole('heading', { name: `Udhar #${txnA.txnNo}` })).toBeVisible();
  await expect(rows(/^Old balance:/)).toHaveText(/^Old balance:\s*₹0\.00$/);
  await expect(rows(/^New balance/)).toHaveText(/^New balance\s*₹1000\.00$/);

  await page.goto(`/app/udhari/txn/${txnB.id}`);
  await expect(page.getByRole('heading', { name: `Udhar #${txnB.txnNo}` })).toBeVisible();
  await expect(rows(/^Old balance:/)).toHaveText(/^Old balance:\s*₹1000\.00$/);
  await expect(rows(/^New balance/)).toHaveText(/^New balance\s*₹1500\.00$/);

  // cleanup: delete both (party balance back to 0)
  for (const t of [txnB, txnA]) {
    const r = await request.delete(`/api/app/udhar/${t.id}`, { headers: hdr(token, bid, '1234') });
    expect([200, 204]).toContain(r.status());
  }
  expect(Number(((await apiGet(request, token, `/app/udhar/parties/${party.id}/balance`)).body as Bal).amount)).toBe(0);
});
