import { DataSource } from 'typeorm';
import { extendTemporaryPanelAccessV4 } from './extend-temporary-panel-access-v4';
import {
  createTemporaryPanelV4Expiry,
  getTemporaryPanelAccessState,
} from './temporary-panel-accounts';

describe('owner-approved September UAT renewal', () => {
  const originalEnv = { ...process.env };
  const now = new Date('2026-09-20T14:00:00.000Z');
  const user = {
    username: 'uat.it',
    twoFactorEnabled: false,
    createdAt: new Date('2026-08-05T00:00:00.000Z'),
    temporaryPasswordOnlyUntil: new Date('2026-09-27T14:00:00.000Z'),
  };
  beforeEach(() => {
    process.env.NODE_ENV = 'production';
    process.env.AUTH_SANDBOX_ENABLED = 'true';
    process.env.TEMP_PANEL_EXTENSION_CONFIRM =
      'EXTEND_TEMPORARY_PANEL_ACCESS_7_DAYS_V4';
  });
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('grants a full seven days beyond the historical account-age ceiling', () => {
    expect(createTemporaryPanelV4Expiry(now)).toEqual(
      user.temporaryPasswordOnlyUntil,
    );
    expect(getTemporaryPanelAccessState(user, now)).toBe('ACTIVE');
    expect(
      getTemporaryPanelAccessState(user, user.temporaryPasswordOnlyUntil),
    ).toBe('EXPIRED');
  });

  it.each(['2026-09-19T23:59:59.999Z', '2026-09-22T00:00:00.000Z', 'invalid'])(
    'refuses renewal outside approval: %s',
    (time) => {
      expect(() => createTemporaryPanelV4Expiry(new Date(time))).toThrow(
        'approved renewal window',
      );
    },
  );

  it('retains the original ceiling outside sandbox', () => {
    process.env.AUTH_SANDBOX_ENABLED = 'false';
    expect(getTemporaryPanelAccessState(user, now)).toBe('INVALID');
  });

  it('does not accept ordinary identities, 2FA accounts or deadlines beyond September 28', () => {
    expect(
      getTemporaryPanelAccessState({ ...user, username: 'finance' }, now),
    ).toBe('INVALID');
    expect(
      getTemporaryPanelAccessState({ ...user, twoFactorEnabled: true }, now),
    ).toBe('INVALID');
    expect(
      getTemporaryPanelAccessState(
        {
          ...user,
          temporaryPasswordOnlyUntil: new Date('2026-09-29T00:00:00.000Z'),
        },
        now,
      ),
    ).toBe('INVALID');
    expect(
      getTemporaryPanelAccessState(
        {
          ...user,
          temporaryPasswordOnlyUntil: new Date('2026-09-28T23:59:59.999Z'),
        },
        now,
      ),
    ).toBe('ACTIVE');
  });

  it.each([
    ['NODE_ENV', 'development'],
    ['AUTH_SANDBOX_ENABLED', 'false'],
    ['TEMP_PANEL_EXTENSION_CONFIRM', 'wrong'],
  ])('refuses %s=%s before accessing the database', async (key, value) => {
    process.env[key] = value;
    const transaction = jest.fn();
    const source = { transaction } as unknown as DataSource;
    await expect(extendTemporaryPanelAccessV4(source, now)).rejects.toThrow();
    expect(transaction).not.toHaveBeenCalled();
  });
});
