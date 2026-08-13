# IT employee unit access

## Goal

The IT manager creates an employee account under an organizational unit and
grants capabilities from the same real surfaces that exist in that unit
manager's panel. The employee must see and call only the granted surfaces.

## Unit ownership

| Employee unit | Owning manager panel | Grant catalog source |
| --- | --- | --- |
| Commercial | Commercial Manager | Commercial capabilities |
| Sales | Commercial Manager | Commercial capabilities |
| Finance | Finance Manager | Finance capabilities |
| IT | IT Manager | IT capabilities |

Custom units start without a permission catalog. They cannot receive an
unmapped permission accidentally.

## Acceptance criteria

- The create form contains full name, username, mobile, initial password,
  position/unit, organizational rank, referral scope and grouped permissions.
- Unit cards identify the owning manager panel and changing a unit clears
  permissions selected from the previous unit.
- Every built-in catalog section maps to a real route in the owning manager
  panel or to a documented employee route for the same capability.
- The create API rejects unknown or cross-unit permission keys instead of
  silently dropping them.
- After creation, `GET /panels/nav` is computed from the employee's live grants.
- Revoking a grant removes the related navigation item on the next nav request
  and the protected API returns 403 immediately.
- Read-only and write capabilities remain distinct (`fl_view` does not permit
  flight mutations; `fl_manage` does).
- IT employees with `us_manage`, `sv_control`, `sc_manage`, or `lg_view` receive
  only the corresponding IT surface, not the full IT Manager panel.
- The users page includes the reference employee table, access-level policy
  matrix, IT scope card and password-management card.
- A real end-to-end test proves create -> login -> allowed nav/API -> denied
  nav/API -> revoke behavior.

## Security invariants

- Frontend navigation is not authorization. Every employee API remains guarded
  by `EmployeePermissionGuard` and `@RequiresPermission`.
- Employee permissions are looked up live; they are not embedded permanently in
  the access token.
- IT cannot grant a permission outside the selected employee unit.
- IT cannot grant itself access to CEO, Senior Manager, or Board Chair panels.
- Employee mobile remains mandatory because staff login uses mandatory 2FA.
