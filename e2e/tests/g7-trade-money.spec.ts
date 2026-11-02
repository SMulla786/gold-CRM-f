import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test'
import { login, PW } from './helpers'

// G7 Phase 2B/2C: Buy-Sell / Bhav money flows through the browser, reconciled against the party balance (udhar) and the
// Day-Book All-in-One rows of today. Each test makes its own party, so only that party's rows / balance are asserted.

type Money = { cashIn: number; cashOut: number; bankIn: number; bankOut: number }

async function apiToken(request: APIRequestContext, user: string): Promise<string> {
  return (await (await request.post('/api/auth/login', { data: { login: user, password: PW } })).json()).accessToken as string
}
const hdr = (token: string, branch: string, mpin?: string) => ({ Authorization: `Bearer ${token}`, 'X-Branch-Id': branch, ...(mpin ? { 'X-MPIN': mpin } : {}) })
async function apiJson(request: APIRequestContext, token: string, path: string, branch = 'all') {
  const r = await request.get(`/api${path}`, { headers: hdr(token, branch) })
  return { status: r.status(), body: await r.json().catch(() => null) }
}
async function apiSend(request: APIRequestContext, method: 'post' | 'put' | 'delete', token: string, path: string, branch: string, data?: unknown, mpin?: string) {
  const r = await request[method](`/api${path}`, { headers: hdr(token, branch, mpin), data })
  return { status: r.status(), body: await r.json().catch(() => null) }
}
const rx = (s: string) => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
const customer = (request: APIRequestContext, token: string, name: string) =>
  request.post('/api/app/parties', { headers: hdr(token, 'all'), data: { type: 'CUSTOMER', name, mobile: '9' + String(Date.now()).slice(-9) } }).then((r) => r.json())

const pickBranch = (page: Page) => page.getByRole('combobox', { name: 'Active branch' }).selectOption({ index: 1 })
async function pickParty(scope: Page | Locator, page: Page, name: string) {
  await scope.getByRole('combobox', { name: 'Party' }).click()
  await page.getByPlaceholder('Search name / mobile').fill(name)
  await page.waitForResponse((r) => r.url().includes('/app/parties/search'))
  await page.getByRole('option', { name: rx(name) }).first().click()
}
async function radix(scope: Page | Locator, page: Page, name: string, option: RegExp) {
  const trigger = scope.getByRole('combobox', { name })
  const opt = page.getByRole('option', { name: option }).first()
  await trigger.click()
  try {
    await opt.waitFor({ state: 'visible', timeout: 5_000 })
  } catch {
    await trigger.click()
    await opt.waitFor({ state: 'visible', timeout: 5_000 })
  }
  await opt.click()
}

/** Party balance: amount > 0 = the party owes the shop. */
const balance = async (request: APIRequestContext, token: string, partyId: number) =>
  (await apiJson(request, token, `/app/udhar/parties/${partyId}/balance`)).body as { amount: string; gold: string; silver: string }

/** Sum today's Day-Book All-in-One MONEY of one party for one source (cash = no bank account, bank = any bank account). */
async function dayMoney(request: APIRequestContext, token: string, branch: string, source: string, partyId: number): Promise<Money & { rows: number }> {
  const sum = { cashIn: 0, cashOut: 0, bankIn: 0, bankOut: 0, rows: 0 }
  for (let page = 1; ; page++) {
    const { status, body } = await apiJson(request, token, `/app/day-book/all-in-one?source=${source}&page=${page}&pageSize=100`, branch)
    expect(status, JSON.stringify(body)).toBe(200)
    for (const r of body.items) {
      if (r.party?.id !== partyId) continue
      sum.rows++
      sum.cashIn += Number(r.money.cashIn); sum.cashOut += Number(r.money.cashOut)
      sum.bankIn += Number(r.money.bankIn); sum.bankOut += Number(r.money.bankOut)
    }
    if (page * 100 >= body.total) return sum
  }
}

