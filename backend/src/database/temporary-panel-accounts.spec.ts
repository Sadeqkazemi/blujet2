import {
  TEMPORARY_PANEL_ACCOUNTS,
  TEMPORARY_PANEL_ACCESS_MAX_MS,
  createTemporaryPanelExpiry,
  generateTemporaryPanelPassword,
  getTemporaryPanelAccessState,
} from './temporary-panel-accounts';

describe('temporary panel accounts', () => {
  it('defines exactly one reserved account for every management panel role', () => {
    expect(TEMPORARY_PANEL_ACCOUNTS.map(({ role }) => role).sort()).toEqual(
      [
        'SITE_ADMIN',
        'IT_MANAGER',
        'COMMERCIAL_MANAGER',
        'FINANCE_MANAGER',
        'SENIOR_MANAGER',
        'CEO',
        'BOARD_CHAIR',
      ].sort(),
    );
    expect(
      new Set(TEMPORARY_PANEL_ACCOUNTS.map(({ username }) => username)).size,
    ).toBe(TEMPORARY_PANEL_ACCOUNTS.length);
    expect(
      TEMPORARY_PANEL_ACCOUNTS.every(({ username }) =>
        username.startsWith('uat.'),
      ),
    ).toBe(true);
  });

  it('hard-caps the access deadline at seven days', () => {
    const createdAt = new Date('2026-08-05T00:00:00.000Z');
    const deadline = createTemporaryPanelExpiry(createdAt);
    expect(deadline.getTime() - createdAt.getTime()).toBe(
      TEMPORARY_PANEL_ACCESS_MAX_MS,
    );
    const base = {
      username: 'uat.it',
      twoFactorEnabled: false,
      createdAt,
      temporaryPasswordOnlyUntil: deadline,
    };
    expect(
      getTemporaryPanelAccessState(base, new Date(deadline.getTime() - 1)),
    ).toBe('ACTIVE');
    expect(getTemporaryPanelAccessState(base, deadline)).toBe('EXPIRED');
    expect(
      getTemporaryPanelAccessState({
        ...base,
        temporaryPasswordOnlyUntil: new Date(deadline.getTime() + 1),
      }),
    ).toBe('INVALID');
  });

  it('never treats ordinary or 2FA-enabled staff as password-only accounts', () => {
    const createdAt = new Date();
    const temporaryPasswordOnlyUntil = createTemporaryPanelExpiry(createdAt);
    expect(
      getTemporaryPanelAccessState({
        username: 'finance',
        twoFactorEnabled: false,
        createdAt,
        temporaryPasswordOnlyUntil,
      }),
    ).toBe('INVALID');
    expect(
      getTemporaryPanelAccessState({
        username: 'uat.finance',
        twoFactorEnabled: true,
        createdAt,
        temporaryPasswordOnlyUntil,
      }),
    ).toBe('INVALID');
  });

  it('generates unique strong passwords', () => {
    const passwords = new Set(
      Array.from({ length: 50 }, generateTemporaryPanelPassword),
    );
    expect(passwords.size).toBe(50);
    for (const password of passwords) {
      expect(password.length).toBeGreaterThanOrEqual(28);
      expect(password).toMatch(/[A-Z]/);
      expect(password).toMatch(/[a-z]/);
      expect(password).toMatch(/[0-9]/);
      expect(password).toMatch(/[^A-Za-z0-9]/);
    }
  });
});
