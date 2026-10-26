import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { login, PW } from './helpers';

// TASK-98 no-cash bill pay modes on a SELL bill: '+ Scheme' (redeems a matured enrollment of the party) and
// '+ Udhar advance' (uses the party's udhar credit, hint 'Credit available ₹X'). Save -> delete the bill ->
// enrollment status/redeem fields and party udhar balance are back to their pre-bill values (backend: billing/paymodes.test.ts).
const rx = (s: string) => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
const inr = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n);
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
type Enrollment = { id: number; status: string; emisPaid: number; matured: boolean; redeemValue: string | null; closedAt: string | null; maturity: { maturityValue: string } };
const enrollment = async (request: APIRequestContext, token: string, id: number) => (await apiJson(request, token, `/app/schemes/enrollments/${id}`)).body as Enrollment;
const partyAmount = async (request: APIRequestContext, token: string, partyId: number) =>
  Number(((await apiJson(request, token, `/app/udhar/parties/${partyId}/balance`)).body as { amount: string }).amount);

const CREDIT = 1500; // party's udhar credit (shop owes the party)
const EMI = 2000; // 1-month CASH scheme, 1 EMI paid -> matured, maturity value = 2000 (no bonus)
const OTHER = 20000; // direct GOLD line, rate 0 (skips the rate band), Other ₹20,000 -> ROUGH final ₹20,000

/** Fresh customer on one branch with: an udhar credit of CREDIT (cash-in) and a matured scheme enrollment worth EMI. */
async function seed(request: APIRequestContext, token: string) {
  const stamp = Date.now();
  const branch = (await apiJson(request, token, '/app/stock?page=1&pageSize=1')).body.items[0].branch as { id: number; name: string };
  const b = String(branch.id);
  const party = await apiPost(request, token, '/app/parties', { type: 'CUSTOMER', name: `T98 PayMode ${stamp}`, mobile: '8' + String(stamp).slice(-9) });
  expect(party.status, JSON.stringify(party.body)).toBe(201);
  const credit = await apiPost(request, token, '/app/udhar', { partyId: party.body.id, cashIn: CREDIT, remark: 'T98 advance' }, b);
  expect(credit.status, JSON.stringify(credit.body)).toBe(201);
  const scheme = await apiPost(request, token, '/app/schemes', { type: 'CASH', name: `E2E T98 Pay ${stamp}`, emiAmount: EMI, tenureMonths: 1, startDate: new Date().toISOString() }, b);
  expect(scheme.status, JSON.stringify(scheme.body)).toBe(201);
  const assignId = `PM${String(stamp).slice(-6)}`;
  const enr = await apiPost(request, token, '/app/schemes/enrollments', {
    schemeId: scheme.body.id, partyId: party.body.id, assignId, displayName: party.body.name, firstPayment: { amount: EMI, medium: 'CASH' },
  }, b);
  test.skip(enr.status !== 201, `could not enrol a scheme member via the API (${enr.status} ${JSON.stringify(enr.body)})`);
  const e = await enrollment(request, token, enr.body.id);
  expect(e.status).toBe('ACTIVE');
  expect(e.emisPaid).toBe(1);
  expect(e.matured).toBe(true);
  expect(Number(e.maturity.maturityValue)).toBe(EMI);
  return { branch, party: party.body as { id: number; name: string }, enrollmentId: e.id, assignId, schemeId: scheme.body.id as number };
}

/** Sell Bill (ROUGH) on the seeded branch, party picked, one direct GOLD line with Other = OTHER. */
async function startBill(page: Page, branchId: number, partyName: string) {
  await login(page, 'demo.owner');
  await page.waitForURL(/\/admin/);
  await page.goto('/app/billing?type=ROUGH');
  await page.getByRole('combobox', { name: 'Active branch' }).selectOption(String(branchId));
  await page.waitForResponse((r) => r.url().includes('/app/bills/next-no') && r.status() === 200);
  await page.getByRole('combobox', { name: 'Customer' }).click();
  await page.getByPlaceholder('Search name / mobile').fill(partyName);
  await page.waitForResponse((r) => r.url().includes('/app/parties/search'));
  await page.getByRole('option', { name: rx(partyName) }).first().click();
  await page.getByRole('button', { name: '+ Direct line' }).click();
  const line = page.locator('tbody tr').first();
  await line.getByPlaceholder('Description', { exact: true }).fill('T98 paymode ring');
  await line.locator('input[step="0.001"]').first().fill('1'); // Gross (first 0.001-step input; Less is the second)
  await line.getByRole('spinbutton', { name: 'Other', exact: true }).fill(String(OTHER));
  await expect(page.getByText(inr(OTHER)).first()).toBeVisible(); // Final
}

