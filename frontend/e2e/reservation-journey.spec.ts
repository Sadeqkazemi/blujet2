import { expect, test, type Page } from '@playwright/test';
import { loginAs } from './helpers/login';

// Generous timeout: the shared login helper may wait out the auth rate limit.
test.setTimeout(300_000);

const API_URL = process.env.E2E_API_URL ?? 'http://localhost:3000';

/** Creates a fresh, unambiguous SCHEDULED flight instance via the backend's
 * non-production test hook — the seed's own instances are a mix of past
 * "DEPARTED" bulk demo rows and one deliberately-past-dated "SCHEDULED" row
 * (a pre-existing Phase 1 seed quirk), so picking one by sorting is
 * unreliable for a date-based search test. */
async function createFreshInstanceDate(page: Page): Promise<string> {
  const token = await page.evaluate(async (api) => {
    const res = await fetch(`${api}/auth/refresh`, { method: 'POST', credentials: 'include' });
    const body = (await res.json()) as { data?: { accessToken?: string } };
    return body.data?.accessToken ?? '';
  }, API_URL);
  const instance = await page.evaluate(
    async ({ api, token }) => {
      const res = await fetch(`${api}/reservation/_test/flight-instance`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = (await res.json()) as { data?: { departureAt: string } };
      return body.data;
    },
    { api: API_URL, token },
  );
  if (!instance) throw new Error('failed to create a test flight instance');
  return instance.departureAt.slice(0, 10);
}

test('BOARD_CHAIR locks a seat on the seat map, sees it reflected, then releases it', async ({ page }) => {
  await loginAs(page, 'chair');
  await page.getByRole('link', { name: 'هواپیما' }).click();
  await expect(page.getByRole('heading', { name: 'سامانه رزرواسیون' })).toBeVisible();

  await page.getByRole('button', { name: 'مدیریت رزروها' }).click();
  await expect(page.getByText('THR', { exact: false }).first()).toBeVisible({ timeout: 15000 });
  await page.getByRole('button', { name: /^نقشهٔ صندلی EP-/ }).first().click();

  await expect(page.getByText(/اشغال/)).toBeVisible();
  // Seat 3B is free in the seed data (3A/3C are sold, 4A is locked).
  const seat = page.getByRole('button', { name: '3B', exact: true });
  await seat.click();
  await page.getByRole('button', { name: 'لاک صندلی' }).click();
  await expect(page.getByText(/لاک شد/)).toBeVisible();

  const chip = page.getByRole('button', { name: '3B ×' });
  await expect(chip).toBeVisible();
  await chip.click();
});

test('IT Manager issues a manual PNR, finds it in PNR management, then cancels it', async ({ page }) => {
  await loginAs(page, 'itadmin');
  const date = await createFreshInstanceDate(page);

  await page.getByRole('link', { name: 'سامانه رزرواسیون' }).click();
  await page.getByRole('button', { name: 'رزرو جدید' }).click();

  await page.fill('input[placeholder="مبدأ"]', 'THR');
  await page.fill('input[placeholder="مقصد"]', 'DXB');
  await page.fill('input[placeholder="۱۴۰۵/۰۵/۱۲"]', date);
  await page.getByRole('button', { name: 'جستجو' }).click();

  await page.getByRole('button', { name: 'انتخاب صندلی' }).first().click();
  const freeSeat = page.getByRole('button', { name: '10A', exact: true });
  await freeSeat.click();
  await page.fill('#seat-pname', 'مسافر تست E2E');
  await page.getByRole('button', { name: 'صدور PNR و بلیط' }).click();
  await expect(page.getByText(/صادر شد/)).toBeVisible();

  await page.getByRole('button', { name: 'مدیریت رزروها' }).click();
  await page.fill('input[placeholder="جستجو با کد PNR یا نام مسافر…"]', 'مسافر تست E2E');
  await expect(page.getByText('مسافر تست E2E').first()).toBeVisible();

  await page.getByRole('button', { name: /^BJ/ }).first().click();
  await page.getByRole('button', { name: 'لغو رزرو' }).click();
  // Cancelling closes the detail modal and shows a page-level notice.
  await expect(page.getByText('رزرو لغو شد.')).toBeVisible();
});

test('SENIOR_MANAGER sees the seat map read-only — no lock or issue controls', async ({ page }) => {
  await loginAs(page, 'senior.rahimi');
  await page.getByRole('link', { name: 'سامانه رزرواسیون' }).click();
  await page.getByRole('button', { name: 'مدیریت رزروها' }).click();
  await expect(page.getByText('THR', { exact: false }).first()).toBeVisible({ timeout: 15000 });
  await page.getByRole('button', { name: /^نقشهٔ صندلی EP-/ }).first().click();

  await expect(page.getByText(/اشغال/)).toBeVisible();
  const seat = page.getByRole('button', { name: '5B', exact: true });
  await expect(seat).toBeDisabled();
});

test('Non-reservation role has no reservation nav entry (role isolation)', async ({ page }) => {
  await loginAs(page, 'finance.karimi');
  await expect(page.getByRole('link', { name: 'سامانه رزرواسیون' })).not.toBeVisible();
  await expect(page.getByRole('link', { name: 'هواپیما' })).not.toBeVisible();
});