async function setup(page: Page, request: APIRequestContext, label: string) {
  const token = await apiToken(request, 'demo.owner')
  await request.post('/api/auth/mpin', { headers: { Authorization: `Bearer ${token}` }, data: { password: PW, mpin: '1234' } })
  const party = await customer(request, token, `${label} ${Date.now()}`)
  await login(page, 'demo.owner')
  await page.waitForURL(/\/admin/)
  return { token, party }
}

async function openNewBuySell(page: Page, side: RegExp, partyName: string) {
  await page.getByRole('link', { name: 'New Buy/Sell' }).click()
  await page.waitForURL(/\/buy_sell\/new$/)
  await expect(page.getByRole('combobox', { name: 'Side' })).toBeVisible()
  await radix(page, page, 'Side', side)
  await pickParty(page, page, partyName)
}

test('BUY booking: the ₹5,000 advance is money GIVEN once — booking + delivery pay out exactly the trade value, party nets to 0', async ({ page, request }) => {
  test.setTimeout(120_000)
  const { token, party } = await setup(page, request, 'G7Buy')
  await page.goto('/app/buy_sell/bhav')
  await pickBranch(page)
  const branch = await page.getByRole('combobox', { name: 'Active branch' }).inputValue()

  // Book: shop buys 10 g @ ₹60,000/10g from the party, gives ₹5,000 cash advance.
  await page.getByRole('button', { name: 'New booking' }).click()
  const dlg = page.getByRole('dialog')
  await radix(dlg, page, 'Side', /Buy/)
  await pickParty(dlg, page, party.name)
  await page.locator('#bk-wt').fill('10')
  await page.locator('#bk-rate').fill('60000')
  await page.locator('#bk-cash').fill('5000')
  const [booked] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/app/bhav-booking') && r.request().method() === 'POST' && r.status() === 201),
    dlg.getByRole('button', { name: 'Book' }).click(),
  ])
  const booking = await booked.json()
  expect(Number(booking.advance)).toBe(5000)
  expect(Number((await balance(request, token, party.id)).amount)).toBe(5000) // advance given → the party owes it back
  const adv = await dayMoney(request, token, branch, 'BHAV_BOOKING', party.id)
  expect(adv).toMatchObject({ cashIn: 0, cashOut: 5000, bankIn: 0, bankOut: 0 })

  // Deliver the full 10 g against the booking; pay the remaining ₹55,000 in cash.
  await openNewBuySell(page, /Buy/, party.name)
  await page.getByRole('spinbutton', { name: `Deliver from booking ${booking.bookingNo}` }).fill('10')
  await page.locator('#bs-cash').fill('55000')
  const [saved] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/app/buy-sell') && r.request().method() === 'POST' && r.status() === 201),
    page.getByRole('button', { name: 'Save purchase' }).click(),
  ])
  const trade = await saved.json()
  expect(Number(trade.totalAmount)).toBe(60000)

  const fresh = (await apiJson(request, token, `/app/bhav-booking/${booking.id}`)).body
  expect(fresh.status).toBe('DELIVERED')
  expect(Number(fresh.pendingWeight)).toBe(0)
  expect(Number(fresh.advance)).toBe(5000)
  expect(Number(fresh.settlement)).toBe(55000) // delivery settlement shown separately from the advance
  expect(Number((await balance(request, token, party.id)).amount)).toBe(0)

  const del = await dayMoney(request, token, branch, 'BUY_SELL', party.id)
  expect(del).toMatchObject({ cashIn: 0, cashOut: 55000, bankIn: 0, bankOut: 0 })
  // money given in total = advance + settlement = the trade value (never advance twice)
  expect(adv.cashOut + del.cashOut).toBe(60000)
})

