import { expect, test, type Page } from '@playwright/test';
import { loginAs } from './helpers/login';

// Generous timeout: the shared login helper may wait out the auth rate limit.
test.setTimeout(300_000);

const API_URL = process.env.E2E_API_URL ?? 'http://localhost:3000';

async function accessToken(page: Page): Promise<string> {
  return page.evaluate(async (api) => {
    const res = await fetch(`${api}/auth/refresh`, { method: 'POST', credentials: 'include' });
    const body = (await res.json()) as { data?: { accessToken?: string } };
    return body.data?.accessToken ?? '';
  }, API_URL);
}

/** Creates a fresh SCHEDULED instance + issues a manual PNR via API so the
 * design UI (which no longer embeds seat-map / «رزرو جدید») can exercise
 * مدیریت رزروها against a known booking. */
async function issueTestPnr(page: Page, passengerName: string): Promise<string> {
  const token = await accessToken(page);
  const pnr = await page.evaluate(
    async ({ api, token, passengerName }) => {
      const fiRes = await fetch(`${api}/reservation/_test/flight-instance`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const fiBody = (await fiRes.json()) as {
        data?: { id: string; seats?: string[] };
        success?: boolean;
      };
      const flightInstanceId = fiBody.data?.id;
      if (!flightInstanceId) throw new Error('failed to create test flight instance');

      const mapRes = await fetch(`${api}/reservation/seatmap/${flightInstanceId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const mapBody = (await mapRes.json()) as {
        data?: { rows: { seats: { seatCode: string; status: string }[] }[] };
      };
      const free = mapBody.data?.rows
        .flatMap((r) => r.seats)
        .find((s) => s.status === 'FREE')?.seatCode;
      if (!free) throw new Error('no free seat on test instance');

      const issueRes = await fetch(`${api}/reservation/pnr`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          flightInstanceId,
          seatCode: free,
          passengerName,
        }),
      });
      const issueBody = (await issueRes.json()) as { data?: { pnr: string } };
      if (!issueBody.data?.pnr) throw new Error(`issue failed: ${JSON.stringify(issueBody)}`);
      return issueBody.data.pnr;
    },
    { api: API_URL, token, passengerName },
  );
  return pnr;
}

test('IT Manager sees the design four-tab reservation shell', async ({ page }) => {
  await loginAs(page, 'itadmin');
  await page.getByRole('link', { name: 'سامانه رزرواسیون' }).click();
  await expect(page.getByRole('heading', { name: 'سامانه رزرواسیون پرواز' })).toBeVisible();

  await expect(page.getByRole('button', { name: /داشبورد/ })).toBeVisible();
  await expect(page.getByText('وضعیت سرویس‌های سامانه')).toBeVisible();

  await page.getByRole('button', { name: /مدیریت رزروها/ }).click();
  await expect(page.getByText('جستجوی رزرو')).toBeVisible();
  await expect(page.getByText('آخرین رزروهای ثبت‌شده')).toBeVisible();

  await page.getByRole('button', { name: /دسترسی آژانس‌ها/ }).click();
  await expect(
    page.getByText(/آژانس|آژانسی با دسترسی API ثبت نشده است/).first(),
  ).toBeVisible({ timeout: 15000 });

  await page.getByRole('button', { name: /پروازها/ }).click();
  await expect(page.getByPlaceholder('جستجوی پرواز - مسیر یا شماره پرواز')).toBeVisible();
});

test('IT Manager finds an issued PNR in مدیریت رزروها and cancels it', async ({ page }) => {
  await loginAs(page, 'itadmin');
  const passengerName = `مسافر تست E2E ${Date.now()}`;
  const pnr = await issueTestPnr(page, passengerName);

  await page.getByRole('link', { name: 'سامانه رزرواسیون' }).click();
  await page.getByRole('button', { name: /مدیریت رزروها/ }).click();

  await page.fill('input[placeholder="مثلاً AS-88421"]', pnr);
  await page.getByRole('button', { name: 'جستجو' }).click();
  await expect(page.getByText(passengerName).first()).toBeVisible({ timeout: 15000 });

  await page.getByRole('button', { name: pnr, exact: true }).first().click();
  await page.getByRole('button', { name: 'لغو رزرو' }).click();
  await expect(page.getByText('رزرو لغو شد.')).toBeVisible();
});

test('BOARD_CHAIR can open PNR detail with change/cancel controls', async ({ page }) => {
  await loginAs(page, 'chair');
  const passengerName = `مسافر هیئت E2E ${Date.now()}`;
  const pnr = await issueTestPnr(page, passengerName);

  await page.getByRole('link', { name: 'هواپیما' }).click();
  await expect(page.getByRole('heading', { name: 'سامانه رزرواسیون پرواز' })).toBeVisible();
  await page.getByRole('button', { name: /مدیریت رزروها/ }).click();
  await page.fill('input[placeholder="مثلاً AS-88421"]', pnr);
  await page.getByRole('button', { name: 'جستجو' }).click();
  await page.getByRole('button', { name: pnr, exact: true }).first().click();
  await expect(page.getByRole('button', { name: 'ثبت تغییر' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'لغو رزرو' })).toBeVisible();
});

test('SENIOR_MANAGER is view-only on PNR detail', async ({ page }) => {
  await loginAs(page, 'itadmin');
  const passengerName = `مسافر ارشد E2E ${Date.now()}`;
  const pnr = await issueTestPnr(page, passengerName);

  await loginAs(page, 'senior.rahimi');
  await page.getByRole('link', { name: 'سامانه رزرواسیون' }).click();
  await page.getByRole('button', { name: /مدیریت رزروها/ }).click();
  await page.fill('input[placeholder="مثلاً AS-88421"]', pnr);
  await page.getByRole('button', { name: 'جستجو' }).click();
  await page.getByRole('button', { name: pnr, exact: true }).first().click();
  await expect(page.getByText(`رزرو ${pnr}`)).toBeVisible();
  await expect(page.getByRole('button', { name: 'ثبت تغییر' })).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'لغو رزرو' })).not.toBeVisible();
});

test('Non-reservation role has no reservation nav entry (role isolation)', async ({ page }) => {
  await loginAs(page, 'finance.karimi');
  await expect(page.getByRole('link', { name: 'سامانه رزرواسیون' })).not.toBeVisible();
  await expect(page.getByRole('link', { name: 'هواپیما' })).not.toBeVisible();
});
