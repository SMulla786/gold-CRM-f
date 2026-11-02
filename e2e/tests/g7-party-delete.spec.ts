import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { login, PW } from './helpers'

// G7 Phase 4: party deletion safety through the browser (Settings > Parties) and a delete-vs-entry race on the real stack.

async function apiToken(request: APIRequestContext, user: string): Promise<string> {
  return (await (await request.post('/api/auth/login', { data: { login: user, password: PW } })).json()).accessToken as string
}
const hdr = (token: string, branch = 'all') => ({ Authorization: `Bearer ${token}`, 'X-Branch-Id': branch })
async function api(request: APIRequestContext, method: 'get' | 'post' | 'delete', token: string, path: string, data?: unknown, branch = 'all') {
  const r = await request[method](`/api${path}`, { headers: hdr(token, branch), data })
  return { status: r.status(), body: await r.json().catch(() => null) }
}
const newParty = async (request: APIRequestContext, token: string, label: string) =>
  (await api(request, 'post', token, '/app/parties', { type: 'CUSTOMER', name: `${label} ${Date.now()}`, mobile: '9' + String(Date.now()).slice(-9) })).body
const branchOf = async (request: APIRequestContext, token: string) => String((await api(request, 'get', token, '/app/stock?page=1&pageSize=1')).body.items[0].branch.id)

async function openRemove(page: Page, name: string) {
  await page.goto('/app/settings/parties')
  await page.getByPlaceholder('Search name / mobile / shop…').fill(name)
  const row = page.getByRole('row', { name: new RegExp(name) })
  await expect(row).toHaveCount(1)
  await row.getByRole('button', { name: 'Remove' }).click()
}

test('unused party: Remove asks again, Delete permanently removes it for good', async ({ page, request }) => {
  const token = await apiToken(request, 'demo.owner')
  const party = await newParty(request, token, 'G7DelUnused')
  await login(page, 'demo.owner')
  await page.waitForURL(/\/admin/)
  await openRemove(page, party.name)
  await page.getByRole('button', { name: 'Remove', exact: true }).last().click() // dialog confirm
  await expect(page.getByText(`Permanently delete ${party.name}?`)).toBeVisible()
  const [del] = await Promise.all([
    page.waitForResponse((r) => r.url().includes(`/app/parties/${party.id}?confirm=true`) && r.request().method() === 'DELETE'),
    page.getByRole('button', { name: 'Delete permanently' }).click(),
  ])
  expect(await del.json()).toMatchObject({ result: 'DELETED' })
  expect((await api(request, 'get', token, `/app/parties/${party.id}`)).status).toBe(404)
})

test('party with history but no dues is archived; a party with dues is refused and stays active', async ({ page, request }) => {
  const token = await apiToken(request, 'demo.owner')
  const branch = await branchOf(request, token)
  const settled = await newParty(request, token, 'G7DelHist')
  const owing = await newParty(request, token, 'G7DelDues')
  // history that nets to 0 (given then received back) vs an open due
  expect((await api(request, 'post', token, '/app/udhar', { partyId: settled.id, cashOut: 500 }, branch)).status).toBe(201)
  expect((await api(request, 'post', token, '/app/udhar', { partyId: settled.id, cashIn: 500 }, branch)).status).toBe(201)
  expect((await api(request, 'post', token, '/app/udhar', { partyId: owing.id, cashOut: 1000 }, branch)).status).toBe(201)

  await login(page, 'demo.owner')
  await page.waitForURL(/\/admin/)
  await openRemove(page, settled.name)
  const [arch] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith(`/app/parties/${settled.id}`) && r.request().method() === 'DELETE'),
    page.getByRole('button', { name: 'Remove', exact: true }).last().click(),
  ])
  expect(await arch.json()).toMatchObject({ result: 'ARCHIVED' })
  await expect(page.getByText('Party archived')).toBeVisible()
  expect((await api(request, 'get', token, `/app/parties/${settled.id}`)).body.isActive).toBe(false)

  await openRemove(page, owing.name)
  const [refused] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith(`/app/parties/${owing.id}`) && r.request().method() === 'DELETE'),
    page.getByRole('button', { name: 'Remove', exact: true }).last().click(),
  ])
  expect(refused.status()).toBe(409)
  expect(JSON.stringify(await refused.json())).toContain('PARTY_HAS_DUES')
  const still = (await api(request, 'get', token, `/app/parties/${owing.id}`)).body
  expect(still.isActive).toBe(true)
  expect(Number((await api(request, 'get', token, `/app/udhar/parties/${owing.id}/balance`)).body.amount)).toBe(1000)
})

test('race on the real stack: hard delete vs a concurrent udhar entry never orphans an entry and never 500s (x8)', async ({ request }) => {
  test.setTimeout(90_000)
  const token = await apiToken(request, 'demo.owner')
  const branch = await branchOf(request, token)
  const tally: Record<string, number> = {}
  for (let i = 0; i < 8; i++) {
    const party = await newParty(request, token, `G7Race${i}`)
    const [del, entry] = await Promise.all([
      api(request, 'delete', token, `/app/parties/${party.id}?confirm=true`),
      api(request, 'post', token, '/app/udhar', { partyId: party.id, cashOut: 100 }, branch),
    ])
    const key = `delete ${del.status}/${del.body?.result ?? del.body?.error?.code} · entry ${entry.status}`
    tally[key] = (tally[key] ?? 0) + 1
    expect(del.status, JSON.stringify(del.body)).toBeLessThan(500)
    expect(entry.status, JSON.stringify(entry.body)).toBeLessThan(500)
    const exists = (await api(request, 'get', token, `/app/parties/${party.id}`)).status === 200
    if (entry.status === 201) expect(exists, 'an entry was saved, so its party must still exist').toBe(true)
    if (del.body?.result === 'DELETED') expect(entry.status, 'party deleted, so the entry must have been refused').not.toBe(201)
  }
  console.log('race tally', JSON.stringify(tally))
})
