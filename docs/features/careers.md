# Feature: فرصت‌های شغلی (Careers)

**Status: DRAFT — awaiting explicit user approval before any code is
written**, per `CLAUDE.md`'s workflow rule 1.

Two dedicated public design files (`فرصت‌های شغلی.dc.html`, the job
listing page, and `فرصت‌های شغلی-فرم درخواست.dc.html`, the per-job
application form) plus SITE_ADMIN's own `jobapps` tab (found inside
`پنل ادمین سایت.dc.html`) for posting CRUD + application review. See
`docs/API.md`'s Phase 67 (DRAFT) section for the full endpoint shapes
and scope decisions: job-posting CRUD folds into one new dedicated
`jobapps` tab rather than the much larger, still-unbuilt "content
settings" tab the design physically groups it under; resume upload is
made real (the design's own mock never actually persists the picked
file); a small self-contained resume-storage slice on `JobApplication`
instead of reusing `StoredFile` (which requires an authenticated
`User` owner a job applicant doesn't have); the mock's own
`getJob(id) || getActiveJobs()[0]` silent-fallback bug is not
replicated (real 404 on an unknown/inactive job id instead); the
referral-target list is computed from real `COMMERCIAL_MANAGER`/
`FINANCE_MANAGER` staff plus the singleton `CEO`/`SENIOR_MANAGER`
accounts; no delete action (deactivate only, matching the design).

## Acceptance checklist

### Public: job listing + application
- [ ] `GET /careers/jobs` returns only active postings
      (`{ id, title, dept, city, type }[]`), no auth required.
- [ ] `GET /careers/jobs/:id` returns full posting detail incl.
      `generalReqs`/`specialReqs`; 404 for an unknown id.
- [ ] `GET /careers/jobs/:id` 404s for a **deactivated** posting (real
      fix over the design mock's silent fallback-to-first-active-job
      bug).
- [ ] `POST /careers/jobs/:id/apply` with a valid multipart body incl. a
      PDF resume creates a `JobApplication` with `status: SUBMITTED`
      and a snapshotted `jobTitleSnapshot`.
- [ ] `POST /careers/jobs/:id/apply` rejects a non-PDF or >3 MB resume
      file with 400.
- [ ] `POST /careers/jobs/:id/apply` succeeds without a resume file
      (resume columns stay null) — matches the design's own client-side
      validation, which never requires the file.
- [ ] `POST /careers/jobs/:id/apply` validates first name, last name,
      national ID, and phone as required (matches the design's own
      `submit()` guard); national ID checksum-validated server-side.
- [ ] `POST /careers/jobs/:id/apply` is rate-limited per-IP.
- [ ] National ID is stored encrypted at rest (`nationalIdEnc`) with a
      deterministic hash (`nationalIdHash`) for the admin search box —
      never stored or logged in plaintext.

### SITE_ADMIN: job-posting CRUD
- [ ] `GET /careers/postings` returns all postings (active + inactive);
      `SITE_ADMIN` only, 403 for every other role.
- [ ] `POST /careers/postings` creates a posting with `active: true` by
      default; writes an audit-log entry (`AuditCategory.CONTENT`).
- [ ] `PATCH /careers/postings/:id` edits any subset of fields incl.
      `active` (the design's activate/deactivate toggle folds into this
      endpoint); writes an audit-log entry.
- [ ] Deactivating a posting removes it from `GET /careers/jobs` (public
      listing) but existing `JobApplication` rows referencing it keep
      their `jobTitleSnapshot` unaffected.

### SITE_ADMIN: application review
- [ ] `GET /careers/applications` returns a list with `q` (name/
      national-id/phone/email) and `jobTitle` filters; `SITE_ADMIN`
      only, 403 for every other role (including `IT_MANAGER`,
      `COMMERCIAL_MANAGER`, `FINANCE_MANAGER`, `CEO`).
- [ ] `GET /careers/applications/:id` returns full detail incl.
      `eduEntries`/`workEntries`/`langEntries`, `history`, and the
      computed referral-target list (real `COMMERCIAL_MANAGER`/
      `FINANCE_MANAGER` staff + the singleton `CEO`/`SENIOR_MANAGER`).
- [ ] `GET /careers/applications/:id/resume` streams the stored PDF for
      an application that has one; 404 for one that doesn't.
- [ ] `PATCH /careers/applications/:id/refer` sets `status: REFERRED`,
      `assigneeId`, and appends a history entry; only legal from
      `SUBMITTED`/`REFERRED` (409 from `HIRED`/`REJECTED`).
- [ ] `PATCH /careers/applications/:id/hire` sets `status: HIRED` and
      appends a history entry; same legality guard.
- [ ] `PATCH /careers/applications/:id/reject` sets `status: REJECTED`
      and appends a history entry; same legality guard.
- [ ] All three mutating endpoints write an audit-log entry
      (`AuditCategory.CONTENT`).

### CareersSettings (footer visibility)
- [ ] `GET /careers/settings` returns `{ enabled }`, no auth required.
- [ ] `PATCH /careers/settings` toggles `enabled`; `SITE_ADMIN` only,
      writes an audit-log entry.
- [ ] The public footer's "فرصت‌های شغلی" link is present only when
      `enabled` is true.
- [ ] The careers listing/application pages remain reachable by direct
      URL regardless of `enabled` (matches the design: the toggle only
      controls the footer link, not the pages themselves).

### Frontend
- [ ] New public page `CareersPage.tsx` (route `/careers`): active job
      cards, empty state when no active postings.
- [ ] New public page `CareersApplyPage.tsx` (route
      `/careers/:jobId/apply`): general/specialized requirements,
      full application form incl. repeatable education/work/language
      groups, PDF resume picker, success state, real validation errors.
- [ ] New SITE_ADMIN page (`CareersAdminPage.tsx`, `jobapps` tab):
      posting list + create/edit modal + activate/deactivate, and
      application list + detail (with refer/hire/reject actions and a
      resume-download link) — mirrors the design's own tab combining
      both concerns.
- [ ] Footer's "فرصت‌های شغلی" link wired to `CareersSettings.enabled`.
- [ ] Frontend never calls `fetch`/`axios` directly — new
      `frontend/src/api/careers.ts` client.

### Tests
- [ ] Backend e2e tests (Jest+Supertest, real Postgres): every endpoint
      above — happy path, auth failure, validation failure, the
      inactive-job 404 fix, the resume-required-vs-optional cases, and
      the illegal-status-transition 409 cases.
- [ ] Backend unit tests for national-ID checksum validation reuse
      (existing utility) and the referral-target-list computation.
- [ ] Frontend Vitest/RTL tests for `CareersPage.tsx` (render, empty
      state), `CareersApplyPage.tsx` (render, validation, submit,
      success), and `CareersAdminPage.tsx` (posting CRUD, application
      review actions).

A feature is COMPLETE only when every item above is checked off with the
specific test file/name that proves it, per CLAUDE.md's Testing section.