test('SELL: one trade delivers from two bookings at different rates (partial + full), online; delete restores both bookings and the money', async ({ page, request }) => {
  test.setTimeout(120_000)
  const { token, party } = await setup(page, request, 'G7Multi')
  await page.goto('/app/buy_sell/bhav')
  await pickBranch(page)
  const branch = await page.getByRole('combobox', { name: 'Active branch' }).inputValue()

  const book = (weight: number, rate: number, cash: number) =>
    apiSend(request, 'post', token, '/app/bhav-booking', branch, { side: 'SELL', partyId: party.id, metal: 'GOLD', weight, rate, cash, online: 0 })
  const a = await book(10, 60000, 2000)
  const b = await book(5, 62000, 1000)
  expect(a.status, JSON.stringify(a.body)).toBe(201)
  expect(b.status, JSON.stringify(b.body)).toBe(201)
  expect(Number((await balance(request, token, party.id)).amount)).toBe(-3000) // SELL advances received → party credit

  // 6 g of A (₹36,000) + all 5 g of B (₹31,000) = ₹67,000; advances ₹3,000; ₹64,000 received online.
  await openNewBuySell(page, /Sell/, party.name)
  await page.getByRole('spinbutton', { name: `Deliver from booking ${a.body.bookingNo}` }).fill('6')
  await page.getByRole('spinbutton', { name: `Deliver from booking ${b.body.bookingNo}` }).fill('5')
  await page.locator('#bs-online').fill('64000')
  await radix(page, page, 'Bank account', /./)
  const [saved] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/app/buy-sell') && r.request().method() === 'POST' && r.status() === 201),
    page.getByRole('button', { name: 'Save sale' }).click(),
  ])
  const trade = await saved.json()
  expect(Number(trade.totalAmount)).toBe(67000)

  const fa =(await apiJson(request, token, `/app/bhav-booking/${a.body.id}`)).body
  const fb = (await apiJson(request, token, `/app/bhav-booking/${b.body.id}`)).body
  expect([fa.status, Number(fa.pendingWeight)]).toEqual(['PARTIAL', 4])
  expect([fb.status, Number(fb.pendingWeight)]).toEqual(['DELIVERED', 0])
  expect(Number(fa.settlement) + Number(fb.settlement)).toBeCloseTo(64000, 2) // settlement split across the two bookings, nothing lost
  expect(Number((await balance(request, token, party.id)).amount)).toBe(0)
  expect(await dayMoney(request, token, branch, 'BUY_SELL', party.id)).toMatchObject({ cashIn: 0, cashOut: 0, bankIn: 64000, bankOut: 0 })

  // Undeliver is refused while a trade still holds the booking; deleting the trade (MPIN) restores both bookings.
  expect((await apiSend(request, 'post', token, `/app/bhav-booking/${a.body.id}/undeliver`, branch, {}, '1234')).status).toBe(409)
  expect((await apiSend(request, 'delete', token, `/app/buy-sell/${trade.id}`, branch, undefined, '1234')).status).toBe(204)
  const ra = (await apiJson(request, token, `/app/bhav-booking/${a.body.id}`)).body
  const rb = (await apiJson(request, token, `/app/bhav-booking/${b.body.id}`)).body
  expect([ra.status, Number(ra.pendingWeight), Number(ra.settlement)]).toEqual(['PENDING', 10, 0])
  expect([rb.status, Number(rb.pendingWeight), Number(rb.settlement)]).toEqual(['PENDING', 5, 0])
  expect(Number((await balance(request, token, party.id)).amount)).toBe(-3000) // only the advances remain
  const net = await dayMoney(request, token, branch, 'BUY_SELL', party.id)
  expect(net.bankIn - net.bankOut).toBe(0) // the reversal (dated today) cancels the receipt
  expect(await dayMoney(request, token, branch, 'BHAV_BOOKING', party.id)).toMatchObject({ cashIn: 3000, cashOut: 0 })
})

