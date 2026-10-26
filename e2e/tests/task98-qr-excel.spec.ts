import { readFileSync } from 'node:fs';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { login, PW } from './helpers';

// TASK-98: QR image (components/QrImage.tsx, <img alt="QR code"> PNG data URL) on the Girvi receipt (girviNo, 52px)
// and the showroom draft slip (draftNo, 96px); CsvExportButton's adjacent 'Excel' button downloads <name>.xlsx.
async function apiToken(request: APIRequestContext, user: string): Promise<string> {
  return (await (await request.post('/api/auth/login', { data: { login: user, password: PW } })).json()).accessToken as string;
}
async function apiJson(request: APIRequestContext, token: string, path: string) {
  const r = await request.get(`/api${path}`, { headers: { Authorization: `Bearer ${token}`, 'X-Branch-Id': 'all' } });
  return r.json();
}
const istToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // businessDayISO

async function expectQr(page: Page, size: number) {
  const qr = page.locator('.print-area').getByRole('img', { name: 'QR code', exact: true });
  await expect(qr).toHaveCount(1); // QrImage renders nothing until qrcode (lazy) has produced the data URL
  await expect(qr).toBeVisible();
  await expect(qr).toHaveAttribute('src', /^data:image\/png;base64,/);
  await expect(qr).toHaveAttribute('width', String(size));
  expect(await qr.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
}

test.beforeEach(async ({ page }) => {
  await login(page, 'demo.owner');
  await page.waitForURL(/\/admin/);
});

test('girvi detail: receipt carries a QR code of the girvi no.', async ({ page, request }) => {
  const token = await apiToken(request, 'demo.owner');
  const g = ((await apiJson(request, token, '/app/girvi?page=1&pageSize=1')).items as Array<{ id: number; girviNo: number }>)[0];
  test.skip(!g, 'demo data has no girvi');
  await page.goto(`/app/girvi/${g!.id}`);
  const receipt = page.locator('.print-area');
  await expect(receipt).toContainText('Girvi / Pledge Receipt');
  await expect(receipt).toContainText(`#${g!.girviNo} ·`);
  await expectQr(page, 52);
});

test('draft slip: carries a QR code of the draft no.', async ({ page, request }) => {
  const token = await apiToken(request, 'demo.owner');
  const d = ((await apiJson(request, token, '/app/drafts?page=1&pageSize=1')).items as Array<{ id: number; draftNo: number }>)[0];
  test.skip(!d, 'demo data has no showroom draft (phase7-drafts.spec creates some)');
  await page.goto(`/app/billing/drafts/${d!.id}/slip`);
  const slip = page.locator('.print-area');
  await expect(slip).toContainText('Showroom draft — show at the billing counter');
  await expect(slip).toContainText(`#${d!.draftNo}`);
  await expectQr(page, 96);
});

// Lists rendering <CsvExportButton>: Excel = same rows as the CSV, filename with .csv swapped for .xlsx.
const lists: Array<{ name: string; path: string; file: () => string }> = [
  { name: 'udhar list', path: '/app/udhari/list', file: () => 'udhar-list.xlsx' },
  { name: 'income / expense', path: '/app/income_expense', file: () => 'income-expense.xlsx' },
  { name: 'day book all-in-one', path: '/app/daybook/all-in-one', file: () => `day-book-${istToday()}-${istToday()}.xlsx` },
];
for (const l of lists) {
  test(`excel export: ${l.name} downloads an .xlsx`, async ({ page }) => {
    await page.goto(l.path);
    await expect(page.getByRole('button', { name: 'Export CSV' })).toBeVisible();
    const excel = page.getByRole('button', { name: 'Excel', exact: true });
    await expect(excel).toBeEnabled();
    const [download] = await Promise.all([page.waitForEvent('download'), excel.click()]);
    expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
    expect(download.suggestedFilename()).toBe(l.file());
    await expect(page.getByText('Excel export failed')).toHaveCount(0);
    const path = await download.path();
    expect(readFileSync(path).subarray(0, 2).toString('latin1'), 'xlsx is a zip (PK header)').toBe('PK');
  });
}
