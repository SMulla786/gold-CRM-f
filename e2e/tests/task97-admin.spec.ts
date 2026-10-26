import { expect, test, type APIRequestContext } from '@playwright/test';
import { login, PW } from './helpers';

// TASK-96/97 admin: users (auto-generate + MPIN on create, trash/restore, Set MPIN), roles (rename/delete),
// counters (add/rename/filter), branch dialog detail fields, My account (change password / set MPIN).
// NOTE: creates one staff user + one counter per run (no delete API for either); the role is deleted again.
const loginApi = (request: APIRequestContext, user: string, pw: string) => request.post('/api/auth/login', { data: { login: user, password: pw } });
async function apiToken(request: APIRequestContext, user: string): Promise<string> {
  return (await (await loginApi(request, user, PW)).json()).accessToken as string;
}
const hdr = (token: string) => ({ Authorization: `Bearer ${token}`, 'X-Branch-Id': 'all' });
const getJson = async (request: APIRequestContext, token: string, path: string) => (await request.get(`/api${path}`, { headers: hdr(token) })).json();
const rx = (s: string) => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

async function ownerOn(page: import('@playwright/test').Page, path: string) {
  await login(page, 'demo.owner');
  await page.waitForURL(/\/admin/);
  await page.goto(path);
}

test.describe.serial('users: create (auto-generate) -> trash/restore -> Set MPIN -> staff My account', () => {
  const stamp = Date.now();
  const name = `T97 Staff ${stamp}`;
  let username = '';
  let password = '';

  test('New user: Auto-generate fills valid credentials; created dialog shows them', async ({ page }) => {
    await ownerOn(page, '/admin/users');
    await page.getByRole('button', { name: 'New user' }).click();
    await page.locator('#u-name').fill(name);
    await page.getByRole('button', { name: 'Auto-generate' }).click();
    username = await page.locator('#u-user').inputValue();
    password = await page.locator('#u-pass').inputValue();
    expect(username).toMatch(/^t97\.staff\.\d+\.[2-9]{4}$/);
    expect(username).toMatch(/^[a-z0-9._-]{3,40}$/);
    expect(password).toMatch(/^[a-km-zA-HJ-NP-Z2-9]{10}$/); // no 0/O/1/l/I
    await page.locator('#u-mpin').fill('2468');
    await page.getByRole('combobox', { name: 'Branch' }).click();
    await page.getByRole('option').first().click();
    const [resp] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith('/admin/users') && r.request().method() === 'POST'),
      page.getByRole('button', { name: 'Create user' }).click(),
    ]);
    expect(resp.status(), JSON.stringify(await resp.json().catch(() => ''))).toBe(201);
    const dlg = page.getByRole('dialog', { name: 'User created' });
    await expect(dlg).toContainText(username);
    await expect(dlg).toContainText(password);
    await expect(dlg).toContainText('/login');
    await expect(dlg.getByRole('button', { name: 'Copy login details' })).toBeVisible();
    await dlg.getByRole('button', { name: 'Done' }).click();
    expect((await loginApi(page.request, username, password)).status()).toBe(200);
  });

  test('Move to trash blocks login and counts in Trash; Restore re-enables it', async ({ page, request }) => {
    const token = await apiToken(request, 'demo.owner');
    const trashBefore = (await getJson(request, token, '/admin/users?status=DELETED&pageSize=1')).total as number;
    await ownerOn(page, '/admin/users');
    await page.getByRole('textbox', { name: 'Search users' }).fill(username);
    const row = page.getByRole('row').filter({ hasText: username });
    await expect(row).toHaveCount(1);
    await row.getByRole('button', { name: 'Actions' }).click();
    page.once('dialog', (d) => void d.accept()); // window.confirm
    const [del] = await Promise.all([
      page.waitForResponse((r) => /\/admin\/users\/\d+$/.test(r.url()) && r.request().method() === 'DELETE'),
      page.getByRole('menuitem', { name: 'Move to trash' }).click(),
    ]);
    expect([200, 204]).toContain(del.status());
    expect((await loginApi(request, username, password)).status()).not.toBe(200);
    expect((await getJson(request, token, '/admin/users?status=DELETED&pageSize=1')).total).toBe(trashBefore + 1);
    await expect(row).toHaveCount(0); // All tab excludes trash

    await page.getByRole('tab', { name: /^Trash/ }).click();
    await expect(row).toHaveCount(1);
    await row.getByRole('button', { name: 'Actions' }).click();
    const [res] = await Promise.all([
      page.waitForResponse((r) => /\/admin\/users\/\d+\/restore$/.test(r.url()) && r.request().method() === 'POST'),
      page.getByRole('menuitem', { name: 'Restore' }).click(),
    ]);
    expect([200, 204]).toContain(res.status());
    expect((await loginApi(request, username, password)).status()).toBe(200);
  });

  test('Set MPIN from Users posts reset-mpin', async ({ page }) => {
    await ownerOn(page, '/admin/users');
    await page.getByRole('textbox', { name: 'Search users' }).fill(username);
    const row = page.getByRole('row').filter({ hasText: username });
    await row.getByRole('button', { name: 'Actions' }).click();
    await page.getByRole('menuitem', { name: 'Set MPIN' }).click();
    const dlg = page.getByRole('dialog', { name: rx(`Set MPIN · ${name}`) });
    await expect(dlg.getByRole('button', { name: 'Set MPIN' })).toBeDisabled();
    await page.locator('#r-mpin').fill('1357');
    const [resp] = await Promise.all([
      page.waitForResponse((r) => /\/admin\/users\/\d+\/reset-mpin$/.test(r.url()) && r.request().method() === 'POST'),
      dlg.getByRole('button', { name: 'Set MPIN' }).click(),
    ]);
    expect([200, 204]).toContain(resp.status());
  });

  test('staff opens My account from the header; MPIN mismatch / wrong password rejected; change password works', async ({ page, request }) => {
    await login(page, username, password);
    await page.waitForURL(/\/app/);
    await page.getByRole('link', { name: rx(`My account (${name})`) }).click();
    await page.waitForURL(/\/app\/account$/);
    await expect(page.getByRole('heading', { name: 'My account' })).toBeVisible();
    await expect(page.getByText(username, { exact: true })).toBeVisible();

    // MPIN (has one from create/reset -> "Change MPIN")
    await page.locator('#mpin-password').fill(password);
    await page.locator('#mpin-new').fill('1111');
    await page.locator('#mpin-confirm').fill('2222');
    await page.getByRole('button', { name: /^(Change|Set) MPIN$/ }).click();
    await expect(page.getByText("MPINs don't match")).toBeVisible();
    await page.locator('#mpin-password').fill('wrong-password-1');
    await page.locator('#mpin-confirm').fill('1111');
    const [bad] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith('/auth/mpin') && r.request().method() === 'POST'),
      page.getByRole('button', { name: /^(Change|Set) MPIN$/ }).click(),
    ]);
    expect(bad.status()).toBeGreaterThanOrEqual(400);
    await page.locator('#mpin-password').fill(password);
    const [ok] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith('/auth/mpin') && r.request().method() === 'POST'),
      page.getByRole('button', { name: /^(Change|Set) MPIN$/ }).click(),
    ]);
    expect([200, 204]).toContain(ok.status());

    // password: mismatch, wrong current, then success
    const next = `T97new${String(stamp).slice(-6)}!`;
    await page.locator('#pw-current').fill(password);
    await page.locator('#pw-next').fill(next);
    await page.locator('#pw-confirm').fill(`${next}x`);
    await page.getByRole('button', { name: 'Change password' }).click();
    await expect(page.getByText("Passwords don't match")).toBeVisible();
    await page.locator('#pw-confirm').fill(next);
    await page.locator('#pw-current').fill('wrong-password-1');
    const [badPw] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith('/auth/password') && r.request().method() === 'POST'),
      page.getByRole('button', { name: 'Change password' }).click(),
    ]);
    expect(badPw.status()).toBeGreaterThanOrEqual(400);
    await page.locator('#pw-current').fill(password);
    await page.locator('#pw-next').fill(next);
    await page.locator('#pw-confirm').fill(next);
    const [okPw] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith('/auth/password') && r.request().method() === 'POST'),
      page.getByRole('button', { name: 'Change password' }).click(),
    ]);
    expect([200, 204]).toContain(okPw.status());
    await expect(page).toHaveURL(/\/app\/account$/); // this session stays signed in
    expect((await loginApi(request, username, password)).status()).not.toBe(200);
    expect((await loginApi(request, username, next)).status()).toBe(200);
  });
});

