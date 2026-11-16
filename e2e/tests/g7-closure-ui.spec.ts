import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

import { login, pwFor } from './helpers'

// G7 closure (frontend): the UI offers only what the API accepts, says why when it refuses, and keeps what was saved.
// Real stack (isolated E2E DB), demo.owner (owner, ADMIN) + superadmin. Data this spec leaves behind on purpose:
// one inactive sub-branch 'G7 Closure Inactive' under Pune (found by name and reused; under Pune so no spec that picks
// the last branch by path changes target) and the root branch's incharge name. Everything else is restored or deleted
// again (business district, one party, one karat); bill deletes and the impersonation end failure are route-mocked.

const MPIN = '1234'
const INACTIVE = 'G7 Closure Inactive'

type Json = Record<string, unknown> & { id?: number }
type Node = { id: number; name: string; parentId: number | null; isActive: boolean; children: Node[] }
const flat = (n: Node): Node[] => [n, ...n.children.flatMap(flat)]

async function apiToken(request: APIRequestContext, user: string): Promise<string> {
  const r = await request.post('/api/auth/login', { data: { login: user, password: pwFor(user) } })
  expect(r.status(), `API login ${user}`).toBe(200)
  return (await r.json()).accessToken as string
}
async function api(request: APIRequestContext, method: 'get' | 'post' | 'patch' | 'delete', token: string, path: string, data?: unknown, mpin?: string) {
  const headers = { Authorization: `Bearer ${token}`, 'X-Branch-Id': 'all', ...(mpin ? { 'X-MPIN': mpin } : {}) }
  const r = await request[method](`/api${path}`, { headers, data })
  return { status: r.status(), body: (await r.json().catch(() => null)) as Json & Json[] }
}

/** helpers.login only submits the form: wait until the account's home area has loaded, then open `path` (full load). */
async function signedIn(page: Page, user: string, home: RegExp, path?: string) {
  await login(page, user)
  await expect(page).toHaveURL(home, { timeout: 20_000 })
  if (path) await page.goto(path)
}
const ownerOn = (page: Page, path: string) => signedIn(page, 'demo.owner', /\/admin/, path)

async function geo(request: APIRequestContext, token: string) {
  const states = (await api(request, 'get', token, '/public/states')).body as unknown as { id: number; name: string }[]
  const mh = states.find((s) => s.name === 'MAHARASHTRA')!
  const goa = states.find((s) => s.name === 'GOA')!
  const mhDistricts = (await api(request, 'get', token, `/public/states/${mh.id}/districts`)).body as unknown as { id: number; name: string }[]
  const goaDistricts = (await api(request, 'get', token, `/public/states/${goa.id}/districts`)).body as unknown as { id: number; name: string }[]
  return { mh, goa, pune: mhDistricts.find((d) => d.name === 'Pune')!, goaDistricts }
}

test('root branch: Edit saves its details; its admin-node / active status is neither offered nor sent (the API refuses both)', async ({ page }) => {
  await ownerOn(page, '/admin/branches')
  await page.getByRole('textbox', { name: 'Search branch name' }).fill('Demo HQ')
  const row = page.locator('div.border-b').filter({ has: page.getByText('Demo HQ', { exact: true }) }).first()
  const openEdit = async () => {
    await row.getByRole('button', { name: 'Actions' }).click()
    await page.getByRole('menuitem', { name: 'Edit' }).click()
    const dlg = page.getByRole('dialog', { name: 'Edit Demo HQ' })
    await expect(dlg.locator('#b-name')).toHaveValue('Demo HQ')
    return dlg
  }
  let dlg = await openEdit()
  await dlg.locator('#b-incharge').fill('G7 Closure Incharge')
  const [resp] = await Promise.all([
    page.waitForResponse((r) => /\/api\/admin\/branches\/\d+$/.test(r.url()) && r.request().method() === 'PATCH'),
    dlg.getByRole('button', { name: 'Save' }).click(),
  ])
  expect(resp.status(), await resp.text()).toBe(200)
  expect(resp.request().postDataJSON()).not.toHaveProperty('isActive')
  expect(resp.request().postDataJSON()).not.toHaveProperty('isAdminNode')
  await expect(dlg).toHaveCount(0)

  dlg = await openEdit()
  await expect(dlg.locator('#b-incharge')).toHaveValue('G7 Closure Incharge')
  await expect(dlg.getByText('Active', { exact: true })).toHaveCount(0)
  await expect(dlg.getByText(/Branch-admin node/)).toHaveCount(0)
})

