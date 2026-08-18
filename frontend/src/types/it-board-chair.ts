/**
 * ⚠️ Product/security decision pending — see BoardChairAccountSection.tsx
 * and docs/features/it-api-access-management.md's "Known limitations"
 * note. backend/src/modules/admins/admins.service.ts currently states
 * "CEO/BOARD_CHAIR accounts are never manageable" except by
 * CEO/BOARD_CHAIR/SENIOR_MANAGER — this preview UI is NOT wired to any
 * real account-creation or password-change capability.
 */
export interface BoardChairAccountMock {
  exists: boolean;
  fullName: string | null;
  username: string | null;
  lastPasswordChangeAt: string | null;
}
