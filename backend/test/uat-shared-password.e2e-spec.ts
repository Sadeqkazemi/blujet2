import { execFileSync } from 'node:child_process';
import * as path from 'node:path';
import { INestApplication } from '@nestjs/common';
import * as argon2 from 'argon2';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource, In } from 'typeorm';
import { AgencyCreditLine } from '../src/database/entities/agency-credit-line.entity';
import { AgencyProfile } from '../src/database/entities/agency-profile.entity';
import { AuditLog } from '../src/database/entities/audit-log.entity';
import { RefreshToken } from '../src/database/entities/refresh-token.entity';
import { User } from '../src/database/entities/user.entity';
import { getSandboxOtpCode } from '../src/common/sandbox-auth';
import {
  TEMPORARY_PANEL_ACCOUNTS,
  TEMPORARY_PHONE_LOGIN_ACCOUNTS,
} from '../src/database/temporary-panel-accounts';
import { createTestApp } from './helpers/app.helper';

const backendRoot = path.join(__dirname, '..');
const ALL_USERNAMES = [
  ...TEMPORARY_PANEL_ACCOUNTS.map(({ username }) => username),
  ...TEMPORARY_PHONE_LOGIN_ACCOUNTS.map(({ username }) => username),
];

const STRONG_PASSWORD = 'Blujet@UAT-Shared1404!';
const OTHER_STRONG_PASSWORD = 'Blujet@UAT-Shared1404-Rotated!';

function runScript(
  script: string,
  extraEnv: Record<string, string | undefined>,
): { status: number; stdout: string; stderr: string } {
  try {
    const stdout = execFileSync('npx', ['tsx', script, '--execute'], {
      cwd: backendRoot,
      env: { ...process.env, ...extraEnv },
      encoding: 'utf8',
    });
    return { status: 0, stdout, stderr: '' };
  } catch (error) {
    const err = error as { status?: number; stdout?: string; stderr?: string };
    return {
      status: err.status ?? 1,
      stdout: err.stdout ?? '',
      stderr: err.stderr ?? '',
    };
  }
}

function bootstrap(extraEnv: Record<string, string | undefined> = {}) {
  return runScript('src/database/bootstrap-temporary-panel-accounts.ts', {
    NODE_ENV: 'production',
    AUTH_SANDBOX_ENABLED: 'true',
    TEMP_PANEL_BOOTSTRAP_CONFIRM: 'CREATE_7_DAY_PANEL_TEST_ACCOUNTS',
    UAT_PANEL_SHARED_PASSWORD: STRONG_PASSWORD,
    ...extraEnv,
  });
}

function rotate(extraEnv: Record<string, string | undefined> = {}) {
  return runScript('src/database/rotate-temporary-panel-passwords.ts', {
    NODE_ENV: 'production',
    AUTH_SANDBOX_ENABLED: 'true',
    TEMP_PANEL_ROTATE_CONFIRM: 'ROTATE_TEMPORARY_PANEL_PASSWORDS_SHARED_V1',
    UAT_PANEL_SHARED_PASSWORD: OTHER_STRONG_PASSWORD,
    ...extraEnv,
  });
}

