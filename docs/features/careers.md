# Feature: فرصت‌های شغلی (Careers)

**Status: COMPLETE.** See `docs/API.md`'s Phase 67 section for the full
endpoint shapes and scope decisions, including a post-implementation
correction: the public listing/application pages and the SITE_ADMIN
application-review UI (list/detail/refer/hire/reject) have **no design
file** — only a small "فرصت‌های شغلی" posting-management card grid inside
`پنل ادمین سایت.dc.html` does (title/dept/city + type badge + "ویرایش",
no delete). The public pages and the review UI were built by extension
of this codebase's existing visual language, approved by the user before
implementation. Job-posting CRUD lives on the SITE_ADMIN `media`
(مدیریت سایت) tab matching the design; the `jobapps` tab is the dark
applications-review queue only. Resume upload is made real (the
design's own mock never actually persists the picked file); a small
self-contained resume-storage slice on `JobApplication` instead of
reusing `StoredFile` (which requires an authenticated `User` owner a job
applicant doesn't have); the mock's own `getJob(id) || getActiveJobs()[0]`
silent-fallback bug is not replicated (real 404 on an unknown/inactive
job id instead); the referral-target list is computed from real
`COMMERCIAL_MANAGER`/`FINANCE_MANAGER` staff plus the singleton
`CEO`/`SENIOR_MANAGER` accounts; no delete action (deactivate only,
matching the design).

## Acceptance checklist

### Public: job listing + application
- [x] `GET /careers/jobs` returns only active postings
      (`{ id, title, dept, city, type }[]`), no auth required. —
      `test/careers.e2e-spec.ts` "GET /careers/jobs returns only active
      postings; GET /careers/jobs/:id 404s for unknown or inactive"
- [x] `GET /careers/jobs/:id` returns full posting detail incl.
      `generalReqs`/`specialReqs`; 404 for an unknown id. — same test.
- [x] `GET /careers/jobs/:id` 404s for a **deactivated** posting (real
      fix over the design mock's silent fallback-to-first-active-job
      bug). — same test.
- [x] `POST /careers/jobs/:id/apply` with a valid multipart body incl. a
      PDF resume creates a `JobApplication` with `status: SUBMITTED`
      and a snapshotted `jobTitleSnapshot`. —
      `test/careers.e2e-spec.ts` "happy path with a PDF resume creates a
      SUBMITTED application"
- [x] `POST /careers/jobs/:id/apply` rejects a non-PDF or >3 MB resume
      file with 400. — `test/careers.e2e-spec.ts` "rejects a non-PDF
      resume with 400" / "rejects an oversize resume with 400"
- [x] `POST /careers/jobs/:id/apply` succeeds without a resume file
      (resume columns stay null) — matches the design's own client-side
      validation, which never requires the file. —
      `test/careers.e2e-spec.ts` "succeeds without a resume file"
- [x] `POST /careers/jobs/:id/apply` validates first name, last name,
      national ID, and phone as required (matches the design's own
      `submit()` guard); national ID checksum-validated server-side. —
      `test/careers.e2e-spec.ts` "validates required fields and the
      national-ID checksum"
- [x] `POST /careers/jobs/:id/apply` is rate-limited per-IP. —
      `test/careers.e2e-spec.ts` "is rate-limited per-IP"
- [x] National ID is stored encrypted at rest (`nationalIdEnc`) with a
      deterministic hash (`nationalIdHash`) for the admin search box —
      never stored or logged in plaintext. —
      `test/careers.e2e-spec.ts` "national ID is stored encrypted,
      never in plaintext"

### SITE_ADMIN: job-posting CRUD
- [x] `GET /careers/postings` returns all postings (active + inactive);
      `SITE_ADMIN` only, 403 for every other role. —
      `test/careers.e2e-spec.ts` "GET/POST/PATCH /careers/postings —
      SITE_ADMIN only, 403 for CEO"
- [x] `POST /careers/postings` creates a posting with `active: true` by
      default; writes an audit-log entry (`AuditCategory.CONTENT`). —
      same test.
- [x] `PATCH /careers/postings/:id` edits any subset of fields incl.
      `active` (the design's activate/deactivate toggle folds into this
      endpoint); writes an audit-log entry. — same test.
- [x] Deactivating a posting removes it from `GET /careers/jobs` (public
      listing) but existing `JobApplication` rows referencing it keep
      their `jobTitleSnapshot` unaffected. — same test (asserts the
      deactivated posting id is absent from the public list).

### SITE_ADMIN: application review
- [x] `GET /careers/applications` returns a list with `q` (name/
      national-id/phone/email) and `jobTitle` filters; `SITE_ADMIN`
      only, 403 for every other role (including `IT_MANAGER`,
      `COMMERCIAL_MANAGER`, `FINANCE_MANAGER`, `CEO`). —
      `test/careers.e2e-spec.ts` "GET /careers/applications — SITE_ADMIN
      only, 403 for other exec roles"
- [x] `GET /careers/applications/:id` returns full detail incl.
      `eduEntries`/`workEntries`/`langEntries`, `history`, and the
      computed referral-target list (real `COMMERCIAL_MANAGER`/
      `FINANCE_MANAGER` staff + the singleton `CEO`/`SENIOR_MANAGER`). —
      `test/careers.e2e-spec.ts` "returns full detail incl. computed
      referral targets"; unit-level in
      `src/modules/careers/careers.service.spec.ts` "referralTargets"
- [x] `GET /careers/applications/:id/resume` streams the stored PDF for
      an application that has one; 404 for one that doesn't. —
      `test/careers.e2e-spec.ts` "streams the PDF; 404 when there is
      none"
- [x] `PATCH /careers/applications/:id/refer` sets `status: REFERRED`,
      `assigneeId`, and appends a history entry; only legal from
      `SUBMITTED`/`REFERRED` (409 from `HIRED`/`REJECTED`). —
      `test/careers.e2e-spec.ts` "refer/hire/reject transitions + audit
      log; illegal transitions 409"
- [x] `PATCH /careers/applications/:id/hire` sets `status: HIRED` and
      appends a history entry; same legality guard. — same test.
- [x] `PATCH /careers/applications/:id/reject` sets `status: REJECTED`
      and appends a history entry; same legality guard. — same test
      (409 asserted on reject-after-hire).
- [x] All three mutating endpoints write an audit-log entry
      (`AuditCategory.CONTENT`). — same test.

### CareersSettings (footer visibility)
- [x] `GET /careers/settings` returns `{ enabled }`, no auth required. —
      `test/careers.e2e-spec.ts` "GET /careers/settings is public;
      PATCH is SITE_ADMIN only and audits"
- [x] `PATCH /careers/settings` toggles `enabled`; `SITE_ADMIN` only,
      writes an audit-log entry. — same test.
- [x] The public footer's "فرصت‌های شغلی" link is present only when
      `enabled` is true. — `src/components/public/PublicFooter.test.tsx`
      "hides the careers link when disabled, shows it when enabled";
      `src/hooks/useCareersEnabled.test.ts`
- [x] The careers listing/application pages remain reachable by direct
      URL regardless of `enabled` (matches the design: the toggle only
      controls the footer link, not the pages themselves). — same
      e2e test (`GET /careers/jobs` still 200s after disabling settings).

### Frontend
- [x] New public page `CareersPage.tsx` (route `/careers`): active job
      cards, empty state when no active postings. —
      `src/features/public-site/CareersPage.test.tsx`
- [x] New public page `CareersApplyPage.tsx` (route
      `/careers/:jobId/apply`): general/specialized requirements,
      full application form incl. repeatable education/work/language
      groups, PDF resume picker, success state, real validation errors. —
      `src/features/public-site/CareersApplyPage.test.tsx`
- [x] New SITE_ADMIN page (`CareersAdminPage.tsx`, `jobapps` tab):
      posting list + create/edit modal + activate/deactivate, and
      application list + detail (with refer/hire/reject actions and a
      resume-download link) — mirrors the design's own tab combining
      both concerns. — `src/features/careers/CareersAdminPage.test.tsx`
- [x] Footer's "فرصت‌های شغلی" link wired to `CareersSettings.enabled`. —
      `src/components/public/PublicFooter.test.tsx`
- [x] Frontend never calls `fetch`/`axios` directly — new
      `frontend/src/api/careers.ts` client. — verified by inspection;
      all page components import from `api/careers.ts` only.

### Tests
- [x] Backend e2e tests (Jest+Supertest, real Postgres): every endpoint
      above — happy path, auth failure, validation failure, the
      inactive-job 404 fix, the resume-required-vs-optional cases, and
      the illegal-status-transition 409 cases. — `test/careers.e2e-spec.ts`
      (16 tests).
- [x] Backend unit tests for national-ID checksum validation reuse
      (existing utility, `src/common/pii-crypto.spec.ts`, unchanged —
      reused verbatim) and the referral-target-list computation. —
      `src/modules/careers/careers.service.spec.ts` (4 tests).
- [x] Frontend Vitest/RTL tests for `CareersPage.tsx` (render, empty
      state), `CareersApplyPage.tsx` (render, validation, submit,
      success), and `CareersAdminPage.tsx` (posting CRUD, application
      review actions). — 3 test files, 12 tests total; plus
      `useCareersEnabled.test.ts` (2 tests) and updated
      `PublicFooter.test.tsx` (+1 test) for the footer-visibility wiring.

A feature is COMPLETE only when every item above is checked off with the
specific test file/name that proves it, per CLAUDE.md's Testing section.
