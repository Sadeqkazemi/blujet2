import { randomInt } from 'node:crypto';
import type { Role } from './enums';

export const TEMPORARY_PANEL_ACCESS_MAX_MS = 7 * 24 * 60 * 60 * 1000;
export const TEMPORARY_PANEL_USERNAME_PREFIX = 'uat.';
export const TEMPORARY_PANEL_PASSWORD_LENGTH = 16;
const TEMPORARY_PANEL_PASSWORD_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

export const TEMPORARY_PANEL_ACCOUNTS = [
  { username: 'uat.siteadmin', role: 'SITE_ADMIN', fullName: 'UAT Site Admin' },
  { username: 'uat.it', role: 'IT_MANAGER', fullName: 'UAT IT Manager' },
  {
    username: 'uat.commercial',
    role: 'COMMERCIAL_MANAGER',
    fullName: 'UAT Commercial Manager',
  },
  {
    username: 'uat.finance',
    role: 'FINANCE_MANAGER',
    fullName: 'UAT Finance Manager',
  },
  {
    username: 'uat.senior',
    role: 'SENIOR_MANAGER',
    fullName: 'UAT Senior Manager',
  },
  { username: 'uat.ceo', role: 'CEO', fullName: 'UAT CEO' },
  {
    username: 'uat.chair',
    role: 'BOARD_CHAIR',
    fullName: 'UAT Board Chair',
  },
] as const satisfies ReadonlyArray<{
  username: string;
  role: Role;
  fullName: string;
}>;

const temporaryUsernames = new Set<string>(
  TEMPORARY_PANEL_ACCOUNTS.map(({ username }) => username),
);

export interface TemporaryPanelAccessUser {
  username: string | null;
  twoFactorEnabled: boolean;
  createdAt: Date;
  temporaryPasswordOnlyUntil: Date | null;
}

export type TemporaryPanelAccessState =
  'NONE' | 'ACTIVE' | 'EXPIRED' | 'INVALID';

export function getTemporaryPanelAccessState(
  user: TemporaryPanelAccessUser,
  now = new Date(),
): TemporaryPanelAccessState {
  const deadline = user.temporaryPasswordOnlyUntil;
  if (deadline === null) return 'NONE';
  if (
    user.username === null ||
    !temporaryUsernames.has(user.username) ||
    user.twoFactorEnabled ||
    deadline.getTime() >
      user.createdAt.getTime() + TEMPORARY_PANEL_ACCESS_MAX_MS
  ) {
    return 'INVALID';
  }
  return deadline.getTime() > now.getTime() ? 'ACTIVE' : 'EXPIRED';
}

export function createTemporaryPanelExpiry(now = new Date()): Date {
  return new Date(now.getTime() + TEMPORARY_PANEL_ACCESS_MAX_MS);
}

export function generateTemporaryPanelPassword(): string {
  return Array.from(
    { length: TEMPORARY_PANEL_PASSWORD_LENGTH },
    () =>
      TEMPORARY_PANEL_PASSWORD_ALPHABET[
        randomInt(TEMPORARY_PANEL_PASSWORD_ALPHABET.length)
      ],
  ).join('');
}