test('Business profile: a state offers only its LGD districts, a state change clears the district, the district survives save + reload', async ({ page, request }) => {
  const token = await apiToken(request, 'demo.owner')
  const g = await geo(request, token)
  const before = (await api(request, 'get', token, '/admin/business')).body as { stateId: number | null; districtId: number | null }
  try {
    await ownerOn(page, '/admin/business')
    const state = page.getByRole('combobox', { name: 'State' })
    const district = page.getByRole('combobox', { name: 'District' })
    await expect(page.locator('#p-name')).not.toHaveValue('')
    await state.click()
    await page.getByRole('option', { name: 'GOA', exact: true }).click()
    await district.click()
    await expect(page.getByRole('option')).toHaveCount(g.goaDistricts.length)
    await expect(page.getByRole('option', { name: 'Pune', exact: true })).toHaveCount(0)
    await page.keyboard.press('Escape')
    await state.click()
    await page.getByRole('option', { name: 'MAHARASHTRA', exact: true }).click()
    await expect(district).toHaveText('Select district') // changing the state cleared the district
    await district.click()
    await page.getByRole('option', { name: 'Pune', exact: true }).click()
    const [resp] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith('/api/admin/business') && r.request().method() === 'PATCH'),
      page.getByRole('button', { name: 'Save changes' }).click(),
    ])
    expect(resp.status(), await resp.text()).toBe(200)
    expect(resp.request().postDataJSON()).toMatchObject({ stateId: g.mh.id, districtId: g.pune.id })

    await page.reload()
    await expect(page.getByRole('combobox', { name: 'State' })).toHaveText('MAHARASHTRA')
    await expect(page.getByRole('combobox', { name: 'District' })).toHaveText('Pune')
  } finally {
    // back to the seeded geo: a state change that names no district clears the district (lib/geo checkedGeo)
    if (before.stateId != null && before.districtId == null) {
      await api(request, 'patch', token, '/admin/business', { stateId: before.stateId === g.goa.id ? g.mh.id : g.goa.id })
      await api(request, 'patch', token, '/admin/business', { stateId: before.stateId })
    } else if (before.stateId != null) await api(request, 'patch', token, '/admin/business', { stateId: before.stateId, districtId: before.districtId })
  }
})

test('party form: the district of the chosen state survives create + reopen; changing the state clears it', async ({ page, request }) => {
  const token = await apiToken(request, 'demo.owner')
  const g = await geo(request, token)
  const stamp = Date.now()
  const name = `G7C Party ${stamp}`
  let partyId: number | undefined
  try {
    await ownerOn(page, '/app/settings/parties')
    await page.getByRole('button', { name: 'New party' }).click()
    const dlg = page.getByRole('dialog', { name: 'New party' })
    await dlg.getByLabel('Mobile', { exact: true }).fill(`9${String(stamp).slice(-9)}`)
    await dlg.getByLabel('Full name', { exact: true }).fill(name)
    await dlg.getByRole('combobox', { name: 'State' }).click()
    await page.getByRole('option', { name: 'MAHARASHTRA', exact: true }).click()
    await dlg.getByRole('combobox', { name: 'District' }).click()
    await page.getByRole('option', { name: 'Pune', exact: true }).click()
    const [resp] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith('/api/app/parties') && r.request().method() === 'POST'),
      dlg.getByRole('button', { name: 'Create party' }).click(),
    ])
    expect(resp.ok(), await resp.text()).toBe(true)
    partyId = ((await resp.json()) as { id: number }).id
    expect(resp.request().postDataJSON()).toMatchObject({ stateId: g.mh.id, districtId: g.pune.id })

    await page.reload()
    await page.getByPlaceholder('Search name / mobile / shop…').fill(name)
    await page.getByRole('row').filter({ hasText: name }).getByRole('button', { name: 'Edit' }).click()
    const edit = page.getByRole('dialog', { name: `Edit ${name}` })
    await expect(edit.getByRole('combobox', { name: 'State' })).toHaveText('MAHARASHTRA')
    await expect(edit.getByRole('combobox', { name: 'District' })).toHaveText('Pune')
    await edit.getByRole('combobox', { name: 'State' }).click()
    await page.getByRole('option', { name: 'GOA', exact: true }).click()
    await expect(edit.getByRole('combobox', { name: 'District' })).toHaveText('Select district')
  } finally {
    if (partyId) await api(request, 'delete', token, `/app/parties/${partyId}?confirm=true`) // unused party: deleted for good
  }
})

