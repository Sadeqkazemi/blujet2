import 'dotenv/config';
import 'reflect-metadata';
import { setTimeout } from 'node:timers/promises';
import * as argon2 from 'argon2';
import { DataSource, In } from 'typeorm';
import type { Repository } from 'typeorm';
import { normalizeIranPhone } from '../common/normalize-iran-phone';
import { resolveUatSharedPassword } from '../common/uat-shared-password';
import { User } from './entities/user.entity';
import {
  TEMPORARY_PANEL_ACCOUNTS,
  TEMPORARY_PHONE_LOGIN_ACCOUNTS,
  getTemporaryPanelAccessState,
} from './temporary-panel-accounts';

interface AuthResponse {
  success?: boolean;
  data?: { accessToken?: string; id?: string; role?: string };
}

export async function diagnoseTemporaryPanelLogin(
  user: User,
  password: string,
  users: Repository<User>,
) {
  const phoneLogin = user.role === 'USER' || user.role === 'AGENCY';
  const normalizedPhone = user.phone ? normalizeIranPhone(user.phone) : null;
  const phoneOwner =
    phoneLogin && normalizedPhone
      ? await users.findOneBy({ phone: normalizedPhone })
      : null;
  return {
    username: user.username,
    passwordMatches:
      Boolean(user.passwordHash) &&
      (await argon2.verify(user.passwordHash!, password)),
    phoneIsCanonical: !phoneLogin || user.phone === normalizedPhone,
    phoneLookupMatches: !phoneLogin || phoneOwner?.id === user.id,
  };
}

async function logoutVerificationSession(
  headers: Record<string, string>,
  username: string | null,
): Promise<void> {
  const logout = await fetch('http://127.0.0.1:3000/auth/logout', {
    method: 'POST',
    headers,
    signal: AbortSignal.timeout(15_000),
  });
  if (!logout.ok)
    throw new Error(
      `UAT verification failed: ${username} logout HTTP ${logout.status}.`,
    );
}

/** Credentials/tokens stay in memory and go only to the local backend. */
export async function verifyTemporaryPanelLogin(user: User, password: string) {
  const base = 'http://127.0.0.1:3000/auth';
  const phoneLogin = user.role === 'AGENCY' || user.role === 'USER';
  const route =
    user.role === 'AGENCY'
      ? 'agency/login'
      : user.role === 'USER'
        ? 'customer/login-password'
        : 'staff/login';
  const login = await fetch(`${base}/${route}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(
      phoneLogin
        ? { phone: user.phone, password }
        : { username: user.username, password },
    ),
    signal: AbortSignal.timeout(15_000),
  });
  if (!login.ok)
    throw new Error(
      `UAT verification failed: ${user.username} login HTTP ${login.status}.`,
    );
  const body = (await login.json()) as AuthResponse;
  const accessToken = body.data?.accessToken;
  if (!body.success || !accessToken)
    throw new Error(
      `UAT verification failed: ${user.username} did not receive an access token.`,
    );
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    Cookie: login.headers
      .getSetCookie()
      .map((cookie) => cookie.split(';')[0])
      .join('; '),
  };
  try {
    const me = await fetch(`${base}/me`, {
      headers,
      signal: AbortSignal.timeout(15_000),
    });
    if (!me.ok)
      throw new Error(
        `UAT verification failed: ${user.username} identity HTTP ${me.status}.`,
      );
    const identity = (await me.json()) as AuthResponse;
    if (
      !identity.success ||
      identity.data?.id !== user.id ||
      identity.data?.role !== user.role
    ) {
      throw new Error(
        `UAT verification failed: ${user.username} identity/role mismatch.`,
      );
    }
    return {
      username: user.username,
      role: user.role,
      expiresAt: user.temporaryPasswordOnlyUntil!.toISOString(),
      loginVerified: true,
    };
  } finally {
    // Revoke the verification session without touching the tester's sessions.
    await logoutVerificationSession(headers, user.username);
  }
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV !== 'production')
    throw new Error('Verification requires production-mode UAT.');
  const password = resolveUatSharedPassword();
  const { dataSourceOptions } = await import('./data-source.options.js');
  const source = new DataSource(dataSourceOptions);
  await source.initialize();
  try {
    const accounts = [
      ...TEMPORARY_PANEL_ACCOUNTS,
      ...TEMPORARY_PHONE_LOGIN_ACCOUNTS,
    ];
    const users = await source.getRepository(User).find({
      where: { username: In(accounts.map(({ username }) => username)) },
      order: { username: 'ASC' },
    });
    if (users.length !== accounts.length)
      throw new Error('Verification failed: reserved UAT accounts missing.');
    let failures = 0;
    for (const [index, user] of users.entries()) {
      if (
        !user.isActive ||
        user.deletedAt !== null ||
        user.role !==
          accounts.find(({ username }) => username === user.username)?.role ||
        getTemporaryPanelAccessState(user) !== 'ACTIVE'
      ) {
        throw new Error(`Verification failed: ${user.username} is not active.`);
      }
      // Respect the existing five-login-per-minute limit; do not bypass it.
      if (index > 0) await setTimeout(13_000);
      try {
        process.stdout.write(
          `${JSON.stringify(await verifyTemporaryPanelLogin(user, password))}\n`,
        );
      } catch (error: unknown) {
        failures++;
        process.stdout.write(
          `${JSON.stringify({
            loginVerified: false,
            ...(await diagnoseTemporaryPanelLogin(
              user,
              password,
              source.getRepository(User),
            )),
          })}\n`,
        );
        process.stderr.write(
          `${error instanceof Error ? error.message : 'UAT login verification failed.'}\n`,
        );
      }
    }
    process.stdout.write(
      `${JSON.stringify({ verifiedAccounts: users.length - failures, failedAccounts: failures })}\n`,
    );
    if (failures > 0)
      throw new Error(
        `UAT verification failed for ${failures} reserved account(s).`,
      );
  } finally {
    await source.destroy();
  }
}

if (require.main === module) {
  void main().catch((error: unknown) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  });
}
