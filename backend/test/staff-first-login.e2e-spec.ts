import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import * as crypto from 'node:crypto';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { User } from '../src/database/entities/user.entity';
import { TwoFactorChallenge } from '../src/database/entities/two-factor-challenge.entity';
import { TWO_FACTOR_PROVIDER } from '../src/modules/auth/providers/two-factor-provider.interface';
import { MockTwoFactorProvider } from '../src/modules/auth/providers/mock-two-factor.provider';
import { loginAs } from './helpers/login.helper';
import { createTestApp } from './helpers/app.helper';

describe('Staff first-login mobile+OTP setup (e2e, Phase 68)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;

  beforeEach(async () => {
    app = await createTestApp();
    dataSource = app.get(DataSource);
  });

  afterEach(async () => {
    await app.close();
  });

  function auth(token: string | null | undefined) {
    return { Authorization: `Bearer ${token}` };
  }

  // `User.phone` is genuinely unique per account — a fresh number per call
  // keeps tests independent of each other and of leftover rows from
  // previous runs against the same local test DB.
  function randomMobile() {
    const digits = crypto.randomInt(100_000_000, 999_999_999).toString();
    return `09${digits}`;
  }

  async function createPasswordlessEmployee() {
    const it = await loginAs(app, 'itadmin');
    const username = `emp.${crypto.randomUUID().slice(0, 8)}`;
    const res = await request(app.getHttpServer())
      .post('/it/employees')
      .set(auth(it.accessToken))
      .send({
        fullName: 'کارمند بدون رمز',
        username,
        dept: 'commercial',
      });
    expect(res.status).toBe(201);
    return username;
  }

  function lastCodeFor(username: string) {
    const twoFactor = app.get<MockTwoFactorProvider>(TWO_FACTOR_PROVIDER);
    return dataSource
      .getRepository(User)
      .findOneByOrFail({ username })
      .then((u) => twoFactor.getLastCode(u.id));
  }

  // ── POST /it/employees / POST /admins — optional password ──────────

  it('POST /it/employees without a password creates a passwordless account (no mustChangePassword)', async () => {
    const it = await loginAs(app, 'itadmin');
    const username = `emp.${crypto.randomUUID().slice(0, 8)}`;
    const res = await request(app.getHttpServer())
      .post('/it/employees')
      .set(auth(it.accessToken))
      .send({ fullName: 'کارمند تست', username, dept: 'commercial' });

    expect(res.status).toBe(201);
    const user = await dataSource
      .getRepository(User)
      .findOneByOrFail({ username });
    expect(user.passwordHash).toBeNull();
    expect(user.mustChangePassword).toBe(false);
  });

  // ── POST /auth/staff/lookup ─────────────────────────────────────────

  it('lookup: 404 for an unknown username', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/staff/lookup')
      .send({ username: `nobody.${crypto.randomUUID().slice(0, 8)}` });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('STAFF_ACCOUNT_NOT_FOUND');
  });

  it('lookup: needsSetup=true for a passwordless account, false for a seeded one', async () => {
    const username = await createPasswordlessEmployee();

    const needsSetup = await request(app.getHttpServer())
      .post('/auth/staff/lookup')
      .send({ username });
    expect(needsSetup.status).toBe(200);
    expect(needsSetup.body.data.needsSetup).toBe(true);

    const existing = await request(app.getHttpServer())
      .post('/auth/staff/lookup')
      .send({ username: 'finance' });
    expect(existing.status).toBe(200);
    expect(existing.body.data.needsSetup).toBe(false);
  });

  // ── Happy path ───────────────────────────────────────────────────────

  it('full happy path: request OTP, verify, password+mobile persisted, tokens issued', async () => {
    const username = await createPasswordlessEmployee();
    const mobile = randomMobile();

    const otpReq = await request(app.getHttpServer())
      .post('/auth/staff/first-login/otp/request')
      .send({ username, mobile });
    expect(otpReq.status).toBe(200);
    const { challengeId } = otpReq.body.data;

    const code = await lastCodeFor(username);
    expect(code).toBeDefined();

    const verify = await request(app.getHttpServer())
      .post('/auth/staff/first-login/otp/verify')
      .send({ challengeId, code, newPassword: 'Str0ng!Pass', mobile });

    expect(verify.status).toBe(200);
    expect(verify.body.data.accessToken).toBeDefined();
    expect(verify.body.data.user.mustChangePassword).toBe(false);

    const user = await dataSource
      .getRepository(User)
      .findOneByOrFail({ username });
    expect(user.passwordHash).not.toBeNull();
    expect(user.phone).toBe(`+98${mobile.slice(1)}`);
    expect(user.twoFactorEnabled).toBe(true);

    // The account now behaves like a normal staff login.
    const relogin = await loginAs(app, username, 'Str0ng!Pass');
    expect(relogin.accessToken).toBeDefined();
  });

  // ── Edge cases ───────────────────────────────────────────────────────

  it('otp/request: 404 for an unknown username', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/staff/first-login/otp/request')
      .send({
        username: `nobody.${crypto.randomUUID().slice(0, 8)}`,
        mobile: randomMobile(),
      });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('STAFF_ACCOUNT_NOT_FOUND');
  });

  it('otp/request: 409 ALREADY_SET_UP for an account that already has a password', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/staff/first-login/otp/request')
      .send({ username: 'finance', mobile: randomMobile() });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ALREADY_SET_UP');
  });

  it('otp/request: 400 for an invalid mobile format', async () => {
    const username = await createPasswordlessEmployee();
    const res = await request(app.getHttpServer())
      .post('/auth/staff/first-login/otp/request')
      .send({ username, mobile: '12345' });
    expect(res.status).toBe(400);
  });

  it('otp/verify: wrong code increments attempts without consuming the challenge', async () => {
    const username = await createPasswordlessEmployee();
    const mobile = randomMobile();
    const otpReq = await request(app.getHttpServer())
      .post('/auth/staff/first-login/otp/request')
      .send({ username, mobile });

    const res = await request(app.getHttpServer())
      .post('/auth/staff/first-login/otp/verify')
      .send({
        challengeId: otpReq.body.data.challengeId,
        code: '000000',
        newPassword: 'Str0ng!Pass',
        mobile,
      });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TWO_FACTOR_INVALID');

    const challenge = await dataSource
      .getRepository(TwoFactorChallenge)
      .findOneByOrFail({ id: otpReq.body.data.challengeId });
    expect(challenge.attempts).toBe(1);
    expect(challenge.consumedAt).toBeNull();
  });

  it('otp/verify: expired challenge rejected', async () => {
    const username = await createPasswordlessEmployee();
    const mobile = randomMobile();
    const otpReq = await request(app.getHttpServer())
      .post('/auth/staff/first-login/otp/request')
      .send({ username, mobile });
    await dataSource
      .getRepository(TwoFactorChallenge)
      .update(
        { id: otpReq.body.data.challengeId },
        { expiresAt: new Date(Date.now() - 1000) },
      );
    const code = await lastCodeFor(username);

    const res = await request(app.getHttpServer())
      .post('/auth/staff/first-login/otp/verify')
      .send({
        challengeId: otpReq.body.data.challengeId,
        code,
        newPassword: 'Str0ng!Pass',
        mobile,
      });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TWO_FACTOR_EXPIRED');
  });

  it('otp/verify: weak password rejected with 400 before any state changes', async () => {
    const username = await createPasswordlessEmployee();
    const mobile = randomMobile();
    const otpReq = await request(app.getHttpServer())
      .post('/auth/staff/first-login/otp/request')
      .send({ username, mobile });

    const res = await request(app.getHttpServer())
      .post('/auth/staff/first-login/otp/verify')
      .send({
        challengeId: otpReq.body.data.challengeId,
        code: '123456',
        newPassword: 'weak',
        mobile,
      });
    expect(res.status).toBe(400);

    const user = await dataSource
      .getRepository(User)
      .findOneByOrFail({ username });
    expect(user.passwordHash).toBeNull();
  });

  it('otp/verify: a wrong purpose challenge (e.g. STAFF_LOGIN_2FA) is rejected', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/auth/staff/login')
      .send({ username: 'finance', password: 'Blujet@1404' });
    expect(loginRes.status).toBe(200);

    const res = await request(app.getHttpServer())
      .post('/auth/staff/first-login/otp/verify')
      .send({
        challengeId: loginRes.body.data.challengeId,
        code: '123456',
        newPassword: 'Str0ng!Pass',
        mobile: randomMobile(),
      });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TWO_FACTOR_INVALID');
  });

  it('concurrency: two parallel verify calls for the same challenge — exactly one succeeds', async () => {
    const username = await createPasswordlessEmployee();
    const mobile = randomMobile();
    const otpReq = await request(app.getHttpServer())
      .post('/auth/staff/first-login/otp/request')
      .send({ username, mobile });
    const code = await lastCodeFor(username);

    const [a, b] = await Promise.all([
      request(app.getHttpServer())
        .post('/auth/staff/first-login/otp/verify')
        .send({
          challengeId: otpReq.body.data.challengeId,
          code,
          newPassword: 'Str0ng!Pass1',
          mobile,
        }),
      request(app.getHttpServer())
        .post('/auth/staff/first-login/otp/verify')
        .send({
          challengeId: otpReq.body.data.challengeId,
          code,
          newPassword: 'Str0ng!Pass2',
          mobile: randomMobile(),
        }),
    ]);

    const statuses = [a.status, b.status].sort();
    // Whichever request loses the race gets a clean 409 ALREADY_SET_UP
    // (the row-locked re-check sees the winner's write) rather than
    // corrupting the account with two writes.
    expect(statuses[0]).toBe(200);
    expect(statuses[1]).toBe(409);

    const user = await dataSource
      .getRepository(User)
      .findOneByOrFail({ username });
    expect(user.passwordHash).not.toBeNull();
  });

  it('a passwordless account still gets a generic 401 from a direct staff/login attempt', async () => {
    const username = await createPasswordlessEmployee();
    const res = await request(app.getHttpServer())
      .post('/auth/staff/login')
      .send({ username, password: 'anything123' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});
