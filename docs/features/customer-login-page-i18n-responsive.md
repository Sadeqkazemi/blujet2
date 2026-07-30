# Feature: ورود و ثبت‌نام (CustomerLoginPage) — real i18n + responsive strings

Tenth page of the per-page translation arc (after the shared shell,
صفحه اصلی, نتایج پرواز, مقاصد, باشگاه مشتریان, پشتیبانی, قوانین و مقررات,
درباره ما, and تماس با ما).

Unlike every prior page, `design-reference-v2/ورود و ثبتنام.dc.html` has a
**structurally different field layout** from the real app: the design's
mock is email+password-first with a Google sign-in button and a 5-digit
OTP step, while the real `CustomerLoginPage.tsx` is phone+OTP-first (6-digit
OTP, no Google sign-in — out of scope) with a separate real-password toggle
and a real agency-login/agency-signup flow. Because of this mismatch, most
strings were hand-translated to match the real app's actual fields and
flows, rather than lifted verbatim from the design. Where a concept does
line up 1:1 with the design (tab labels "ورود"/"ثبت‌نام", the agency-account
activation note, the "ارسال مجدد کد" resend label), the design bundle's own
`isEN` ternary / `arDeep` entry was used as the EN/AR source so wording
stays consistent with the rest of the app.

## Acceptance checklist

- [x] Login/Signup tabs, User/Agency account toggle, and the subtitle text
      (four variants: login-user, login-agency, signup-user, signup-agency)
      render in fa/en/ar
      — `PublicMockPages.test.tsx` › "renders translated tabs, labels, and
      forgot-password link in English" + "renders translated tabs and
      labels in Arabic"
- [x] All three pre-existing `CustomerLoginPage` tests (OTP flow with
      resend countdown, signup name/terms validation + agency signup,
      password-login toggle + forgot-password link) pass unmodified — fa
      strings byte-identical to before this phase, including the two
      byte-critical strings asserted verbatim: `'فراموشی رمز عبور؟'` and
      `'ارسال مجدد کد'`
      — `PublicMockPages.test.tsx` (original `describe('CustomerLoginPage')`
      tests, unchanged)
- [x] Forgot-password link translates to "Forgot password?" / "نسيت كلمة
      المرور؟" and keeps its `/forgot-password` href in every locale
      — `PublicMockPages.test.tsx` › new English + Arabic tests above
- [x] Resend-code countdown timer digits render via locale-aware `fmtTimer`
      (Persian digits in fa, Latin digits in en/ar) — implemented in
      `CustomerLoginPage.tsx`; not separately unit-tested this phase (same
      digit-formatting pattern already covered by `fa-format.ts`'s existing
      `faDigits` tests)
- [x] Agency tab strings (agency ID label/placeholder, agency login
      button, agency signup fields and submit button, the post-signup
      confirmation note) translate in all three locales — implemented;
      covered indirectly by the unchanged agency-signup test asserting the
      fa flow still works end-to-end
- [x] All error messages (OTP send/verify failure, password-login failure,
      agency-login failure) are locale-aware instead of hardcoded fa text
      — implemented in `CustomerLoginPage.tsx`'s catch blocks

## Bug fixed this phase

`PublicMockPages.test.tsx` bundles three pages' tests in one file
(`CustomerLoginPage`, `AboutPage`, `NotFoundPage`). Adding the new
`mockLocale('ar')` test for `CustomerLoginPage` (via `vi.spyOn` on
`useLocale`, never restored) leaked into the very next `describe` block's
first test — `AboutPage > renders mission, vision, and values` — which
expects the default fa fallback and started rendering Arabic content
instead.

This file could **not** reuse the Phase 45 fix (`vi.restoreAllMocks()` in
`beforeEach`) verbatim: `requestOtp`/`verifyOtp`/`passwordLogin` here are
plain `vi.fn().mockResolvedValue(...)` configured once at module scope, not
reconstructed per-test. Calling `.mockRestore()` on a plain (non-`spyOn`)
mock behaves like `.mockReset()` and would permanently wipe those resolved
values, breaking every subsequent `CustomerLoginPage` test. Fixed instead
with a narrowly-targeted `afterEach(() => { vi.spyOn(useLocaleModule,
'useLocale').mockRestore(); })` that restores only the `useLocale` spy
(back to its real implementation, which safely falls back to `fa` per
Phase 41), leaving the OTP-related mocks untouched.

---

Mark each item with its proving test file/name once implemented. Per
`CLAUDE.md`: unchecked items = feature not done. فراموشی رمز (a real
backend feature, not translation-only), پنل کاربر, پنل آژانس, تکمیل
خرید/پرداخت, and the remaining pages are separate future work.