/** The dedicated inactive sub-branch (under Pune), created once and kept inactive. */
async function inactiveBranch(request: APIRequestContext, token: string): Promise<number> {
  const all = flat((await api(request, 'get', token, '/admin/branches')).body as unknown as Node)
  let id = all.find((b) => b.name === INACTIVE)?.id
  if (id == null) {
    const created = await api(request, 'post', token, '/admin/branches', { name: INACTIVE, parentId: all.find((b) => b.name === 'Pune')!.id })
    expect(created.status, JSON.stringify(created.body)).toBe(201)
    id = created.body.id!
  }
  const off = await api(request, 'patch', token, `/admin/branches/${id}`, { isActive: false })
  expect(off.status, JSON.stringify(off.body)).toBe(200)
  return id
}

test('inactive branch: marked in the switcher, every store page says new entries are refused, new-entry pickers leave it out; Admin → Branches reactivates it', async ({ page, request }) => {
  test.setTimeout(90_000) // one journey across six pages
  const token = await apiToken(request, 'demo.owner')
  const id = await inactiveBranch(request, token)
  const notice = page.getByText(`${INACTIVE} is inactive`)
  try {
    await ownerOn(page, '/app/billing')
    const switcher = page.getByRole('combobox', { name: 'Active branch' })
    await expect(switcher.locator(`option[value="${id}"]`)).toHaveText(/G7 Closure Inactive \(inactive\)/)
    await switcher.selectOption(String(id))
    // a transaction page asks for an active branch; its picker leaves the inactive one out
    const pick = page.getByRole('combobox', { name: 'Branch for this transaction' })
    await expect(pick).toBeVisible()
    await expect(pick.locator(`option[value="${id}"]`)).toHaveCount(0)
    // the API refuses every store write on this branch (403 BRANCH_INACTIVE): every store page says so up front
    await expect(notice).toBeVisible()
    await page.locator('nav a[href="/app/settings"]').first().click() // in-app: the branch choice is kept
    await expect(page).toHaveURL(/\/app\/settings/)
    await expect(notice).toBeVisible()
    // the bank-account branch picker (3577c9f) and the stock-transfer pickers (d71ae13) leave it out as well
    await page.locator('a[href="/app/settings/bank-accounts"]').click()
    await page.getByRole('button', { name: 'New bank account' }).click()
    await page.getByRole('combobox', { name: 'Applies to branch' }).click()
    await expect(page.getByRole('option', { name: /Kothrud/ })).toHaveCount(1)
    await expect(page.getByRole('option', { name: /G7 Closure Inactive/ })).toHaveCount(0)
    await page.keyboard.press('Escape')
    await page.keyboard.press('Escape')
    await page.locator('nav a[href="/app/inventory"]').first().click()
    await page.locator('a[href="/app/inventory/transfers"]').click()
    await page.getByRole('button', { name: 'New transfer' }).click()
    for (const side of ['From branch', 'To branch']) {
      await page.getByRole('combobox', { name: side }).click()
      await expect(page.getByRole('option', { name: 'Kothrud' })).toHaveCount(1)
      await expect(page.getByRole('option', { name: INACTIVE })).toHaveCount(0)
      await page.keyboard.press('Escape')
    }
    await expect(notice).toBeVisible()

    // reactivate in Admin → Branches
    await page.goto('/admin/branches')
    await page.getByRole('textbox', { name: 'Search branch name' }).fill(INACTIVE)
    await page.locator('div.border-b').filter({ has: page.getByText(INACTIVE, { exact: true }) }).getByRole('button', { name: 'Actions' }).click()
    await page.getByRole('menuitem', { name: 'Edit' }).click()
    const dlg = page.getByRole('dialog', { name: `Edit ${INACTIVE}` })
    await dlg.getByText('Active', { exact: true }).click()
    const [resp] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith(`/api/admin/branches/${id}`) && r.request().method() === 'PATCH'),
      dlg.getByRole('button', { name: 'Save' }).click(),
    ])
    expect(resp.status(), await resp.text()).toBe(200)
    expect(resp.request().postDataJSON()).toMatchObject({ isActive: true })

    await page.goto('/app/billing')
    await expect(switcher.locator(`option[value="${id}"]`)).not.toHaveText(/inactive/)
    await switcher.selectOption(String(id))
    await expect(page.getByRole('combobox', { name: 'Branch for this transaction' })).toHaveCount(0) // the bill form opens on it
    await expect(notice).toHaveCount(0)
  } finally {
    await api(request, 'patch', token, `/admin/branches/${id}`, { isActive: false })
  }
})

