import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from '../src/prisma/prisma.service';
import { TWO_FACTOR_PROVIDER } from '../src/modules/auth/providers/two-factor-provider.interface';
import { MockTwoFactorProvider } from '../src/modules/auth/providers/mock-two-factor.provider';
import { loginAs } from './helpers/login.helper';
import { createTestApp } from './helpers/app.helper';

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  // Fresh app per test — each app instance gets its own in-memory throttler
  // storage, so the strict login/2FA rate limit can't leak between tests.
  beforeEach(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterEach(async () => {
    await app.close();
  });

  it('rejects a wrong password with 401 INVALID credentials, no challenge issued', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/staff/login')
      .send({ username: 'finance.karimi', password: 'wrong-password' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects login for a suspended account with 403 ACCOUNT_SUSPENDED', async () => {
    const user = await prisma.user.findUniqueOrThrow({
      where: { username: 'site.admin' },
    });
    await prisma.user.update({
      where: { id: user.id },
      data: { isActive: false },
    });

    const res = await request(app.getHttpServer())
      .post('/auth/staff/login')
      .send({ username: 'site.admin', password: 'Blujet@1404' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCOUNT_SUSPENDED');

    await prisma.user.update({
      where: { id: user.id },
      data: { isActive: true },
    });
  });

  it('issues a 2FA challenge on correct password, no token yet', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/staff/login')
      .send({ username: 'finance.karimi', password: 'Blujet@1404' });

    expect(res.status).toBe(200);
    expect(res.body.data.challengeId).toBeDefined();
    expect(res.body.data.accessToken).toBeUndefined();
  });

  it('rejects a wrong 2FA code and increments attempts, without consuming the challenge', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/auth/staff/login')
      .send({ username: 'finance.karimi', password: 'Blujet@1404' });
    const challengeId = loginRes.body.data.challengeId;

    const wrongRes = await request(app.getHttpServer())
      .post('/auth/staff/login/verify')
      .send({ challengeId, code: '000000' });

    expect(wrongRes.status).toBe(401);
    expect(wrongRes.body.error.code).toBe('TWO_FACTOR_INVALID');

    const challenge = await prisma.twoFactorChallenge.findUniqueOrThrow({
      where: { id: challengeId },
    });
    expect(challenge.attempts).toBe(1);
    expect(challenge.consumedAt).toBeNull();
  });

  it('rejects an expired 2FA challenge', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/auth/staff/login')
      .send({ username: 'finance.karimi', password: 'Blujet@1404' });
    const challengeId = loginRes.body.data.challengeId;

    await prisma.twoFactorChallenge.update({
      where: { id: challengeId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const user = await prisma.user.findUniqueOrThrow({
      where: { username: 'finance.karimi' },
    });
    const twoFactor = app.get<MockTwoFactorProvider>(TWO_FACTOR_PROVIDER);
    const code = twoFactor.getLastCode(user.id)!;

    const res = await request(app.getHttpServer())
      .post('/auth/staff/login/verify')
      .send({ challengeId, code });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TWO_FACTOR_EXPIRED');
  });

  it('logs in with the correct 2FA code and issues an access token + refresh cookie', async () => {
    const { verifyRes } = await loginAs(app, 'finance.karimi');

    expect(verifyRes!.status).toBe(200);
    expect(verifyRes!.body.data.accessToken).toBeDefined();
    expect(verifyRes!.body.data.user.role).toBe('FINANCE_MANAGER');
    const setCookie = verifyRes!.headers['set-cookie'];
    expect(setCookie).toBeDefined();
    expect(String(setCookie)).toContain('blujet_refresh=');
  });

  it('a 2FA code cannot be replayed once consumed', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/auth/staff/login')
      .send({ username: 'finance.karimi', password: 'Blujet@1404' });
    const challengeId = loginRes.body.data.challengeId as string;
    const user = await prisma.user.findUniqueOrThrow({
      where: { username: 'finance.karimi' },
    });
    const code = app
      .get<MockTwoFactorProvider>(TWO_FACTOR_PROVIDER)
      .getLastCode(user.id)!;

    const first = await request(app.getHttpServer())
      .post('/auth/staff/login/verify')
      .send({ challengeId, code });
    expect(first.status).toBe(200);

    const replay = await request(app.getHttpServer())
      .post('/auth/staff/login/verify')
      .send({ challengeId, code });
    expect(replay.status).toBe(401);
    expect(replay.body.error.code).toBe('TWO_FACTOR_INVALID');
  });

  it('rejects passwords stored as plaintext — DB row is an argon2 hash, never the raw password', async () => {
    const user = await prisma.user.findUniqueOrThrow({
      where: { username: 'ceo' },
    });
    expect(user.passwordHash).not.toBe('Blujet@1404');
    expect(user.passwordHash).toMatch(/^\$argon2/);
  });

  it('/auth/me returns 401 without a token', async () => {
    const res = await request(app.getHttpServer()).get('/auth/me');
    expect(res.status).toBe(401);
  });

  it('/auth/me returns the correct identity for a valid token', async () => {
    const { accessToken } = await loginAs(app, 'ceo');
    const res = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.role).toBe('CEO');
  });

  it('rate-limits repeated login attempts', async () => {
    const attempts = await Promise.all(
      Array.from({ length: 8 }, () =>
        request(app.getHttpServer())
          .post('/auth/staff/login')
          .send({ username: 'finance.karimi', password: 'wrong-password' }),
      ),
    );
    expect(attempts.some((r) => r.status === 429)).toBe(true);
  });
});
