/**
 * ⚠️ TEMP / DEV ONLY — no real backend endpoint exists, and none should be
 * built here without a product/security decision first.
 *
 * backend/src/modules/admins/admins.service.ts explicitly states
 * "CEO/BOARD_CHAIR accounts are never manageable" except by
 * CEO/BOARD_CHAIR/SENIOR_MANAGER (backend/src/modules/admins/admins.controller.ts
 * `@Roles('CEO', 'BOARD_CHAIR', 'SENIOR_MANAGER')`). Letting IT_MANAGER
 * create the Board Chair's account or change its password — as this
 * preview UI's design brief asked for — would bypass that separation-of-
 * duties control. This adapter exists only so the requested UI can be
 * previewed in isolation; it never calls the real admins module and must
 * not be pointed at one without an explicit decision to change the
 * existing RBAC boundary. See docs/features/it-api-access-management.md.
 */
import type { BoardChairAccountMock } from '../types/it-board-chair';

let account: BoardChairAccountMock = {
  exists: false,
  fullName: null,
  username: null,
  lastPasswordChangeAt: null,
};

export async function fetchBoardChairAccountMock(): Promise<BoardChairAccountMock> {
  return account;
}

export async function createBoardChairAccountMock(dto: {
  fullName: string;
  username: string;
  password: string;
}): Promise<BoardChairAccountMock> {
  if (!dto.fullName.trim() || !dto.username.trim()) throw new Error('نام و نام کاربری الزامی است.');
  if (dto.password.length < 6) throw new Error('رمز عبور باید حداقل ۶ کاراکتر باشد.');
  account = {
    exists: true,
    fullName: dto.fullName.trim(),
    username: dto.username.trim(),
    lastPasswordChangeAt: new Date().toISOString(),
  };
  return account;
}

export async function changeBoardChairPasswordMock(newPassword: string): Promise<BoardChairAccountMock> {
  if (!account.exists) throw new Error('ابتدا باید حساب رئیس هیئت مدیره ایجاد شود.');
  if (newPassword.length < 6) throw new Error('رمز عبور باید حداقل ۶ کاراکتر باشد.');
  account = { ...account, lastPasswordChangeAt: new Date().toISOString() };
  return account;
}
