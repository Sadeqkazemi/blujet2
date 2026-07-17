import { expect, test } from '@playwright/test';
import { loginAs } from './helpers/login';

// Generous timeout: the shared login helper may wait out the auth rate limit.
test.setTimeout(300_000);

test('finance manager: مالی tab in ماه mode re-scopes KPIs and shows transactions + settlements with a working reminder', async ({
  page,
}) => {
  await loginAs(page, 'finance.karimi');
  await page.getByRole('link', { name: 'مالی', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'مالی', exact: true })).toBeVisible();
  await expect(page.getByText('ترکیب درآمد')).toBeVisible();

  // Finance-manager-only blocks are visible on this panel.
  await expect(page.getByText('تراکنش‌های مالی اخیر')).toBeVisible();
  await expect(page.getByText('تسویه‌حساب آژانس‌های همکار')).toBeVisible();

  // Switch to ماه mode and pick the most recent month chip — KPI caption re-scopes.
  await page.getByRole('button', { name: 'ماه', exact: true }).click();
  const firstChip = page.locator('button', { hasText: /[۰-۹]{4}$/ }).first();
  await firstChip.click();
  await expect(page.getByText(/کل درآمد ·/)).toBeVisible();

  // Send a reminder on the first non-settled settlement row, if any exists.
  const remindButton = page.getByRole('button', { name: 'ارسال یادآوری' }).first();
  if (await remindButton.isVisible().catch(() => false)) {
    await remindButton.click();
    await expect(page.getByText(/ارسال شد ✓/)).toBeVisible();
  }
});

test('an executive (CEO) sees the chart + KPIs on مالی but not the finance-manager-only blocks', async ({
  page,
}) => {
  await loginAs(page, 'ceo');
  await page.getByRole('link', { name: 'مالی', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'مالی', exact: true })).toBeVisible();
  await expect(page.getByText('ترکیب درآمد')).toBeVisible();
  await expect(page.getByText('کل درآمد ·')).toBeVisible();

  await expect(page.getByText('تراکنش‌های مالی اخیر')).toHaveCount(0);
  await expect(page.getByText('تسویه‌حساب آژانس‌های همکار')).toHaveCount(0);
});

test('passenger search finds a seeded passenger and shows the ticket card', async ({ page }) => {
  await loginAs(page, 'comm.abbasi');
  await page.getByRole('link', { name: 'گزارش مسافران' }).click();
  await expect(page.getByRole('heading', { name: 'جستجوی مسافر' })).toBeVisible();

  await page.getByLabel('جستجوی مسافر').fill('نگار رضایی');
  await page.getByRole('button', { name: 'جستجو' }).click();

  await expect(page.getByText('نگار رضایی').first()).toBeVisible();
  await expect(page.getByText('کد رزرو (PNR)')).toBeVisible();
  await expect(page.getByText('مسیر')).toBeVisible();

  // A query with no match shows the design's empty state.
  await page.getByLabel('جستجوی مسافر').fill('نام-کاملا-ناموجود-xyz');
  await page.getByRole('button', { name: 'جستجو' }).click();
  await expect(page.getByText('مسافری با این نام یافت نشد.')).toBeVisible();
});

test('staff report renders an employee\'s real audit rows via the per-employee tabs', async ({ page }) => {
  await loginAs(page, 'finance.karimi');
  await page.getByRole('link', { name: 'گزارش کارمندان' }).click();
  await expect(page.getByRole('heading', { name: 'گزارش عملکرد کارمندان' })).toBeVisible();

  await page.getByRole('button', { name: /رضا احمدی/ }).click();
  await expect(page.getByText('بررسی پرونده آژانس')).toBeVisible();
  await expect(page.getByText('آژانس', { exact: true })).toBeVisible();
});

test('IT Manager has no مالی nav entry (role isolation)', async ({ page }) => {
  await loginAs(page, 'itadmin');
  await expect(page.getByRole('link', { name: 'مالی', exact: true })).toHaveCount(0);
});