test('roles: create -> search -> rename -> delete (business role)', async ({ page, request }) => {
  const role = `T97 Role ${Date.now()}`;
  await ownerOn(page, '/admin/roles');
  await page.getByRole('button', { name: 'New role' }).click();
  await page.locator('#role-name').fill(role);
  await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/admin/roles') && r.request().method() === 'POST' && r.status() === 201),
    page.getByRole('dialog').getByRole('button', { name: 'Create' }).click(),
  ]);
  await page.getByRole('textbox', { name: 'Search roles' }).fill(role);
  const row = page.getByRole('row').filter({ hasText: role });
  await expect(row).toHaveCount(1);
  await expect(page.getByRole('row').filter({ hasText: 'Business' })).toHaveCount(1); // only the searched role left

  await row.getByRole('button', { name: 'Rename' }).click();
  await expect(page.getByRole('dialog', { name: `Rename ${role}` })).toBeVisible();
  await page.locator('#role-name').fill(`${role} R`);
  const [ren] = await Promise.all([
    page.waitForResponse((r) => /\/admin\/roles\/\d+$/.test(r.url()) && r.request().method() === 'PATCH'),
    page.getByRole('dialog').getByRole('button', { name: 'Save' }).click(),
  ]);
  expect(ren.status()).toBe(200);
  const renamed = page.getByRole('row').filter({ hasText: `${role} R` });
  await expect(renamed).toHaveCount(1);

  page.once('dialog', (d) => void d.accept());
  const [del] = await Promise.all([
    page.waitForResponse((r) => /\/admin\/roles\/\d+$/.test(r.url()) && r.request().method() === 'DELETE'),
    renamed.getByRole('button', { name: 'Delete' }).click(),
  ]);
  expect([200, 204]).toContain(del.status());
  await expect(renamed).toHaveCount(0);
  const token = await apiToken(request, 'demo.owner');
  expect((await getJson(request, token, '/admin/roles') as Array<{ name: string }>).some((r) => r.name.startsWith(role))).toBe(false);
});