test('girvi transfer: Transfer items stays disabled until a branch is picked (on All branches the API refuses it)', async ({ page }) => {
  await ownerOn(page, '/app/girvi/transfers')
  await page.getByRole('button', { name: 'New transfer' }).click()
  const dlg = page.getByRole('dialog', { name: 'Transfer girvi items to a lender' })
  const pick = dlg.getByRole('combobox', { name: 'Branch for this transaction' })
  await expect(pick).toBeVisible()
  await dlg.getByRole('combobox', { name: 'Lender' }).click()
  await Promise.all([page.waitForResponse((r) => r.url().includes('/api/app/parties/search')), page.getByPlaceholder('Search lender…').fill('a')])
  await page.getByRole('option', { name: / · / }).first().click()
  await dlg.getByRole('button', { name: /^#\d+/ }).first().click()
  await dlg.getByRole('checkbox', { name: /^Select / }).first().click()
  await dlg.locator('#gt-principal').fill('1000')
  await dlg.locator('#gt-cash').fill('1000')
  const go = dlg.getByRole('button', { name: 'Transfer items' })
  await expect(go).toBeDisabled()
  await pick.selectOption({ label: 'Demo HQ' })
  await expect(pick).toHaveCount(0)
  await expect(go).toBeEnabled()
})

test("bill delete: an order's bill offers no 'Delete only' and always returns the stock; a plain bill keeps both options", async ({ page, request }) => {
  const token = await apiToken(request, 'demo.owner')
  const bills = (await api(request, 'get', token, '/app/bills?kind=SELL&status=ACTIVE&page=1&pageSize=100')).body.items as unknown as { id: number; billNo: string; orderId?: number | null }[]
  const orderBill = bills.find((b) => b.orderId != null)
  const plainBill = bills.find((b) => b.orderId == null)
  expect(orderBill, 'the E2E data must hold an active bill that delivers an order').toBeTruthy()
  expect(plainBill, 'the E2E data must hold an active plain sell bill').toBeTruthy()
  // the DELETE is answered here (nothing is deleted): only what the UI sends is under test
  const sent: string[] = []
  await page.route(/\/api\/app\/bills\/\d+\?returnStock=/, async (route) => {
    sent.push(route.request().url())
    await route.fulfill({ status: 204 })
  })

  const openDelete = async (bill: { id: number; billNo: string }) => {
    await page.getByPlaceholder('Search bill / party / mobile…').fill(bill.billNo)
    const row = page.getByRole('row').filter({ has: page.locator(`a[href="/app/billing/view/${bill.id}"]`) })
    await row.getByRole('button', { name: 'Delete' }).click()
    const dlg = page.getByRole('dialog', { name: `Delete ${bill.billNo}?` })
    await expect(dlg).toBeVisible()
    return dlg
  }
  await ownerOn(page, '/app/billing/list')

  let dlg = await openDelete(orderBill!)
  await expect(dlg).toContainText('This bill delivers an order: deleting it puts the items back in stock')
  await expect(dlg.getByRole('combobox', { name: 'Stock handling' })).toHaveCount(0)
  await dlg.locator('#del-mpin').fill(MPIN)
  await dlg.getByRole('button', { name: 'Delete bill' }).click()
  await expect(dlg).toHaveCount(0)
  expect(sent.pop()).toContain(`/api/app/bills/${orderBill!.id}?returnStock=true`)

  dlg = await openDelete(plainBill!)
  await expect(dlg).not.toContainText('delivers an order')
  await dlg.getByRole('combobox', { name: 'Stock handling' }).click()
  await expect(page.getByRole('option')).toHaveText(['Item Return — put items back in stock', 'Delete Only — leave stock as is'])
  await page.getByRole('option', { name: 'Delete Only — leave stock as is' }).click()
  await dlg.locator('#del-mpin').fill(MPIN)
  await dlg.getByRole('button', { name: 'Delete bill' }).click()
  await expect(dlg).toHaveCount(0)
  expect(sent.pop()).toContain(`/api/app/bills/${plainBill!.id}?returnStock=false`)
})

test('impersonation End: when the server cannot close the support session the Super Admin is back AND told so', async ({ page, request }) => {
  await impersonateDemo(page, 'G7 closure: end-failure message')
  try {
    await page.route('**/api/auth/impersonation/end', (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: { code: 'INTERNAL', message: 'simulated failure' } }) }),
    )
    await page.getByRole('button', { name: 'End' }).click()
    await expect(page).toHaveURL(/\/platform/)
    await expect(page.getByText(/Viewing as/)).toHaveCount(0)
    await expect(page.getByText(/could not close the support session/i)).toBeVisible()
  } finally {
    // close it for real (the mocked call never reached the server): the Super Admin ends his own impersonations
    await api(request, 'post', await apiToken(request, 'superadmin'), '/platform/impersonation/end')
  }
})

