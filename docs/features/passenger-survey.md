# Feature: نظرسنجی مسافران (Passenger Satisfaction Survey)

**Status: DRAFT — awaiting explicit user approval before any code is
written**, per `CLAUDE.md`'s workflow rule 1.

Found across three design files: `پنل مدیر IT.dc.html` (creates/
configures the survey), and `پنل مدیر عامل.dc.html` / `پنل مدیر
ارشد.dc.html` / `پنل رئیس هیئت مدیره.dc.html` (each renders a read-only
results view + an AI "تحلیل" button per flight). See `docs/API.md`'s
Phase 66 (DRAFT) section for the full endpoint shapes and scope
decisions (SMS-only delivery — no email field exists on `Passenger`;
one overall rating + comment per response, not per-question scoring;
lazy materialization hooked into the existing `materializeFlownBookings`
call, no cron; a new `SurveySummaryProvider` AI abstraction calling the
Anthropic API directly, since CLAUDE.md scopes `ml-service` to exactly
two unrelated endpoints; real per-call token usage logging via a new
`AiUsageLog` table, closing a pre-existing CLAUDE.md-mandated gap the
Phase 6 pricing-AI feature never filled).

## Acceptance checklist

### IT_MANAGER configuration
- [ ] `GET /survey/settings` returns `{ enabled, title, updatedAt,
      updatedByLabelFa }`; `IT_MANAGER` only, 403 for every other role.
- [ ] `PATCH /survey/settings` updates `enabled`/`title`, writes an
      audit-log entry (`AuditCategory.SURVEY`), `IT_MANAGER` only.
- [ ] `GET /survey/questions` returns the ordered question list, seeded
      with the design's 5 defaults.
- [ ] `POST /survey/questions` appends a question at the next `order`;
      `IT_MANAGER` only; validates non-empty `label`.
- [ ] `DELETE /survey/questions/:id` removes a question; `IT_MANAGER`
      only; 404 for an unknown id.
- [ ] `GET /survey/stats` returns `{ flightsWithSurvey, totalResponses,
      avgRating, recentResponses (latest 8) }`, computed server-side
      (SQL), `IT_MANAGER` only.

### Lazy invite creation + SMS delivery
- [ ] A booking transitioning `TICKETED → FLOWN` via
      `materializeFlownBookings` creates exactly one `SurveyInvite` for
      that booking when `SurveySettings.enabled` is true, and sends
      exactly one `SURVEY_INVITE` SMS to the booking's primary
      passenger's decrypted mobile, containing a link with the invite's
      token.
- [ ] Calling `materializeFlownBookings` again for an already-FLOWN
      booking does not create a second `SurveyInvite` or send a second
      SMS (idempotent).
- [ ] When `SurveySettings.enabled` is false, no `SurveyInvite` is
      created on the `FLOWN` transition.
- [ ] SMS send failure (mock provider returns `success: false`) does not
      throw or block the booking-status materialization — best-effort,
      matching every other non-critical side effect in this codebase.

### Public survey submission
- [ ] `GET /survey/:token` returns the question list + minimal flight
      context for a valid, unanswered, non-expired-settings invite — no
      auth required.
- [ ] `GET /survey/:token` 404s for an unknown token.
- [ ] `GET /survey/:token` 409s (`ALREADY_SUBMITTED`) if a
      `SurveyResponse` already exists for that invite.
- [ ] `GET /survey/:token` 409s (`SURVEY_DISABLED`) if
      `SurveySettings.enabled` is false.
- [ ] `POST /survey/:token` with `{ rating: 1-5, comment? }` creates a
      `SurveyResponse` and sets `SurveyInvite.respondedAt`.
- [ ] `POST /survey/:token` rejects `rating` outside 1-5 with 400.
- [ ] `POST /survey/:token` on an already-answered token 409s rather
      than creating a duplicate response (also enforced at the DB level
      via `SurveyResponse.inviteId @unique`).
- [ ] Rate limiting is applied per-IP on both `GET` and `POST`.

### Executive read-only results + AI summary
- [ ] `GET /survey/results` returns one row per flight instance with at
      least one response (`flightNo, route, airline, date, count,
      avgRating`), computed via SQL aggregation; accessible to `CEO`,
      `SENIOR_MANAGER`, `BOARD_CHAIR`; 403 for every other role
      (including `IT_MANAGER`, `FINANCE_MANAGER`, `COMMERCIAL_MANAGER`).
- [ ] `GET /survey/results` returns `disabled: true` + an empty list
      when `SurveySettings.enabled` is false, instead of an empty-state.
- [ ] `POST /survey/results/:flightNo/analyze` calls
      `SurveySummaryProvider.summarize` with that flight's non-empty
      comments using the design's exact prompt template, returns
      `{ summary }`, and writes one `AiUsageLog` row with the real
      `input_tokens`/`output_tokens` from the Anthropic response.
- [ ] When `ANTHROPIC_API_KEY` is unset (or the call errors/times out),
      `POST /survey/results/:flightNo/analyze` still returns 200 with
      the design's fallback string (`"خلاصه‌ای از نظرات این پرواز در
      دسترس نیست."`) — never a 500, matching CLAUDE.md's graceful-
      degradation rule — and does **not** write an `AiUsageLog` row for
      the failed attempt.
- [ ] `POST /survey/results/:flightNo/analyze` is rate-limited per-user.
- [ ] Same role scoping as `GET /survey/results` (403 for everyone else).

### Frontend
- [ ] New public page `SurveyPage.tsx` (route `/survey/:token`): shows
      question prompts, a 1-5 rating control, an optional comment
      field, submit button; shows a friendly message instead of the form
      for the 404/`ALREADY_SUBMITTED`/`SURVEY_DISABLED` cases.
- [ ] New IT-manager page wired to `PANEL_NAV.IT_MANAGER`'s `survey` key:
      enable toggle, question list with add/remove, stats card,
      recent-responses feed.
- [ ] New shared read-only results page wired to `PANEL_NAV`'s `survey`
      key for `CEO`, `SENIOR_MANAGER`, `BOARD_CHAIR`: per-flight
      count/avg rating rows, "تحلیل با هوش مصنوعی" button per row with a
      loading state, rendered summary text (treated as plain untrusted
      text, never `dangerouslySetInnerHTML`).
- [ ] Frontend never calls `fetch`/`axios` directly — new
      `frontend/src/api/survey.ts` client, one file per the existing
      convention.

### Tests
- [ ] Backend unit tests for the lazy-invite-creation logic (enabled/
      disabled, idempotency, SMS-failure-doesn't-throw).
- [ ] Backend unit tests for `SurveySummaryProvider` (missing key →
      null, timeout → null, real success path mocked at the fetch
      boundary).
- [ ] Backend e2e tests (Jest+Supertest, real Postgres): every endpoint
      above — happy path, auth failure, validation failure, ownership/
      token cases, the disabled-survey banner case, and the AI-analyze
      fallback-on-failure case.
- [ ] Frontend Vitest/RTL tests for `SurveyPage.tsx` (submit, already-
      answered, disabled), the IT config page, and the exec results
      page (including the analyze-button loading + summary render).

A feature is COMPLETE only when every item above is checked off with the
specific test file/name that proves it, per CLAUDE.md's Testing section.
