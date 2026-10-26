import { test, expect, type APIRequestContext } from '@playwright/test';
import { login, PW } from './helpers';

// T-87 Permission-Enquiry: staff requests access → admin approves → staff gains the page; reject path; subtree scoping.
// Fresh branch-users per run (unique usernames) so the dupe-guard / pre-granted state never makes a re-run flaky.
const NEWPW = 'Passw0rd!';
const rx = (s: string) => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

async function token(request: APIRequestContext, user: string, pw = PW) {
  return (await (await request.post('/api/auth/login', { data: { login: user, password: pw } })).json()).accessToken as string;
}
async function apiJson(request: APIRequestContext, tok: string, path: string, branch = 'all') {
  const r = await request.get(`/api${path}`, { headers: { Authorization: `Bearer ${tok}`, 'X-Branch-Id': branch } });
  return { status: r.status(), body: await r.json().catch(() => null) };
}
async function apiPost(request: APIRequestContext, tok: string, path: string, data: unknown, branch = 'all') {
  const r = await request.post(`/api${path}`, { headers: { Authorization: `Bearer ${tok}`, 'X-Branch-Id': branch }, data });
  return { status: r.status(), body: await r.json().catch(() => null) };
}
async function branchId(request: APIRequestContext, owner: string, name: string) {
  const ov = await apiJson(request, await token(request, owner), '/admin/overview');
  return (ov.body.branches.find((b: { branch: { name: string } }) => b.branch.name === name) ?? ov.body.branches.at(-1)).branch.id as number;
}
async function newStaff(request: APIRequestContext, ownerTok: string, label: string, branch: number) {
  const username = `e2e${label}${Date.now()}`;
  const name = `E2E ${label} ${Date.now()}`;
  const r = await apiPost(request, ownerTok, '/admin/users', { name, username, password: NEWPW, level: 'BRANCH_USER', branchId: branch });
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  return { username, name };
}

test('staff requests access → owner approves → staff gains the page', async ({ browser, request }) => {
  test.setTimeout(120_000);
  const ownerTok = await token(request, 'demo.owner');
  const kothrud = await branchId(request, 'demo.owner', 'Kothrud');
  const staff = await newStaff(request, ownerTok, 'staff', kothrud);

  // staff (no perms yet) requests Girvi view via the UI
  const sctx = await browser.newContext();
  const sp = await sctx.newPage();
  await login(sp, staff.username, NEWPW);
  await sp.waitForURL(/\/app/);
  await sp.goto('/app/access-requests');
  await sp.getByRole('button', { name: 'Request access' }).click();
  await sp.getByRole('combobox', { name: 'Page' }).click();
  await sp.getByRole('option', { name: 'Girvi · Girvi New/Return' }).click(); // View is checked by default
  await Promise.all([
    sp.waitForResponse((r) => r.url().endsWith('/app/permission-enquiries') && r.request().method() === 'POST' && r.status() === 201),
    sp.getByRole('button', { name: 'Send request' }).click(),
  ]);
  await expect(sp.getByText('PENDING')).toBeVisible();

  // owner approves via the admin UI
  const octx = await browser.newContext();
  const op = await octx.newPage();
  await login(op, 'demo.owner');
  await op.waitForURL(/\/admin/);
  await op.goto('/admin/permission-enquiries'); // defaults to the PENDING filter
  await Promise.all([
    op.waitForResponse((r) => /\/admin\/permission-enquiries\/\d+\/approve$/.test(r.url()) && r.request().method() === 'POST' && r.status() === 200),
    op.getByRole('row').filter({ hasText: staff.name }).getByRole('button', { name: 'Approve' }).click(),
  ]);
  await expect(op.getByText('Approved')).toBeVisible();

  // staff re-logs in (fresh perms) → the Girvi page is now in the nav
  const sctx2 = await browser.newContext();
  const sp2 = await sctx2.newPage();
  await login(sp2, staff.username, NEWPW);
  await sp2.waitForURL(/\/app/);
  await expect(sp2.getByRole('link', { name: 'Girvi' })).toBeVisible();

  await Promise.all([sctx.close(), octx.close(), sctx2.close()]);
});

test('owner rejects a request with a note', async ({ browser, request }) => {
  test.setTimeout(90_000);
  const ownerTok = await token(request, 'demo.owner');
  const kothrud = await branchId(request, 'demo.owner', 'Kothrud');
  const staff = await newStaff(request, ownerTok, 'rej', kothrud);
  const staffTok = await token(request, staff.username, NEWPW);
  const req = await apiPost(request, staffTok, '/app/permission-enquiries', { permissionKey: 'girvi.entry', view: true });
  expect(req.status).toBe(201);
  const id = req.body.id as number;

  const octx = await browser.newContext();
  const op = await octx.newPage();
  await login(op, 'demo.owner');
  await op.waitForURL(/\/admin/);
  await op.goto('/admin/permission-enquiries');
  await op.getByRole('row').filter({ hasText: staff.name }).getByRole('button', { name: 'Reject' }).click();
  await op.getByRole('textbox', { name: 'Rejection note' }).fill('Not for this role');
  await Promise.all([
    op.waitForResponse((r) => /\/admin\/permission-enquiries\/\d+\/reject$/.test(r.url()) && r.request().method() === 'POST' && r.status() === 200),
    op.getByRole('dialog').getByRole('button', { name: 'Reject' }).click(), // scope to dialog (row trigger shares the text)
  ]);
  await expect(op.getByText('Rejected')).toBeVisible();

  const mine = await apiJson(request, staffTok, '/app/permission-enquiries/mine');
  const row = (mine.body as Array<{ id: number; status: string; decisionNote: string | null }>).find((e) => e.id === id);
  expect(row?.status).toBe('REJECTED');
  expect(row?.decisionNote).toBe('Not for this role');
  await octx.close();
});

test('a branch-admin sees only requests from its own subtree', async ({ request }) => {
  test.setTimeout(90_000);
  const ownerTok = await token(request, 'demo.owner');
  const kothrud = await branchId(request, 'demo.owner', 'Kothrud'); // in Pune subtree
  const mumbai = await branchId(request, 'demo.owner', 'Mumbai'); // under root, OUTSIDE Pune subtree

  const inStaff = await newStaff(request, ownerTok, 'in', kothrud);
  const outStaff = await newStaff(request, ownerTok, 'out', mumbai);
  const inReq = await apiPost(request, await token(request, inStaff.username, NEWPW), '/app/permission-enquiries', { permissionKey: 'girvi.entry', view: true });
  const outReq = await apiPost(request, await token(request, outStaff.username, NEWPW), '/app/permission-enquiries', { permissionKey: 'girvi.entry', view: true });
  expect(inReq.status).toBe(201);
  expect(outReq.status).toBe(201);

  // Pune manager's pending list: includes Kothrud (subtree), excludes Mumbai (outside)
  const pune = await token(request, 'demo.pune');
  const list = await apiJson(request, pune, '/admin/permission-enquiries?status=PENDING&page=1&pageSize=100');
  const ids = (list.body.items as Array<{ id: number }>).map((e) => e.id);
  expect(ids).toContain(inReq.body.id);
  expect(ids).not.toContain(outReq.body.id);
});
