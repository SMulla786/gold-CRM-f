import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { login, PW } from './helpers'

// G7 Phase 2A: Exchange / Kacha. Physical kacha (ledger kachaFine), reserved kacha (open PROCESS batches) and bullion are
// reconciled as DELTAS on one branch (other specs move the same pools), together with the party balance and the Day-Book.

const MPIN = '1234'
async function apiToken(request: APIRequestContext, user: string): Promise<string> {
  return (await (await request.post('/api/auth/login', { data: { login: user, password: PW } })).json()).accessToken as string
}
const hdr = (token: string, branch: string, mpin?: string) => ({ Authorization: `Bearer ${token}`, 'X-Branch-Id': branch, ...(mpin ? { 'X-MPIN': mpin } : {}) })
async function api(request: APIRequestContext, method: 'get' | 'post' | 'put' | 'delete', token: string, path: string, branch: string, data?: unknown, mpin?: string) {
  const r = await request[method](`/api${path}`, { headers: hdr(token, branch, mpin), data })
  return { status: r.status(), body: await r.json().catch(() => null) }
}
const customer = (request: APIRequestContext, token: string, name: string) =>
  request.post('/api/app/parties', { headers: hdr(token, 'all'), data: { type: 'CUSTOMER', name, mobile: '9' + String(Date.now()).slice(-9) } }).then((r) => r.json())

type Pool = { kacha: number; bullion: number; reserved: number }
const pool = async (request: APIRequestContext, token: string, branch: string): Promise<Pool> => {
  const b = (await api(request, 'get', token, '/app/kacha/balance?metal=GOLD', branch)).body
  return { kacha: Number(b.kachaFine), bullion: Number(b.bullionFine), reserved: Number(b.reservedFine ?? 0) }
}
const delta = (a: Pool, b: Pool) => ({ kacha: +(b.kacha - a.kacha).toFixed(3), bullion: +(b.bullion - a.bullion).toFixed(3), reserved: +(b.reserved - a.reserved).toFixed(3) })
const partyAmount = async (request: APIRequestContext, token: string, partyId: number) =>
  Number((await api(request, 'get', token, `/app/udhar/parties/${partyId}/balance`, 'all')).body.amount)

/** Today's Day-Book All-in-One: Σ GOLD (in − out) and MONEY by holder for one source, optionally one party. */
async function day(request: APIRequestContext, token: string, branch: string, source: string, partyId?: number) {
  const s = { goldNet: 0, cashIn: 0, cashOut: 0, rows: 0 }
  for (let page = 1; ; page++) {
    const { status, body } = await api(request, 'get', token, `/app/day-book/all-in-one?source=${source}&page=${page}&pageSize=100`, branch)
    expect(status, JSON.stringify(body)).toBe(200)
    for (const r of body.items) {
      if (partyId !== undefined && r.party?.id !== partyId) continue
      s.rows++
      s.goldNet += Number(r.assets.GOLD.in) - Number(r.assets.GOLD.out)
      s.cashIn += Number(r.money?.cashIn ?? 0); s.cashOut += Number(r.money?.cashOut ?? 0)
    }
    if (page * 100 >= body.total) return { ...s, goldNet: +s.goldNet.toFixed(3) }
  }
}

async function setup(page: Page, request: APIRequestContext, label: string) {
  const token = await apiToken(request, 'demo.owner')
  await request.post('/api/auth/mpin', { headers: { Authorization: `Bearer ${token}` }, data: { password: PW, mpin: MPIN } })
  const party = await customer(request, token, `${label} ${Date.now()}`)
  await login(page, 'demo.owner')
  await page.waitForURL(/\/admin/)
  await page.goto('/app/exchange/new')
  await page.getByRole('combobox', { name: 'Active branch' }).selectOption({ index: 1 })
  const branch = await page.getByRole('combobox', { name: 'Active branch' }).inputValue()
  const exchange = (weight: number, extra: Record<string, unknown> = {}) =>
    api(request, 'post', token, '/app/exchange', branch, { side: 'BUY', partyId: party.id, metal: 'GOLD', lines: [{ weight, touch: 100 }], rate: 60000, cash: 0, online: 0, ...extra })
  return { token, party, branch, exchange }
}