test('roles: system roles have no Rename/Delete; in-use business role Delete is disabled', async ({ page }) => {
  await ownerOn(page, '/admin/roles');
  const system = page.getByRole('row').filter({ hasText: 'System' }).first();
  await expect(system).toBeVisible();
  await expect(system.getByRole('button', { name: 'Rename' })).toHaveCount(0);
  await expect(system.getByRole('button', { name: 'Delete' })).toHaveCount(0);
});

test('counters: add -> rename -> filter by branch', async ({ page, request }) => {
  const token = await apiToken(request, 'demo.owner');
  const root = await getJson(request, token, '/admin/branches');
  const branchName = root.name as string;
  const cname = `T97 C${String(Date.now()).slice(-6)}`;
  await ownerOn(page, '/admin/counters');
  await page.getByRole('combobox', { name: 'Counter branch' }).click();
  await page.getByRole('option', { name: branchName, exact: true }).click();
  await page.locator('#c-name').fill(cname);
  const [add] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/admin/counters') && r.request().method() === 'POST'),
    page.getByRole('button', { name: 'Add counter' }).click(),
  ]);
  expect(add.status(), JSON.stringify(await add.json().catch(() => ''))).toBe(201);
  await expect(page.getByRole('button', { name: `Rename ${cname}` })).toBeVisible();

  await page.getByRole('button', { name: `Rename ${cname}` }).click();
  await page.locator('#c-rename').fill(`${cname}R`);
  const [ren] = await Promise.all([
    page.waitForResponse((r) => /\/admin\/counters\/\d+$/.test(r.url()) && r.request().method() === 'PATCH'),
    page.getByRole('dialog').getByRole('button', { name: 'Save' }).click(),
  ]);
  expect(ren.status()).toBe(200);
  await expect(page.getByRole('button', { name: `Rename ${cname}R` })).toBeVisible();

  await page.getByRole('combobox', { name: 'Filter by branch' }).click();
  await Promise.all([
    page.waitForResponse((r) => r.url().includes('/admin/counters?') && r.url().includes(`branchId=${root.id}`)),
    page.getByRole('option', { name: branchName, exact: true }).click(),
  ]);
  await expect(page.getByRole('button', { name: `Rename ${cname}R` })).toBeVisible();
});

