import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { login, PW } from './helpers'

// G7 Phase 2C/2D money journeys: multi-payment bill + udhar settlement, order with two advances, girvi partial interest.
// Each test uses its own party and reconciles the party balance (+ = party owes) and today's Day-Book rows of that party.

const MPIN = '1234'
async function apiToken(request: APIRequestContext, user: string): Promise<string> {
  return (await (await request.post('/api/auth/login', { data: { login: user, password: PW } })).json()).accessToken as string
}
const hdr = (token: string, branch: string, mpin?: string) => ({ Authorization: `Bearer ${token}`, 'X-Branch-Id': branch, ...(mpin ? { 'X-MPIN': mpin } : {}) })
async function api(request: APIRequestContext, method: 'get' | 'post' | 'patch' | 'delete', token: string, path: string, branch: string, data?: unknown, mpin?: string) {
  const r = await request[method](`/api${path}`, { headers: hdr(token, branch, mpin), data })
  return { status: r.status(), body: await r.json().catch(() => null) }
}
const rx = (s: string) => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
const newParty = async (request: APIRequestContext, token: string, type: string, label: string) =>
  (await api(request, 'post', token, '/app/parties', 'all', { type, name: `${label} ${Date.now()}`, mobile: '9' + String(Date.now()).slice(-9) })).body
const balance = async (request: APIRequestContext, token: string, partyId: number) =>
  Number((await api(request, 'get', token, `/app/udhar/parties/${partyId}/balance`, 'all')).body.amount)

type Row = { party: { id: number } | null; sourceId: string; billId?: number | null }
/** Σ Day-Book All-in-One MONEY (today, or from `from`) for one source: rows of one party, or rows matching a predicate
 *  (girvi / order-advance money rows carry no party, and a bill's payments are their own rows linked by billId). */
async function day(request: APIRequestContext, token: string, branch: string, source: string, partyOrMatch: number | ((r: Row) => boolean), from?: string) {
  const match = typeof partyOrMatch === 'number' ? (r: Row) => r.party?.id === partyOrMatch : partyOrMatch
  const s = { cashIn: 0, cashOut: 0, bankIn: 0, bankOut: 0, rows: 0 }
  for (let page = 1; ; page++) {
    const { status, body } = await api(request, 'get', token, `/app/day-book/all-in-one?source=${source}&page=${page}&pageSize=100${from ? `&from=${from}` : ''}`, branch)
    expect(status, JSON.stringify(body)).toBe(200)
    for (const r of body.items) {
      if (!match(r)) continue
      s.rows++
      s.cashIn += Number(r.money.cashIn); s.cashOut += Number(r.money.cashOut); s.bankIn += Number(r.money.bankIn); s.bankOut += Number(r.money.bankOut)
    }
    if (page * 100 >= body.total) return s
  }
}
const netIn = (s: { cashIn: number; cashOut: number; bankIn: number; bankOut: number }) => +(s.cashIn + s.bankIn - s.cashOut - s.bankOut).toFixed(2)

async function setup(page: Page, request: APIRequestContext) {
  const token = await apiToken(request, 'demo.owner')
  await request.post('/api/auth/mpin', { headers: { Authorization: `Bearer ${token}` }, data: { password: PW, mpin: MPIN } })
  await login(page, 'demo.owner')
  await page.waitForURL(/\/admin/)
  await page.goto('/app/udhari')
  await page.getByRole('combobox', { name: 'Active branch' }).selectOption({ index: 1 })
  const branch = await page.getByRole('combobox', { name: 'Active branch' }).inputValue()
  return { token, branch }
}

