# Feature: Ticket pricing — proposals, AI analysis, CEO registration (Phase 6)

Covers `docs/API.md` → "Phase 6" and `docs/DB_SCHEMA.md` → "Phase 6".
Scope: Commercial Manager's pricing section (inside its flights tab), the
CEO «تعیین قیمت بلیط» tab, and the first real ml-service implementation
(advisory price suggestion behind the NestJS ai module).

## Acceptance checklist

### Proposals (Commercial Manager)
- [ ] `PUT /pricing/flights/:id/proposal` creates a PENDING proposal (required `proposedPriceIrr`, the design's «نرخ پیشنهادی را وارد کنید» validation) and re-PUT while PENDING edits it
- [ ] PUT on a REGISTERED proposal → 409 («این قیمت دیگر قابل تغییر نیست»)
- [ ] PUT as CEO/other roles → 403; unknown flightInstanceId → 404
- [ ] Commercial's `GET /pricing/proposals` rows show the three states (no proposal / PENDING / REGISTERED) correctly joined to real flight instances

### Registration (CEO)
- [ ] `register {source:PROPOSED}` sets `registeredPriceIrr = proposedPriceIrr`, status REGISTERED, `approvedById/At`, audit row (`category=PRICING`)
- [ ] `register {source:AI}` uses the persisted suggestion price; 409 with a clear message when no suggestion was generated
- [ ] Registering an already-REGISTERED proposal → 409; registering as COMMERCIAL_MANAGER → 403
- [ ] `legal-rate` PATCH stores the CEO's value and is audited; Commercial's PUT can also carry `legalRateIrr` (last write wins, both audited)

### AI analysis (ML service + ai module)
- [ ] `POST /pricing/proposals/ai-analysis` persists `aiSuggestion` (price, reason, factors, season, occasion, confidence, modelVersion) on every PENDING proposal
- [ ] Generation NEVER mutates proposal prices or status (advisory-only assertion)
- [ ] When the ml-service is unreachable, the endpoint degrades gracefully (documented partial/empty result, no 500) and register/propose flows keep working
- [ ] NestJS→ml-service requests carry the internal token; the service rejects missing/wrong tokens (401)
- [ ] ml-service pytest: schema validation, heuristic edge cases (no competitor price, extreme values), model version present in every response
- [ ] Usage is logged (who ran analysis, proposals count) to the audit table

### Frontend
- [ ] CEO tab: 3-step workflow banner, «تحلیل و پیشنهاد قیمت هوش مصنوعی» button with loading state, pending cards with رقبا/پیشنهاد بازرگانی/هوش مصنوعی columns + the vs-competitor delta line, «تأیید بازرگانی» + «ثبت با AI» buttons, legal-rate input row, AI analysis panel (season/occasion/confidence chips + expandable factors), «قیمت‌های ثبت‌شده» list with «قفل‌شده» badge
- [ ] Commercial pricing list: per-row نرخ پیشنهادی/نرخ قانونی/قیمت قفل‌شده + status pill + «تعیین قیمت/ویرایش پیشنهاد/قفل‌شده» button; set-price modal with base/competitor tiles, the three states (editable / pending banner / locked), and the note textarea
- [ ] All prices تومان with Persian digits via the shared money util; dates Jalali
- [ ] Roles without the tab/section (Finance, Board Chair, IT) see nothing and get 403s

### E2E
- [ ] Full loop: Commercial proposes a price for a scheduled flight → CEO sees it pending → runs AI analysis → registers with «ثبت با AI» → Commercial sees the locked price and cannot edit
- [ ] CEO registers a second proposal with «تأیید بازرگانی» (no AI) — works without any AI suggestion
- [ ] ml-service down: CEO's AI button surfaces the graceful failure message; registration by proposed price still works

---

Mark each item with its proving test file/name once implemented. Per
`CLAUDE.md`: unchecked items = feature not done.
