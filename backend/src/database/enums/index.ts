/**
 * Phase 0 spike — enums for the 4 proof-of-concept entities only, mirroring
 * the shape of `generated/typeorm/enums.ts` exactly (same string union values)
 * so code can move between the two representations without a cast during
 * the coexistence period. The full 58-enum set is ported in Phase 1.
 */

export const Role = {
  USER: 'USER',
  AGENCY: 'AGENCY',
  EMPLOYEE: 'EMPLOYEE',
  IT_MANAGER: 'IT_MANAGER',
  COMMERCIAL_MANAGER: 'COMMERCIAL_MANAGER',
  FINANCE_MANAGER: 'FINANCE_MANAGER',
  SENIOR_MANAGER: 'SENIOR_MANAGER',
  CEO: 'CEO',
  BOARD_CHAIR: 'BOARD_CHAIR',
  SITE_ADMIN: 'SITE_ADMIN',
} as const;
export type Role = (typeof Role)[keyof typeof Role];

export const CabinClass = {
  ECONOMY: 'ECONOMY',
  BUSINESS: 'BUSINESS',
} as const;
export type CabinClass = (typeof CabinClass)[keyof typeof CabinClass];

export const BookingChannel = {
  SYSTEM: 'SYSTEM',
  CHARTER: 'CHARTER',
  AGENCY: 'AGENCY',
} as const;
export type BookingChannel =
  (typeof BookingChannel)[keyof typeof BookingChannel];

export const LockClassification = {
  FREE: 'FREE',
  DISCOUNTED: 'DISCOUNTED',
  PAYABLE: 'PAYABLE',
} as const;
export type LockClassification =
  (typeof LockClassification)[keyof typeof LockClassification];

export const LockApprovalStatus = {
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;
export type LockApprovalStatus =
  (typeof LockApprovalStatus)[keyof typeof LockApprovalStatus];
