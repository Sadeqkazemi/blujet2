import type { Role } from '../../../generated/prisma/enums';

/** Reachable per Phase 1's confirmed nav extraction: BOARD_CHAIR,
 * SENIOR_MANAGER, IT_MANAGER. CEO is API-authorized (⚑ product decision,
 * see docs/DB_SCHEMA.md Phase 9) but has no reachable nav entry. */
export const RESERVATION_ROLES = [
  'CEO',
  'BOARD_CHAIR',
  'SENIOR_MANAGER',
  'IT_MANAGER',
] as const satisfies readonly Role[];

/** ⚑ Product decision: only these may change a PNR's seat, cancel a
 * booking, or manually issue one. SENIOR_MANAGER is view-only. */
export const CAN_LOCK_ROLES = [
  'CEO',
  'BOARD_CHAIR',
  'IT_MANAGER',
] as const satisfies readonly Role[];

/** Managerial seat lock/release/approve — IT Manager is view-only on the
 * seat map (may inspect sold-seat passengers, cannot lock). */
export const CAN_SEAT_LOCK_ROLES = [
  'CEO',
  'BOARD_CHAIR',
] as const satisfies readonly Role[];