test('exchange create → edit (MPIN) → delete: kacha, party balance and Day-Book follow each step and return to zero', async ({ page, request }) => {
  test.setTimeout(90_000)
  const { token, party, branch, exchange } = await setup(page, request, 'G7Ex')
  const p0 = await pool(request, token, branch)

  // 20 g @ 100 touch at ₹60,000/10g = ₹1,20,000; ₹1,00,000 paid in cash → the shop still owes the party ₹20,000.
  const ex = await exchange(20, { cash: 100000 })
  expect(ex.status, JSON.stringify(ex.body)).toBe(201)
  expect(Number(ex.body.afterFine)).toBe(20)
  expect(delta(p0, await pool(request, token, branch))).toEqual({ kacha: 20, bullion: 0, reserved: 0 })
  expect(await partyAmount(request, token, party.id)).toBe(Number(ex.body.balance))
  expect(Number(ex.body.balance)).toBe(100000 - Number(ex.body.finalAmount)) // BUY: the unpaid part is owed BY the shop (−)
  let d = await day(request, token, branch, 'EXCHANGE', party.id)
  expect([d.goldNet, d.cashOut]).toEqual([20, 100000])

  // Edit: really 15 g, paid ₹90,000.
  const put = await api(request, 'put', token, `/app/exchange/${ex.body.id}`, branch,
    { side: 'BUY', partyId: party.id, metal: 'GOLD', txnDate: ex.body.txnDate, lines: [{ weight: 15, touch: 100 }], rate: 60000, cash: 90000, online: 0 }, MPIN)
  expect(put.status, JSON.stringify(put.body)).toBe(200)
  expect(delta(p0, await pool(request, token, branch))).toEqual({ kacha: 15, bullion: 0, reserved: 0 })
  expect(await partyAmount(request, token, party.id)).toBe(Number(put.body.balance))
  d = await day(request, token, branch, 'EXCHANGE', party.id)
  expect([d.goldNet, +(d.cashOut - d.cashIn).toFixed(2)]).toEqual([15, 90000]) // original + reversal + new rows net to the edit

  // Delete without MPIN is refused; with MPIN everything returns.
  expect((await api(request, 'delete', token, `/app/exchange/${ex.body.id}`, branch)).status).toBeGreaterThanOrEqual(400)
  expect((await api(request, 'delete', token, `/app/exchange/${ex.body.id}`, branch, undefined, MPIN)).status).toBe(204)
  expect(delta(p0, await pool(request, token, branch))).toEqual({ kacha: 0, bullion: 0, reserved: 0 })
  expect(await partyAmount(request, token, party.id)).toBe(0)
  d = await day(request, token, branch, 'EXCHANGE', party.id)
  expect([d.goldNet, +(d.cashOut - d.cashIn).toFixed(2)]).toEqual([0, 0])
})