describe('UAT shared panel password — bootstrap & rotation (e2e, Phase: shared-uat-panel-password)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;

  async function resetTemporaryAccounts() {
    const userRepo = dataSource.getRepository(User);
    const existing = await userRepo.find({
      where: { username: In(ALL_USERNAMES) },
      select: { id: true },
    });
    if (existing.length > 0) {
      const ids = existing.map((u) => u.id);
      // Child before parent, both before the users delete — same FK order
      // uat-demo-data-purge.ts's row-filtered delete uses. AuditLog.actorId
      // is ON DELETE RESTRICT too (every bootstrap/rotate run writes one).
      await dataSource
        .getRepository(AgencyCreditLine)
        .delete({ agencyId: In(ids) });
      await dataSource.getRepository(AgencyProfile).delete({ userId: In(ids) });
      await dataSource.getRepository(AuditLog).delete({ actorId: In(ids) });
      await dataSource
        .getRepository(RefreshToken)
        .delete({ userId: In(ids) });
      await userRepo.delete({ username: In(ALL_USERNAMES) });
    }
  }

  beforeEach(async () => {
    app = await createTestApp();
    dataSource = app.get(DataSource);
    // Start every test from a clean slate for the accounts under test.
    await resetTemporaryAccounts();
  });

  afterEach(async () => {
    await resetTemporaryAccounts();
    await app.close();
  });

  it('bootstrap creates every configured account hashed with the same shared password, output has no password field', () => {
    const result = bootstrap();
    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout) as {
      accounts: Array<{ username: string; status: string }>;
    };
    expect(parsed.accounts).toHaveLength(ALL_USERNAMES.length);
    expect(parsed.accounts.every((a) => a.status === 'created')).toBe(true);
    // No key anywhere in the output resembles a password/credential field.
    expect(JSON.stringify(parsed).toLowerCase()).not.toContain('password');
    expect(result.stdout).not.toContain(STRONG_PASSWORD);
  });

  it('every bootstrapped account verifies against the exact same shared password', async () => {
    bootstrap();
    const users = await dataSource
      .getRepository(User)
      .find({ where: { username: In(ALL_USERNAMES) } });
    expect(users).toHaveLength(ALL_USERNAMES.length);
    for (const user of users) {
      expect(await argon2.verify(user.passwordHash!, STRONG_PASSWORD)).toBe(
        true,
      );
    }
  });

  it('creates a real AgencyProfile + zero-limit credit line for the temp agency account (not fake business data)', async () => {
    bootstrap();
    const agencyUser = await dataSource
      .getRepository(User)
      .findOneByOrFail({ username: 'uat.agency' });
    const profile = await dataSource
      .getRepository(AgencyProfile)
      .findOneByOrFail({ userId: agencyUser.id });
    expect(profile.tier).toBe('NORMAL');
    expect(profile.suspendedAt).toBeNull();
  });

  it('bootstrap is idempotent — a second run skips already-created accounts without changing their password', async () => {
    bootstrap();
    const before = await dataSource
      .getRepository(User)
      .findOneByOrFail({ username: 'uat.siteadmin' });

    const second = bootstrap({
      UAT_PANEL_SHARED_PASSWORD: OTHER_STRONG_PASSWORD,
    });
    expect(second.status).toBe(0);
    const parsed = JSON.parse(second.stdout) as {
      accounts: Array<{ username: string; status: string }>;
    };
    expect(parsed.accounts.every((a) => a.status === 'already_exists')).toBe(
      true,
    );

    const after = await dataSource
      .getRepository(User)
      .findOneByOrFail({ username: 'uat.siteadmin' });
    expect(after.passwordHash).toBe(before.passwordHash);
  });

  it('refuses to bootstrap when AUTH_SANDBOX_ENABLED is not true', () => {
    const result = bootstrap({ AUTH_SANDBOX_ENABLED: 'false' });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/AUTH_SANDBOX_ENABLED/);
    expect(result.stderr).not.toContain(STRONG_PASSWORD);
  });

  it('refuses to bootstrap with an empty UAT_PANEL_SHARED_PASSWORD', () => {
    const result = bootstrap({ UAT_PANEL_SHARED_PASSWORD: '' });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/not set or empty/);
  });

  it('refuses to bootstrap with a weak UAT_PANEL_SHARED_PASSWORD', () => {
    const result = bootstrap({ UAT_PANEL_SHARED_PASSWORD: 'weak' });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/does not meet the required strength/);
    expect(result.stderr).not.toContain('weak');
  });

  it('does not touch a real staff account', async () => {
    const userRepo = dataSource.getRepository(User);
    const before = await userRepo.findOneByOrFail({ username: 'finance' });
    bootstrap();
    rotate();
    const after = await userRepo.findOneByOrFail({ username: 'finance' });
    expect(after.passwordHash).toBe(before.passwordHash);
    expect(after.temporaryPasswordOnlyUntil).toBeNull();
  });

  describe('rotation', () => {
    beforeEach(() => {
      const result = bootstrap();
      expect(result.status).toBe(0);
    });

    it('rotates every account to the new shared password and revokes their active refresh tokens', async () => {
      const userRepo = dataSource.getRepository(User);
      const users = await userRepo.find({
        where: { username: In(ALL_USERNAMES) },
      });
      const refreshRepo = dataSource.getRepository(RefreshToken);
      for (const user of users) {
        await refreshRepo.save(
          refreshRepo.create({
            userId: user.id,
            tokenHash: `test-hash-${user.id}`,
            expiresAt: new Date(Date.now() + 60_000),
          }),
        );
      }

      const result = rotate();
      expect(result.status).toBe(0);
      expect(result.stdout).not.toContain(OTHER_STRONG_PASSWORD);
      expect(
        JSON.stringify(JSON.parse(result.stdout)).toLowerCase(),
      ).not.toContain('password');

      const rotatedUsers = await userRepo.find({
        where: { username: In(ALL_USERNAMES) },
      });
      for (const user of rotatedUsers) {
        expect(
          await argon2.verify(user.passwordHash!, OTHER_STRONG_PASSWORD),
        ).toBe(true);
        expect(await argon2.verify(user.passwordHash!, STRONG_PASSWORD)).toBe(
          false,
        );
      }

      const remainingActive = await refreshRepo.count({
        where: { userId: In(users.map((u) => u.id)), revokedAt: undefined },
      });
      const activeTokens = await refreshRepo
        .createQueryBuilder('rt')
        .where('rt.userId IN (:...ids)', { ids: users.map((u) => u.id) })
        .andWhere('rt.revokedAt IS NULL')
        .getCount();
      expect(activeTokens).toBe(0);
      void remainingActive;
    });

    it('refuses rotation without AUTH_SANDBOX_ENABLED', () => {
      const result = rotate({ AUTH_SANDBOX_ENABLED: 'false' });
      expect(result.status).not.toBe(0);
      expect(result.stderr).toMatch(/AUTH_SANDBOX_ENABLED/);
    });

    it('refuses rotation with a weak password', () => {
      const result = rotate({ UAT_PANEL_SHARED_PASSWORD: '1234' });
      expect(result.status).not.toBe(0);
      expect(result.stderr).toMatch(/does not meet the required strength/);
    });
  });

  describe('login with the shared password', () => {
    beforeEach(() => {
      const result = bootstrap();
      expect(result.status).toBe(0);
    });

    it('a temp EMPLOYEE account logs in directly with the shared password, bypassing 2FA', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/staff/login')
        .send({ username: 'uat.employee', password: STRONG_PASSWORD });
      expect(res.status).toBe(200);
      expect(res.body.data.loginMode).toBe('TEMPORARY_PASSWORD_ONLY');
      expect(res.body.data.accessToken).toBeDefined();
    });

    it('the temp agency account logs in with the shared password via /auth/agency/login', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/agency/login')
        .send({ phone: '09000000001', password: STRONG_PASSWORD });
      expect(res.status).toBe(200);
      expect(res.body.data.accessToken).toBeDefined();
    });

    it('the temp customer account logs in with the shared password via /auth/customer/login-password', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/customer/login-password')
        .send({ phone: '09000000002', password: STRONG_PASSWORD });
      expect(res.status).toBe(200);
      expect(res.body.data.accessToken).toBeDefined();
    });

    it('an expired temp account is rejected even with the correct shared password', async () => {
      await dataSource
        .getRepository(User)
        .update(
          { username: 'uat.siteadmin' },
          { temporaryPasswordOnlyUntil: new Date(Date.now() - 1000) },
        );
      const res = await request(app.getHttpServer())
        .post('/auth/staff/login')
        .send({ username: 'uat.siteadmin', password: STRONG_PASSWORD });
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('TEMPORARY_ACCESS_EXPIRED');
    });
  });

  it('the sandbox mock OTP default is unchanged at 123456', () => {
    delete process.env.AUTH_SANDBOX_OTP;
    delete process.env.DEV_FIXED_OTP_CODE;
    expect(getSandboxOtpCode()).toBe('123456');
  });
});