/** Super Admin → Demo Jewellers' owner in this tab (the impersonation token lives in memory: navigate in-app only). */
async function impersonateDemo(page: Page, reason: string) {
  await signedIn(page, 'superadmin', /\/platform/, '/platform/businesses')
  await page.getByRole('link', { name: 'Demo Jewellers' }).first().click()
  await page.getByRole('button', { name: 'Login as owner' }).click()
  await page.getByLabel('Reason (audit-logged)').fill(reason)
  await page.getByRole('button', { name: 'Start session' }).click()
  await expect(page.getByText(/Viewing as/)).toBeVisible()
}
const inApp = (page: Page, href: string) => page.locator(`a[href="${href}"]`).first().click()

test('impersonating: account and access changes and the owner’s own credentials are switched off with the reason; roles, enquiry reject and business details stay open', async ({ page }) => {
  await impersonateDemo(page, 'G7 closure: UI mirrors the impersonation policy')
  try {
    await inApp(page, '/admin/users')
    await expect(page.getByRole('note')).toContainText("user accounts and access are the owner's to change")
    await expect(page.getByRole('button', { name: 'New user' })).toBeDisabled()
    await expect(page.getByRole('cell', { name: 'demo.cashier' })).toBeVisible() // the list stays readable
    await expect(page.getByRole('button', { name: 'Actions' })).toHaveCount(0)

    await inApp(page, '/admin/roles')
    await expect(page.getByRole('note')).toContainText('Creating and renaming roles stays open')
    await expect(page.getByRole('button', { name: 'New role' })).toBeEnabled()
    for (const del of await page.getByRole('button', { name: 'Delete' }).all()) await expect(del).toBeDisabled()
    await page.getByRole('button', { name: 'Permissions' }).first().click()
    const perms = page.getByRole('dialog')
    await expect(perms).toContainText("View only in a support session — role permissions are the owner's to change.")
    await expect(perms.getByRole('button', { name: 'Save role defaults' })).toHaveCount(0)
    await page.keyboard.press('Escape')

    await inApp(page, '/admin/permission-enquiries')
    await expect(page.getByRole('note')).toContainText('only the owner can approve')
    const pending = page.getByRole('row').filter({ has: page.getByRole('button', { name: 'Reject' }) }).first()
    await expect(pending.getByRole('button', { name: 'Approve' })).toBeDisabled()
    await expect(pending.getByRole('button', { name: 'Reject' })).toBeEnabled()

    await inApp(page, '/admin/business')
    await expect(page.getByRole('note').first()).toContainText("the business email and mobile numbers are the owner's to change")
    for (const id of ['#p-mobile', '#p-email', '#p-alt-mobile']) await expect(page.locator(id)).toHaveAttribute('readonly', '')
    await expect(page.locator('#p-name')).toBeEditable()
    await expect(page.getByRole('button', { name: 'Save changes' })).toBeEnabled()
    await expect(page.getByRole('note').last()).toContainText("only the owner can change the owner's own password and MPIN")
    for (const id of ['#pw-current', '#pw-next', '#mpin-password', '#mpin-new']) await expect(page.locator(id)).toBeDisabled()

    await inApp(page, '/admin/account')
    await expect(page.getByRole('note')).toContainText("only the owner can change the owner's own password and MPIN")
    await expect(page.getByRole('button', { name: 'Change password' })).toBeDisabled()
  } finally {
    await page.getByRole('button', { name: 'End' }).click()
    await expect(page).toHaveURL(/\/platform/)
  }
})