test('sell bill paid by Scheme + Udhar advance -> delete restores the enrollment and the party balance', async ({ page, request }) => {
  test.setTimeout(120_000);
  const token = await apiToken(request, 'demo.owner');
  await request.post('/api/auth/mpin', { headers: { Authorization: `Bearer ${token}` }, data: { password: PW, mpin: '1234' } });
  const { branch, party, enrollmentId, assignId } = await seed(request, token);
  const balBefore = await partyAmount(request, token, party.id);
  expect(balBefore).toBeCloseTo(-CREDIT, 2);
  const enrBefore = await enrollment(request, token, enrollmentId);

  await startBill(page, branch.id, party.name);

  // + Scheme: enrollment picker lists this party's open enrollment with its maturity value; picking prefills min(value, balance due)
  await page.getByRole('button', { name: '+ Scheme' }).click();
  await page.getByRole('combobox', { name: 'Scheme enrollment' }).click();
  const opt = page.getByRole('option', { name: rx(`${assignId} · `) });
  await expect(opt).toContainText(`₹${enrBefore.maturity.maturityValue}`);
  await expect(opt).not.toContainText('(early)'); // matured
  await opt.click();
  const amounts = page.getByRole('spinbutton', { name: 'Amount', exact: true });
  await expect(amounts.nth(0)).toHaveValue(String(EMI));

  // + Udhar advance: hint shows the party's credit
  await page.getByRole('button', { name: '+ Udhar advance' }).click();
  await expect(page.getByText(`Credit available ${inr(CREDIT)}`)).toBeVisible();
  await amounts.nth(1).fill('1000');

  const bodies: any[] = [];
  page.on('request', (r) => { if (r.url().endsWith('/app/bills') && r.method() === 'POST') bodies.push(r.postDataJSON()); });
  const [created] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/app/bills') && r.request().method() === 'POST'),
    page.getByRole('button', { name: 'Save sell bill' }).click(),
  ]);
  expect(created.status(), JSON.stringify(await created.json().catch(() => ''))).toBe(201);
  const bill = (await created.json()) as { id: number; billNo: string; final: string; paid: string; balance: string; payments: Array<{ mode: string; amount: string; schemeEnrollmentId?: number | null }> };
  await expect(page).toHaveURL(rx(`/app/billing/view/${bill.id}`));

  // request body + server result
  expect(bodies[0].payments).toEqual([
    expect.objectContaining({ mode: 'SCHEME', enrollmentId, amount: EMI }),
    expect.objectContaining({ mode: 'UDHAR_ADVANCE', amount: 1000 }),
  ]);
  expect(Number(bill.final)).toBe(OTHER);
  expect(Number(bill.paid)).toBe(EMI + 1000);
  expect(Number(bill.balance)).toBe(OTHER - EMI - 1000);
  expect(bill.payments.map((p) => p.mode)).toEqual(['SCHEME', 'UDHAR_ADVANCE']);
  expect(bill.payments[0]!.schemeEnrollmentId).toBe(enrollmentId);

  // enrollment redeemed into the bill; party: + final, − scheme maturity credit (no cash moved)
  const enrMid = await enrollment(request, token, enrollmentId);
  expect(enrMid.status).toBe('CLOSED');
  expect(Number(enrMid.redeemValue)).toBe(EMI);
  expect(await partyAmount(request, token, party.id)).toBeCloseTo(balBefore + OTHER - EMI, 2);

  // delete the bill from the bill list (MPIN)
  await page.goto('/app/billing/list');
  await page.waitForResponse((r) => r.url().includes('/app/bills') && r.url().includes('kind=SELL'));
  const row = page.getByRole('row').filter({ has: page.locator(`a[href="/app/billing/view/${bill.id}"]`) });
  await row.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.getByLabel('MPIN').fill('1234');
  const [del] = await Promise.all([
    page.waitForResponse((r) => new RegExp(`/app/bills/${bill.id}(\\?|$)`).test(r.url()) && r.request().method() === 'DELETE'),
    page.getByRole('button', { name: 'Delete bill' }).click(),
  ]);
  expect([200, 204]).toContain(del.status());

  // back to the pre-bill values
  const enrAfter = await enrollment(request, token, enrollmentId);
  expect(enrAfter.status).toBe(enrBefore.status);
  expect(enrAfter.redeemValue).toBe(enrBefore.redeemValue);
  expect(enrAfter.closedAt).toBe(enrBefore.closedAt);
  expect(enrAfter.emisPaid).toBe(enrBefore.emisPaid);
  expect(Number(enrAfter.maturity.maturityValue)).toBe(EMI);
  expect(await partyAmount(request, token, party.id)).toBeCloseTo(balBefore, 2);
});

test('udhar advance above the credit -> 409, no bill, nothing changes', async ({ page, request }) => {
  test.setTimeout(90_000);
  const token = await apiToken(request, 'demo.owner');
  const { branch, party, enrollmentId } = await seed(request, token);
  const balBefore = await partyAmount(request, token, party.id);

  // API: one rupee over the credit
  const over = await apiPost(request, token, '/app/bills', {
    kind: 'SELL', billType: 'ROUGH', partyId: party.id,
    items: [{ description: 'T98 over', stockClass: 'GOLD', gross: 1, other: OTHER }],
    payments: [{ mode: 'UDHAR_ADVANCE', amount: CREDIT + 1 }],
  }, String(branch.id));
  expect(over.status, JSON.stringify(over.body)).toBe(409);

  // UI: same over-use -> 409, form stays (no navigation to the bill view)
  await startBill(page, branch.id, party.name);
  await page.getByRole('button', { name: '+ Udhar advance' }).click();
  await expect(page.getByText(`Credit available ${inr(CREDIT)}`)).toBeVisible();
  await page.getByRole('spinbutton', { name: 'Amount', exact: true }).fill(String(CREDIT + 1));
  const [resp] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/app/bills') && r.request().method() === 'POST'),
    page.getByRole('button', { name: 'Save sell bill' }).click(),
  ]);
  expect(resp.status()).toBe(409);
  await expect(page).not.toHaveURL(/\/app\/billing\/view\//);

  expect(await partyAmount(request, token, party.id)).toBeCloseTo(balBefore, 2);
  expect((await enrollment(request, token, enrollmentId)).status).toBe('ACTIVE');
  const bills = (await apiJson(request, token, `/app/bills?kind=SELL&partyId=${party.id}&page=1&pageSize=5`)).body as { total: number };
  expect(bills.total).toBe(0);
});
