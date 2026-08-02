import type { Role } from '../../../generated/typeorm/enums';

/** Reachable nav: CEO + BOARD_CHAIR (label هواپیما), SENIOR_MANAGER +
 * IT_MANAGER (سامانه رزرواسیون). See docs/DB_SCHEMA.md Phase 9. */
export const RESERVATION_ROLES = [
  'CEO',
  'BOARD_CHAIR',
  'SENIOR_MANAGER',
  'IT_MANAGER',
] as const satisfies readonly Role[];

/** ⚑ Product decision: only these may lock/release seats, change a PNR's
 * seat, cancel a booking, or manually issue one. SENIOR_MANAGER is
 * view-only, matching the design's confirmed behavior. */
export const CAN_LOCK_ROLES = [
  'CEO',
  'BOARD_CHAIR',
  'IT_MANAGER',
] as const satisfies readonly Role[];
