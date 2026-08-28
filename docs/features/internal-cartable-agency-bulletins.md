# Internal cartable and agency bulletins — acceptance checklist

## Management cartable boundary

- [x] Management and employee panels expose only the internal «کارتابل» navigation item; they do not expose a second support-ticket tab.
- [x] SITE_ADMIN remains the sole role that can see every customer/agency support ticket and can forward one to an exact staff account.
- [x] A manager or employee sees a support ticket in the cartable only after SITE_ADMIN forwarded that ticket to that exact account.
- [x] A forwarded manager/employee can read the complete customer/agency conversation and reply with an owned attachment.
- [x] A customer/agency reply remains on the same ticket and stays visible to the assigned manager/employee.
- [x] A manager/employee cannot read, reply to, reassign, create, or change the status of a ticket assigned to another account or not assigned at all.
- [x] The assigned-ticket workspace uses the same status cards, search, 10-row pagination and conversation design as the support-ticket screen.

## Agency notices and amendments

- [x] SITE_ADMIN has an «اصلاحیه و اطلاعیه» navigation page backed by real API data.
- [x] SITE_ADMIN can send a notice or amendment to all active agencies, one active agency, or a selected set of active agencies.
- [x] Selected recipient ids are validated server-side; suspended, deleted, non-agency or unknown users are rejected.
- [x] One recipient-scoped notification is persisted per targeted agency with one shared dispatch id and an audit-log entry.
- [x] SITE_ADMIN can see the persisted send history and exact recipient count for every dispatch.
- [x] An agency sees only notices addressed to its own account in «اطلاعیه و اصلاحیه».
- [x] Clicking an agency notice opens its full body and marks only that recipient notification as read.
- [x] Existing new-flight instructions and ordinary agency notifications remain available in the same agency page.

## Automated proof

- [x] Backend controller/service tests cover role metadata, exact assignee scoping, replies after customer follow-up, audience validation, all/one/many delivery and persisted history.
- [x] Frontend tests cover the cartable-only navigation, assigned-ticket controls, admin audience modes and agency notice opening/read receipt.
- [x] `panels.e2e-spec.ts` locks the SITE_ADMIN sidebar contract including the new notices entry.
- [x] The production nginx API allowlist proxies `/agency-bulletins`; `edge-routing.test.ts` verifies every controller prefix remains reachable after deployment.
- [x] Backend/frontend typecheck, focused tests, production builds and `git diff --check` pass.
