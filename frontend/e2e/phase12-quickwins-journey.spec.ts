import { expect, test } from '@playwright/test';
import { loginAs } from './helpers/login';

// Generous timeout: the shared login helper may wait out the auth rate limit.
test.setTimeout(240_000);

test('CEO opens گزارش مدیران and sees the real audit feed with role filters', async ({ page }) => {
  await loginAs(page, 'ceo');
  await page.getByRole('link', { name: 'گزارش مدیران' }).click();
  await page.waitForURL('**/panel/mgrreports');

  await expect(page.getByRole('button', { name: 'همه نقش‌ها' })).toBeVisible();
  // The seeded/e2e history guarantees at least one real audit row exists.
  await expect(page.getByText(/گزارش$/).first()).toBeVisible();
});

test('Senior toggles a sibling panel off and back on in دسترسی به پنل‌ها', async ({ page }) => {
  await loginAs(page, 'senior.rahimi');
  await page.getByRole('link', { name: 'دسترسی به پنل‌ها' }).click();
  await page.waitForURL('**/panel/panels');

  const toggle = page.getByRole('switch', { name: 'پنل مدیر بازرگانی' });
  await expect(toggle).toBeVisible();
  const before = await toggle.getAttribute('aria-checked');

  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', before === 'true' ? 'false' : 'true');
  // Restore so repeated runs (and the Commercial panel itself) stay usable.
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', before ?? 'true');
});

test('IT Manager has no working دسترسی به پنل‌ها page (stays «به‌زودی» — no backend for its read-only variant)', async ({
  page,
}) => {
  await loginAs(page, 'itadmin');
  await page.getByRole('link', { name: /دسترسی به پنل‌ها/ }).click();
  await expect(page.getByText('به‌زودی').first()).toBeVisible();
});