test('SELL without booking + inline udhar jama; edit (MPIN) to less cash + a bhav cut → party money, gold and Day-Book reconcile', async ({ page, request }) => {
  test.setTimeout(120_000)
  const { token, party } = await setup(page, request, 'G7Iu')
  await page.goto('/app/buy_sell/bhav')
  await pickBranch(page)
  const branch = await page.getByRole('combobox', { name: 'Active branch' }).inputValue()

  // 5 g @ ₹60,000/10g = ₹30,000 paid in cash, plus ₹1,000 old dues received (inline udhar jama).
  await openNewBuySell(page, /Sell/, party.name)
  await page.getByRole('spinbutton', { name: 'Weight' }).first().fill('5')
  await page.getByRole('spinbutton', { name: 'Rate' }).first().fill('60000')
  await page.locator('#bs-cash').fill('30000')
  await page.locator('#iu-cash-in').fill('1000')
  const [saved] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/app/buy-sell') && r.request().method() === 'POST' && r.status() === 201),
    page.getByRole('button', { name: 'Save sale' }).click(),
  ])
  const trade = await saved.json()
  expect(Number((await balance(request, token, party.id)).amount)).toBe(-1000)
  expect(await dayMoney(request, token, branch, 'BUY_SELL', party.id)).toMatchObject({ cashIn: 30000, cashOut: 0 })
  // the inline udhar is a linked, numbered udhar entry: its money rows carry source UDHAR (BUY_SELL_UDHAR is never written)
  expect(await dayMoney(request, token, branch, 'UDHAR', party.id)).toMatchObject({ cashIn: 1000, cashOut: 0 })

  // Edit: only ₹25,000 was actually paid, and ₹6,000 of the balance is cut into gold at ₹60,000/10g (= 1 g).
  const put = await apiSend(request, 'put', token, `/app/buy-sell/${trade.id}`, branch, {
    side: 'SELL', partyId: party.id, metal: 'GOLD', txnDate: trade.txnDate, lines: [{ weight: 5, rate: 60000 }], discount: 0, cash: 25000, online: 0,
    udhar: { cashIn: 1000, bhav: { direction: 'MONEY_TO_METAL', metal: 'GOLD', amount: 6000, rate: 60000, unitGrams: 10 } },
  }, '1234')
  expect(put.status, JSON.stringify(put.body)).toBe(200)
  const bal = await balance(request, token, party.id)
  expect(Number(bal.amount)).toBe(-2000) // +5,000 unpaid − 1,000 jama − 6,000 cut to metal
  expect(Number(bal.gold)).toBe(1) // the cut 1 g of gold is now owed by the party
  const net = await dayMoney(request, token, branch, 'BUY_SELL', party.id)
  expect(net.cashIn - net.cashOut).toBe(25000) // 30,000 in − 30,000 reversal + 25,000 in
  const iu = await dayMoney(request, token, branch, 'UDHAR', party.id)
  expect(iu.cashIn - iu.cashOut).toBe(1000)
})

test('guards: over-delivery and a wrong-side booking are refused with no money or weight moved', async ({ page, request }) => {
  test.setTimeout(60_000)
  const { token, party } = await setup(page, request, 'G7Guard')
  await page.goto('/app/buy_sell/bhav')
  await pickBranch(page)
  const branch = await page.getByRole('combobox', { name: 'Active branch' }).inputValue()
  const bk = await apiSend(request, 'post', token, '/app/bhav-booking', branch, { side: 'BUY', partyId: party.id, metal: 'GOLD', weight: 10, rate: 60000, cash: 1000, online: 0 })
  expect(bk.status).toBe(201)
  const trade = (side: string, weight: number) =>
    apiSend(request, 'post', token, '/app/buy-sell', branch, { side, partyId: party.id, metal: 'GOLD', lines: [{ weight, rate: 60000 }], discount: 0, cash: 0, online: 0, deliveries: [{ bookingId: bk.body.id, weight }] })
  const over = await trade('BUY', 11)
  expect(over.status, JSON.stringify(over.body)).toBeGreaterThanOrEqual(400)
  expect(over.status).toBeLessThan(500)
  const wrong = await trade('SELL', 5)
  expect(wrong.status, JSON.stringify(wrong.body)).toBeGreaterThanOrEqual(400)
  expect(wrong.status).toBeLessThan(500)
  const fresh = (await apiJson(request, token, `/app/bhav-booking/${bk.body.id}`)).body
  expect([fresh.status, Number(fresh.pendingWeight)]).toEqual(['PENDING', 10])
  expect(Number((await balance(request, token, party.id)).amount)).toBe(1000)
  expect((await dayMoney(request, token, branch, 'BUY_SELL', party.id)).rows).toBe(0)
})
