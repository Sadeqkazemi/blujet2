import { expect, test, type Page } from '@playwright/test';
import { STAFF_PASSWORD } from './helpers/login';
import dayjsBase from 'dayjs';
import jalaliday from 'jalaliday';
import { faDigits } from '../src/lib/fa-format';

// Playwright's Node ESM loader (unlike Vite's bundler resolution used by the
// app itself) can't resolve dayjs's extensionless plugin subpaths, so this
// duplicates jalali.ts's tiny bit of setup rather than importing it.
dayjsBase.extend(jalaliday);
const dayjs = dayjsBase;

test.setTimeout(90_000);

const API_URL = process.env.E2E_API_URL ?? 'http://localhost:3000';

const MONTH_NAMES = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
];

/** Opens the home page's Jalali date picker and clicks the target ISO date,
 * paging forward through months (the search date can be up to ~4 months
 * out — see reservation/pnr.service.ts's _test/flight-instance hook). */
async function pickJalaliDate(page: Page, iso: string) {
  const target = dayjs(iso).calendar('jalali');
  const targetLabel = `${MONTH_NAMES[target.month()]} ${faDigits(target.year())}`;

  await page.getByTestId('home-date').click();
  for (let i = 0; i < 12; i++) {
    const label = await page.getByTestId('home-date-month-label').innerText();
    if (label === targetLabel) break;
    await page.getByTestId('home-date-next-month').click();
  }
  await page.getByTestId(`home-date-day-${target.date()}`).click();
}

/** Fresh SCHEDULED instance (real seeded aircraft/seat map) so the search
 * date is unambiguous and every seat starts free — reuses the reservation
 * module's existing non-production test hook rather than duplicating it. */
async function createFreshInstance(page: Page) {
  const challenge = await page.evaluate(
    async ({ api, password }) => {
      const res = await fetch(`${api}/auth/staff/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'chair', password }),
      });
      return (await res.json()) as { data?: { challengeId?: string } };
    },
    { api: API_URL, password: STAFF_PASSWORD },
  );
  const challengeId = challenge.data?.challengeId;
  if (!challengeId) throw new Error('staff login did not return a challengeId');

  const codeRes = await page.evaluate(
    async (api) => (await fetch(`${api}/auth/_test/last-code/chair`)).json(),
    API_URL,
  );
  const code = (codeRes as { data?: { code?: string } }).data?.code;
  if (!code) throw new Error('no 2FA code available for chair');

  const verify = await page.evaluate(
    async ({ api, challengeId, code }) => {
      const res = await fetch(`${api}/auth/staff/login/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeId, code }),
      });
      return (await res.json()) as { data?: { accessToken?: string } };
    },
    { api: API_URL, challengeId, code },
  );
  const token = verify.data?.accessToken;
  if (!token) throw new Error('staff 2FA verify did not return an access token');

  const created = await page.evaluate(
    async ({ api, token }) => {
      const res = await fetch(`${api}/reservation/_test/flight-instance`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      return (await res.json()) as {
        data?: { departureAt: string; flight: { route: { originCode: string; destCode: string } } };
      };
    },
    { api: API_URL, token },
  );
  if (!created.data) throw new Error('failed to create a fresh flight instance');
  return {
    date: created.data.departureAt.slice(0, 10),
    originCode: created.data.flight.route.originCode,
    destCode: created.data.flight.route.destCode,
  };
}

test('golden path: search -> results -> OTP login -> seat+passenger -> pay -> e-ticket -> refund submission', async ({
  page,
}) => {
  page.on('pageerror', (err) => console.log(`[pageerror] ${err.message}`));

  // Navigate first so the page has a real origin — page.evaluate fetch calls
  // from about:blank fail with no CORS origin to send.
  await page.goto('/');
  const { date, originCode, destCode } = await createFreshInstance(page);
  const phone = `09${String(Date.now()).slice(-9)}`;

  await page.selectOption('#origin', originCode);
  await page.selectOption('#dest', destCode);
  await pickJalaliDate(page, date);
  await page.getByTestId('home-search-submit').click();

  await page.waitForURL('**/results**');
  await expect(page.getByTestId('result-card').first()).toBeVisible();
  await page.getByTestId('result-card').first().getByRole('button', { name: 'انتخاب' }).first().click();

  await page.waitForURL('**/book/**');
  await page.getByTestId('otp-phone').fill(phone);
  await page.getByTestId('otp-phone').locator('..').getByRole('button', { name: 'دریافت کد' }).click();

  await expect(page.getByTestId('otp-code')).toBeVisible();
  const otpRes = await page.evaluate(
    async ({ api, phone }) => (await fetch(`${api}/auth/_test/last-otp/${phone}`)).json(),
    { api: API_URL, phone },
  );
  const otpCode = (otpRes as { data?: { code?: string } }).data?.code;
  expect(otpCode).toBeTruthy();
  await page.getByTestId('otp-code').fill(otpCode!);
  await page.getByRole('button', { name: 'تأیید و ورود' }).click();

  const freeSeat = page.locator('button[data-testid^="seat-"]:not([disabled])').first();
  await expect(freeSeat).toBeVisible();
  await freeSeat.click();
  await page.getByTestId('pax-name-0').fill('مسافر تست پلی‌رایت');
  await page.getByTestId('book-submit').click();

  await page.waitForURL('**/checkout/**');
  await expect(page.getByTestId('pay-submit')).toBeVisible();
  await page.getByTestId('pay-submit').click();

  await page.waitForURL('**/ticket/**', { timeout: 20_000 });
  await expect(page.getByText('صادر شده')).toBeVisible();
  await expect(page.getByText('مسافر تست پلی‌رایت')).toBeVisible();

  await page.getByTestId('open-refund-form').click();
  await page.getByTestId('refund-iban').fill('IR820170000000332211009900');
  await page.getByTestId('submit-refund').click();
  await expect(page.getByText(/درخواست استرداد ثبت شد/)).toBeVisible();
});