test('SELL bill paid cash + online, then an udhar settlement: Day-Book, party and Sale/Purchase Due cards reconcile; edit after settlement must not double-count; delete nets the bill out', async ({ page, request }) => {
  test.setTimeout(120_000)
  const { token, branch } = await setup(page, request)
  const party = await newParty(request, token, 'CUSTOMER', 'G7Bill')
  const banks = (await api(request, 'get', token, '/app/bank-accounts', branch)).body
  const bankId = (Array.isArray(banks) ? banks : banks.items)[0].id as number

  // 1 g direct gold line, metal rate 0 (skips the shop's rate limits) + FIXED labour ₹60,000, ROUGH (no GST) → ₹60,000;
  // paid ₹20,000 cash + ₹15,000 online at create.
  const line = (labour: number) => ({ description: 'G7 ring', stockClass: 'GOLD', gross: 1, tunch: 100, rate: 0, labour, labourUnit: 'FIXED' })
  const created = await api(request, 'post', token, '/app/bills', branch, {
    kind: 'SELL', billType: 'ROUGH', partyId: party.id,
    items: [line(60000)],
    payments: [{ mode: 'CASH', amount: 20000 }, { mode: 'ONLINE', amount: 15000, bankAccountId: bankId }],
  })
  expect(created.status, JSON.stringify(created.body)).toBe(201)
  const bill = created.body
  const final = Number(bill.final)
  expect(final).toBe(60000)
  expect(await balance(request, token, party.id)).toBe(25000)
  const ofBill = (r: Row) => r.billId === bill.id
  expect(await day(request, token, branch, 'SELL_BILL', ofBill)).toMatchObject({ cashIn: 20000, bankIn: 15000, cashOut: 0, bankOut: 0 })

  // Later the customer pays ₹5,000 against this bill through udhar (settlement).
  const settle = await api(request, 'post', token, '/app/udhar', branch, { partyId: party.id, cashIn: 5000, settleBillId: bill.id })
  expect(settle.status, JSON.stringify(settle.body)).toBe(201)
  expect(await balance(request, token, party.id)).toBe(20000)
  expect(await day(request, token, branch, 'UDHAR', party.id)).toMatchObject({ cashIn: 5000, cashOut: 0 })
  const pend = (await api(request, 'get', token, `/app/udhar/pending-bills?partyId=${party.id}&page=1&pageSize=50`, branch)).body
  expect(pend.items.find((b: { id: number }) => b.id === bill.id).balance).toBe('20000.00')
  expect([Number(pend.summary.saleDue), Number(pend.summary.purchaseDue)]).toEqual([20000, 0]) // never netted into one total

  // Edit the bill the way the form does (re-send its payments, now with the labour corrected to ₹61,000).
  const fresh = (await api(request, 'get', token, `/app/bills/${bill.id}`, branch)).body
  const pays = fresh.payments.map((p: { mode: string; amount: string; bankAccount?: { id: number } | null }) =>
    p.mode === 'ONLINE' ? { mode: 'ONLINE', amount: Number(p.amount), bankAccountId: p.bankAccount?.id ?? bankId } : { mode: p.mode, amount: Number(p.amount) })
  const edit = await api(request, 'patch', token, `/app/bills/${bill.id}`, branch, {
    kind: 'SELL', billType: 'ROUGH', partyId: party.id, items: [line(61000)], payments: pays,
  }, MPIN)
  const moneyIn = netIn(await day(request, token, branch, 'SELL_BILL', ofBill)) + netIn(await day(request, token, branch, 'UDHAR', party.id))
  if (edit.status === 409) {
    // accepted outcome: the edit is refused while an udhar settlement holds part of the bill
    expect(moneyIn).toBe(40000)
    expect(await balance(request, token, party.id)).toBe(20000)
  } else {
    expect(edit.status, JSON.stringify(edit.body)).toBe(200)
    expect(moneyIn, 'money received is still 20k cash + 15k online + 5k settlement').toBe(40000)
    expect(await balance(request, token, party.id), '₹61,000 − ₹40,000 received').toBe(21000)
  }

  // Delete the bill (MPIN): the bill's own money nets to 0; what the settlement received stays as the party's credit.
  const del = await api(request, 'delete', token, `/app/bills/${bill.id}`, branch, undefined, MPIN)
  expect([200, 204]).toContain(del.status)
  expect(netIn(await day(request, token, branch, 'SELL_BILL', ofBill))).toBe(0)
  const left = netIn(await day(request, token, branch, 'UDHAR', party.id))
  expect(await balance(request, token, party.id)).toBe(-left)
})

