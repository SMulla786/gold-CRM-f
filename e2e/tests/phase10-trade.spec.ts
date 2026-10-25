import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test'
import { login, PW } from './helpers'

async function apiToken(request: APIRequestContext, user: string): Promise<string> {
  return (await (await request.post('/api/auth/login', { data: { login: user, password: PW } })).json()).accessToken as string
}
async function apiJson(request: APIRequestContext, token: string, path: string, branch = 'all') {
  const r = await request.get(`/api${path}`, { headers: { Authorization: `Bearer ${token}`, 'X-Branch-Id': branch } })
  return { status: r.status(), body: await r.json().catch(() => null) }
}
const rx = (s: string) => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
const customer = (request: APIRequestContext, token: string, name: string) =>
  request.post('/api/app/parties', { headers: { Authorization: `Bearer ${token}`, 'X-Branch-Id': 'all' }, data: { type: 'CUSTOMER', name, mobile: '9' + String(Date.now()).slice(-9) } }).then((r) => r.json())

/** The dev DB persists across runs, so assert balance DELTAS (via API), not absolute totals. */
const pickBranch = (page: Page) => page.getByRole('combobox', { name: 'Active branch' }).selectOption({ index: 1 })
// The cmdk popover and Radix option list are portalled to <body>, so only the trigger is scoped; the input/options are page-level.
async function pickParty(scope: Page | Locator, page: Page, name: string) {
  await scope.getByRole('combobox', { name: 'Party' }).click()
  await page.getByPlaceholder('Search name / mobile').fill(name)
  await page.waitForResponse((r) => r.url().includes('/app/parties/search'))
  await page.getByRole('option', { name: rx(name) }).first().click()
}
async function radix(scope: Page | Locator, page: Page, name: string, option: RegExp) {
  await scope.getByRole('combobox', { name }).click()
  await page.getByRole('option', { name: option }).click()
}

test('exchange BUY at a rate → kacha card shows it → melt (MPIN) moves it to bullion', async ({ page, request }) => {
  test.setTimeout(120_000)
  const token = await apiToken(request, 'demo.owner')
  await request.post('/api/auth/mpin', { headers: { Authorization: `Bearer ${token}` }, data: { password: PW, mpin: '1234' } })
  const party = await customer(request, token, `ExCust ${Date.now()}`)

  await login(page, 'demo.owner')
  await page.waitForURL(/\/admin/)
  await page.goto('/app/exchange/new')
  await pickBranch(page)
  const branch = await page.getByRole('combobox', { name: 'Active branch' }).inputValue()
  const bal0 = (await apiJson(request, token, '/app/kacha/balance?metal=GOLD', branch)).body

  await pickParty(page, page, party.name) // side BUY + metal GOLD are the defaults
  await page.getByRole('spinbutton', { name: 'Weight' }).first().fill('20')
  await page.getByRole('spinbutton', { name: 'Touch' }).first().fill('100') // fine = 20.000
  await page.locator('#ex-rate').fill('60000') // /10g → value ₹1,20,000
  await page.locator('#ex-cash').fill('120000')
  await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/app/exchange') && r.request().method() === 'POST' && r.status() === 201),
    page.getByRole('button', { name: 'Save purchase' }).click(),
  ])

  // SPA-navigate to the kacha pool (keeps the active branch); the pool grew by exactly the 20 g bought in.
  await page.getByRole('link', { name: 'Kacha / Melting' }).click()
  const bal1 = (await apiJson(request, token, '/app/kacha/balance?metal=GOLD', branch)).body
  expect(Number(bal1.kachaFine) - Number(bal0.kachaFine)).toBe(20)
  await expect(page.getByText(`${bal1.kachaFine} g`).first()).toBeVisible() // the card reflects the pool

  await page.getByRole('button', { name: 'Melt / Refine' }).click()
  await page.locator('#kp-in').fill('12')
  await page.locator('#kp-out').fill('11.8')
  await page.getByRole('button', { name: 'Process (MPIN)' }).click()
  await page.getByLabel('MPIN').fill('1234')
  await Promise.all([
    page.waitForResponse((r) => /\/app\/kacha\/process$/.test(r.url()) && r.request().method() === 'POST' && r.status() === 201),
    page.getByRole('button', { name: 'Confirm' }).click(),
  ])

  const bal2 = (await apiJson(request, token, '/app/kacha/balance?metal=GOLD', branch)).body
  expect(Number(bal1.kachaFine) - Number(bal2.kachaFine)).toBe(12) // 12 g kacha consumed
  expect(Number(bal2.bullionFine) - Number(bal1.bullionFine)).toBeCloseTo(11.8, 3) // 11.8 g bullion produced (0.2 melt loss)
  await expect(page.getByText(`${bal2.bullionFine} g`).first()).toBeVisible() // bullion card moved
})

test('bhav SELL booking + advance → buy-sell SELL at the booking rate → DELIVERED, advance nets to zero', async ({ page, request }) => {
  test.setTimeout(120_000)
  const token = await apiToken(request, 'demo.owner')
  const party = await customer(request, token, `BhavCust ${Date.now()}`)

  await login(page, 'demo.owner')
  await page.waitForURL(/\/admin/)
  await page.goto('/app/buy_sell/bhav')
  await pickBranch(page)

  // Book 10 g SELL @ 60000 with a ₹5,000 advance (party credit). Scope to the dialog — the list has its own "Side" filter.
  await page.getByRole('button', { name: 'New booking' }).click()
  const dlg = page.getByRole('dialog')
  await radix(dlg, page, 'Side', /Sell/)
  await pickParty(dlg, page, party.name)
  await page.locator('#bk-wt').fill('10')
  await page.locator('#bk-rate').fill('60000')
  await page.locator('#bk-cash').fill('5000')
  const [booked] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/app/bhav-booking') && r.request().method() === 'POST' && r.status() === 201),
    dlg.getByRole('button', { name: 'Book' }).click(),
  ])
  const booking = await booked.json()

  // Deliver via a SELL buy-sell at the locked rate; receive ₹55,000 so the ₹5,000 advance clears the balance.
  await page.getByRole('link', { name: 'New Buy/Sell' }).click()
  await page.waitForURL(/\/buy_sell\/new$/) // let the bhav-list page (with its own "Side" filter) unmount first
  await expect(page.getByRole('combobox', { name: 'Side' })).toBeVisible()
  await radix(page, page, 'Side', /Sell/)
  await pickParty(page, page, party.name)
  await page.getByRole('combobox', { name: 'Bhav booking' }).click()
  await page.getByRole('option', { name: rx(`#${booking.bookingNo} `) }).first().click() // trailing space + first(): avoid #1 matching #10
  await page.getByRole('spinbutton', { name: 'Weight' }).first().fill('10') // rate auto-filled & locked to the booking
  await page.locator('#bs-cash').fill('55000')
  await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/app/buy-sell') && r.request().method() === 'POST' && r.status() === 201),
    page.getByRole('button', { name: 'Save sale' }).click(),
  ])

  const fresh = await apiJson(request, token, `/app/bhav-booking/${booking.id}`)
  expect(fresh.body.status, JSON.stringify(fresh.body)).toBe('DELIVERED')
  expect(Number(fresh.body.pendingWeight)).toBe(0)
  const bal = await apiJson(request, token, `/app/udhar/parties/${party.id}/balance`)
  expect(Number(bal.body.amount)).toBe(0) // −5000 advance + 5000 receivable
})