test('PROCESS reserves, two REFINEs consume the batch (raval stays kacha), guards hold, reverts restore every pool', async ({ page, request }) => {
  test.setTimeout(120_000)
  const { token, branch, exchange } = await setup(page, request, 'G7Proc')
  const e1 = await exchange(10)
  const e2 = await exchange(6)
  expect([e1.status, e2.status]).toEqual([201, 201])
  const p0 = await pool(request, token, branch) // after the exchanges: their 16 g are in the physical pool
  const dayRefine0 = await day(request, token, branch, 'EXCHANGE_REFINE')

  const proc = (body: Record<string, unknown>) => api(request, 'post', token, '/app/kacha/process', branch, { metal: 'GOLD', ...body }, MPIN)
  const batch = await proc({ type: 'PROCESS', exchangeIds: [e1.body.id, e2.body.id] })
  expect(batch.status, JSON.stringify(batch.body)).toBe(201)
  expect(delta(p0, await pool(request, token, branch))).toEqual({ kacha: 0, bullion: 0, reserved: 16 }) // reservation only, no ledger

  // Guards: an exchange in an open batch can't be melted on its own or batched again; a refine can't exceed the batch.
  expect((await proc({ type: 'MELT', inFine: 1, outFine: 1, exchangeId: e1.body.id })).status).toBe(409)
  expect((await proc({ type: 'PROCESS', exchangeIds: [e2.body.id] })).status).toBe(409)
  expect((await proc({ type: 'REFINE', parentId: batch.body.id, inFine: 16.001, outFine: 15 })).status).toBe(409)

  // Refine 1: 10 g in → 9.8 g bread + 0.1 g raval (stays kacha); 0.1 g loss.
  const r1 = await proc({ type: 'REFINE', parentId: batch.body.id, inFine: 10, outFine: 9.8, ravalFine: 0.1 })
  expect(r1.status, JSON.stringify(r1.body)).toBe(201)
  expect(delta(p0, await pool(request, token, branch))).toEqual({ kacha: -9.9, bullion: 9.8, reserved: 6 })

  // Two concurrent refines of 6 g with 6 g left: exactly one wins (batch row lock), the other gets 409.
  const race = await Promise.all([1, 2].map(() => proc({ type: 'REFINE', parentId: batch.body.id, inFine: 6, outFine: 5.9 })))
  expect(race.map((r) => r.status).sort()).toEqual([201, 409])
  const r2 = race.find((r) => r.status === 201)!
  const p2 = await pool(request, token, branch)
  expect(delta(p0, p2)).toEqual({ kacha: -15.9, bullion: 15.7, reserved: 0 })
  // Day-Book: kacha out 16, bread in 15.7, raval in 0.1 → GOLD net −0.2 (the process loss)
  expect(+((await day(request, token, branch, 'EXCHANGE_REFINE')).goldNet - dayRefine0.goldNet).toFixed(3)).toBe(-0.2)

  // UI: the pool card shows physical kacha and no reservation left for this batch.
  await page.getByRole('link', { name: 'Kacha / Melting' }).click()
  await expect(page.getByRole('combobox', { name: 'Process type' })).toBeVisible() // only on the Kacha pool page
  await expect(page.getByText(`${p2.kacha.toFixed(3)} g`).first()).toBeVisible() // the pool defaults to GOLD

  // Reverts: the batch only after its refines; child-first restores reservation then releases it.
  expect((await api(request, 'post', token, `/app/kacha/${batch.body.id}/revert`, branch, {}, MPIN)).status).toBe(409)
  expect((await api(request, 'post', token, `/app/kacha/${r2.body.id}/revert`, branch, {}, MPIN)).status).toBe(200)
  expect((await api(request, 'post', token, `/app/kacha/${r1.body.id}/revert`, branch, {}, MPIN)).status).toBe(200)
  expect((await api(request, 'post', token, `/app/kacha/${r1.body.id}/revert`, branch, {}, MPIN)).status).toBe(409) // already reverted
  expect(delta(p0, await pool(request, token, branch))).toEqual({ kacha: 0, bullion: 0, reserved: 16 })
  expect((await api(request, 'post', token, `/app/kacha/${batch.body.id}/revert`, branch, {}, MPIN)).status).toBe(200)
  expect(delta(p0, await pool(request, token, branch))).toEqual({ kacha: 0, bullion: 0, reserved: 0 })
  expect(+((await day(request, token, branch, 'EXCHANGE_REFINE')).goldNet - dayRefine0.goldNet).toFixed(3)).toBe(0)
})

test('negative-balance guards: a melt larger than the available kacha and a SELL exchange beyond it are refused', async ({ page, request }) => {
  test.setTimeout(60_000)
  const { token, party, branch } = await setup(page, request, 'G7Neg')
  const p0 = await pool(request, token, branch)
  const available = p0.kacha - p0.reserved
  const melt = await api(request, 'post', token, '/app/kacha/process', branch, { type: 'MELT', metal: 'GOLD', inFine: +(available + 1).toFixed(3), outFine: 1 }, MPIN)
  expect(melt.status, JSON.stringify(melt.body)).toBe(409)
  const sell = await api(request, 'post', token, '/app/exchange', branch,
    { side: 'SELL', partyId: party.id, metal: 'GOLD', lines: [{ weight: +(available + 1).toFixed(3), touch: 100 }], rate: 0 })
  expect(sell.status, JSON.stringify(sell.body)).toBe(409)
  expect(delta(p0, await pool(request, token, branch))).toEqual({ kacha: 0, bullion: 0, reserved: 0 })
})