test('order with TWO advances → karigar issue/receive → bill by orderId: advances net exactly once', async ({ page, request }) => {
  test.setTimeout(150_000)
  const { token, branch } = await setup(page, request)
  const customer = await newParty(request, token, 'CUSTOMER', 'G7Ord')
  const karigar = await newParty(request, token, 'KARIGAR', 'G7Kar')
  const names = (await api(request, 'get', token, '/app/item-names?stockClass=GOLD&page=1&pageSize=50', branch)).body.items as Array<{ id: number }>
  expect(names.length, 'demo data has a GOLD item name').toBeGreaterThan(0)

  const order = await api(request, 'post', token, '/app/orders', branch, {
    partyId: customer.id, items: [{ itemNameId: names[0]!.id, metal: 'GOLD', touch: 91.6, gross: 10 }], payments: [{ mode: 'CASH', amount: 3000 }],
  })
  expect(order.status, JSON.stringify(order.body)).toBe(201)
  const adv2 = await api(request, 'post', token, `/app/orders/${order.body.id}/advance`, branch, { payments: [{ mode: 'CASH', amount: 2000 }] })
  expect(adv2.status, JSON.stringify(adv2.body)).toBe(200)
  expect(await balance(request, token, customer.id)).toBe(-5000) // two advances = shop owes ₹5,000
  const ofOrder = (r: Row) => r.sourceId.startsWith(`${order.body.id}-P`) // advance rows: sourceId '<orderId>-P<payId>'
  expect(await day(request, token, branch, 'ORDER_ADVANCE', ofOrder)).toMatchObject({ cashIn: 5000, cashOut: 0, rows: 2 })

  const itemId = order.body.items[0].id as number
  const issue = await api(request, 'post', token, '/app/karigar-issues', branch, { karigarId: karigar.id, orderItemIds: [itemId], goldFine: 10 })
  expect(issue.status, JSON.stringify(issue.body)).toBe(201)
  const recv = await api(request, 'post', token, `/app/karigar-issues/${issue.body.id}/receive`, branch,
    { items: [{ orderItemId: itemId, returnedGross: 9.5, ghatAllowance: 0.3, labour: 800, tagNo: `G7T${String(Date.now()).slice(-7)}` }] })
  expect(recv.status, JSON.stringify(recv.body)).toBe(200)
  expect((await api(request, 'get', token, `/app/orders/${order.body.id}`, branch)).body.status).toBe('READY')

  // Bill it from the order page (browser): the reserved piece is prefilled; set the rate and save.
  await page.goto(`/app/orders/${order.body.id}`)
  await page.getByRole('combobox', { name: 'Active branch' }).selectOption(branch)
  await Promise.all([page.waitForURL(/\/app\/billing\?orderId=/), page.getByRole('button', { name: 'Create bill' }).click()])
  await page.getByRole('combobox', { name: 'Active branch' }).selectOption(branch)
  await expect(page.getByRole('spinbutton', { name: 'Rate' }).first()).toBeVisible()
  await page.getByRole('spinbutton', { name: 'Rate' }).first().fill('165000') // inside the demo shop's rate limits (as phase8-orders)
  const [sold] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/app/bills') && r.request().method() === 'POST'),
    page.getByRole('button', { name: 'Save sell bill' }).click(),
  ])
  expect(sold.status(), JSON.stringify(await sold.json().catch(() => ''))).toBe(201)
  const bill = await sold.json()

  expect((await api(request, 'get', token, `/app/orders/${order.body.id}`, branch)).body.status).toBe('DELIVERED')
  // party = bill balance − both advances, once; the advances stay booked once in the Day-Book
  expect(await balance(request, token, customer.id)).toBeCloseTo(Number(bill.final) - Number(bill.paid) - 5000, 1)
  expect(await day(request, token, branch, 'ORDER_ADVANCE', ofOrder)).toMatchObject({ cashIn: 5000, cashOut: 0, rows: 2 })
})

test('girvi: a PARTIAL interest payment is credited against the interest due', async ({ page, request }) => {
  test.setTimeout(90_000)
  const { token, branch } = await setup(page, request)
  const party = await newParty(request, token, 'CUSTOMER', 'G7Girvi')
  const issueDate = new Date(Date.now() - 60 * 864e5).toISOString().slice(0, 10) // 2 months back so interest accrues
  const item = (name: string) => ({ category: 'Ring', name, gross: 10, net: 10, purity: 100, rate: 6000 })
  const g = await api(request, 'post', token, '/app/girvi', branch, {
    partyId: party.id, issueDate, items: [item('RingA'), item('RingB')], principal: 40000, ratePercent: 2, ratePeriod: 'MONTHLY',
    interestType: 'SI', method: 'FULL_MONTH', tenureMonths: 12, cash: 40000, online: 0,
  })
  expect(g.status, JSON.stringify(g.body)).toBe(201)
  const ofLoan = (r: Row) => r.sourceId === String(g.body.id)
  expect(await day(request, token, branch, 'GIRVI', ofLoan, issueDate)).toMatchObject({ cashOut: 40000, cashIn: 0 }) // paid out on the issue date

  const due0 = Number((await api(request, 'get', token, `/app/girvi/${g.body.id}`, branch)).body.interestDue)
  expect(due0).toBeGreaterThan(0)
  const half = Math.round(due0 / 2)
  const pay = await api(request, 'post', token, `/app/girvi/${g.body.id}/interest`, branch, { interest: half, cash: half, online: 0 })
  expect(pay.status, JSON.stringify(pay.body)).toBe(200)
  expect(await day(request, token, branch, 'GIRVI', ofLoan, issueDate)).toMatchObject({ cashOut: 40000, cashIn: half })
  const due1 = Number((await api(request, 'get', token, `/app/girvi/${g.body.id}`, branch)).body.interestDue)
  expect(due1, `due before ${due0}, paid ${half}`).toBe(due0 - half)
})