test('a 400 from the server names the field that failed, not just "Invalid input"', async ({ page }) => {
  const details = { formErrors: [], fieldErrors: { name: ['String must contain at most 60 character(s)'] } }
  await page.route('**/api/admin/roles', (route) =>
    route.request().method() === 'POST'
      ? route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: { code: 'VALIDATION', message: 'Invalid input', details } }) })
      : route.continue(),
  )
  await ownerOn(page, '/admin/roles')
  await page.getByRole('button', { name: 'New role' }).click()
  await page.locator('#role-name').fill('G7C role')
  await page.getByRole('dialog').getByRole('button', { name: 'Create' }).click()
  await expect(page.getByText('Invalid input — name: String must contain at most 60 character(s)')).toBeVisible()
})

test('rates: a karat with no rate yet gets a row to price on Settings → Rates and in the dashboard Edit rates dialog', async ({ page, request }) => {
  const token = await apiToken(request, 'demo.owner')
  await request.post('/api/auth/mpin', { headers: { Authorization: `Bearer ${token}` }, data: { password: pwFor('demo.owner'), mpin: MPIN } })
  const karats = (await api(request, 'get', token, '/app/karats')).body as unknown as { id: number; code: string }[]
  const stale = karats.find((k) => k.code === 'G7C14')
  if (stale) await api(request, 'delete', token, `/app/karats/${stale.id}`, undefined, MPIN)
  const created = await api(request, 'post', token, '/app/karats', { metal: 'GOLD', code: 'G7C14', title: 'G7C 14K', touch: 58.5 })
  expect(created.status, JSON.stringify(created.body)).toBe(201)
  try {
    await ownerOn(page, '/app/settings/rates')
    await expect(page.getByLabel('G7C 14K sell rate')).toHaveValue('')
    await expect(page.getByLabel('G7C 14K buy rate')).toHaveValue('')
    // saving with that karat blank must not store ₹0: the page asks for it (nothing is sent)
    let posted = false
    page.on('request', (r) => { if (r.method() === 'POST' && r.url().endsWith('/api/app/rates')) posted = true })
    await page.getByRole('button', { name: 'Save' }).first().click()
    await expect(page.getByText(/Enter the G7C 14K sell and buy rate/)).toBeVisible()
    expect(posted).toBe(false)

    await page.goto('/app/dashboard')
    await page.getByRole('button', { name: 'Edit rates' }).click()
    const dlg = page.getByRole('dialog', { name: 'Set metal rates' })
    await expect(dlg.getByLabel('gold G7C 14K sell')).toHaveValue('')
  } finally {
    const all = (await api(request, 'get', token, '/app/karats')).body as unknown as { id: number; code: string }[]
    const mine = all.find((k) => k.code === 'G7C14')
    if (mine) await api(request, 'delete', token, `/app/karats/${mine.id}`, undefined, MPIN)
  }
})
