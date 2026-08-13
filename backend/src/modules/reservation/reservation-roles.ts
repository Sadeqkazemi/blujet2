import type { Role } from '../../database/enums';

/** Reachable nav: CEO + BOARD_CHAIR (label هواپیما), SENIOR_MANAGER +
 * IT_MANAGER (سامانه رزرواسیون). See docs/DB_SCHEMA.md Phase 9. */
export const RESERVATION_ROLES = [
  'CEO',
  'BOARD_CHAIR',
  'COMMERCIAL_MANAGER',
  'SENIOR_MANAGER',
  'IT_MANAGER',
] as const satisfies readonly Role[];

/** ⚑ Product decision: only these may change a PNR's seat, cancel a
 * booking, or manually issue one. SENIOR_MANAGER is view-only. */
export const CAN_LOCK_ROLES = [
  'CEO',
  'BOARD_CHAIR',
  'COMMERCIAL_MANAGER',
  'IT_MANAGER',
] as const satisfies readonly Role[];

/** Managerial seat lock/release/approve — IT Manager is view-only on the
 * seat map (may inspect sold-seat passengers, cannot lock). */
export const CAN_SEAT_LOCK_ROLES = [
  'CEO',
  'BOARD_CHAIR',
  'COMMERCIAL_MANAGER',
] as const satisfies readonly Role[];