test('branch Edit dialog: invalid mobile/GSTIN errors, new detail fields save and pre-fill on reopen', async ({ page, request }) => {
  const token = await apiToken(request, 'demo.owner');
  type Node = { id: number; name: string; parentId: number | null; children?: Node[]; inchargeName?: string | null; mobile?: string | null; gstin?: string | null; stateId?: number | null; districtId?: number | null; address?: string | null; disclaimer?: string | null; countryCode?: string | null };
  const flat = (n: Node): Node[] => [n, ...(n.children ?? []).flatMap(flat)];
  const nodes = flat(await getJson(request, token, '/admin/branches'));
  const target = nodes.filter((n) => n.parentId !== null).at(-1)!; // a leaf-ish branch, not the business root
  expect(target, 'demo data must have a sub-branch').toBeTruthy();
  const orig = { inchargeName: target.inchargeName, mobile: target.mobile, gstin: target.gstin, stateId: target.stateId, districtId: target.districtId, address: target.address, disclaimer: target.disclaimer, countryCode: target.countryCode };

  try {
    await ownerOn(page, '/admin/branches');
    await page.getByRole('textbox', { name: 'Search branch name' }).fill(target.name);
    const rowOf = page.locator('div.border-b').filter({ has: page.getByText(target.name, { exact: true }) }).last();
    await rowOf.getByRole('button', { name: 'Actions' }).click();
    await page.getByRole('menuitem', { name: 'Edit' }).click();
    const dlg = page.getByRole('dialog', { name: `Edit ${target.name}` });
    await expect(dlg).toBeVisible();
    await expect(dlg.getByRole('combobox', { name: 'Country code' })).toBeVisible();

    // invalid values -> field errors, no PATCH
    let patched = false;
    page.on('request', (r) => { if (r.method() === 'PATCH' && /\/admin\/branches\/\d+$/.test(r.url())) patched = true; });
    await page.locator('#b-mobile').fill('12345');
    await page.locator('#b-gstin').fill('NOTAGSTIN');
    await dlg.getByRole('button', { name: 'Save' }).click();
    await expect(dlg.getByText('10-digit mobile number')).toBeVisible();
    await expect(dlg.getByText('Invalid GSTIN')).toBeVisible();
    expect(patched).toBe(false);

    // valid values
    const stamp = String(Date.now()).slice(-5);
    await page.locator('#b-incharge').fill(`T97 Incharge ${stamp}`);
    await page.locator('#b-mobile').fill('9876543210');
    await page.locator('#b-gstin').fill('27abcde1234f1z5'); // uppercased on save
    await dlg.getByRole('combobox', { name: 'State' }).click();
    await page.getByRole('option').first().click();
    await dlg.getByRole('combobox', { name: 'District' }).click();
    await page.getByRole('option').first().click();
    await page.locator('#b-address').fill(`T97 address ${stamp}`);
    await page.locator('#b-disclaimer').fill(`T97 disclaimer ${stamp}`);
    const [resp] = await Promise.all([
      page.waitForResponse((r) => new RegExp(`/admin/branches/${target.id}$`).test(r.url()) && r.request().method() === 'PATCH'),
      dlg.getByRole('button', { name: 'Save' }).click(),
    ]);
    expect(resp.status(), JSON.stringify(await resp.json().catch(() => ''))).toBe(200);

    const saved = flat(await getJson(request, token, '/admin/branches')).find((n) => n.id === target.id)!;
    expect(saved.inchargeName).toBe(`T97 Incharge ${stamp}`);
    expect(saved.mobile).toBe('9876543210');
    expect(saved.gstin).toBe('27ABCDE1234F1Z5');
    expect(saved.stateId).toBeTruthy();
    expect(saved.districtId).toBeTruthy();
    expect(saved.disclaimer).toBe(`T97 disclaimer ${stamp}`);

    // row shows the contact line; reopening Edit pre-fills
    await expect(rowOf).toContainText(`T97 Incharge ${stamp}`);
    await rowOf.getByRole('button', { name: 'Actions' }).click();
    await page.getByRole('menuitem', { name: 'Edit' }).click();
    await expect(page.locator('#b-incharge')).toHaveValue(`T97 Incharge ${stamp}`);
    await expect(page.locator('#b-mobile')).toHaveValue('9876543210');
    await expect(page.locator('#b-gstin')).toHaveValue('27ABCDE1234F1Z5');
    await expect(page.locator('#b-address')).toHaveValue(`T97 address ${stamp}`);
    await expect(page.locator('#b-disclaimer')).toHaveValue(`T97 disclaimer ${stamp}`);
  } finally {
    // shortcut: contract has no nullable fields, so values that were empty before stay set (only non-empty originals are restored)
    const restore = Object.fromEntries(Object.entries(orig).filter(([, v]) => v != null && v !== ''));
    if (Object.keys(restore).length) await request.patch(`/api/admin/branches/${target.id}`, { headers: hdr(token), data: restore });
  }
});
