import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { TypeORMService } from '../../src/typeorm/typeorm.service';
import { TWO_FACTOR_PROVIDER } from '../../src/modules/auth/providers/two-factor-provider.interface';
import { MockTwoFactorProvider } from '../../src/modules/auth/providers/mock-two-factor.provider';

/** Drives the full username/password + 2FA flow for a seeded staff account. */
export async function loginAs(
  app: INestApplication<App>,
  username: string,
  password = 'Blujet@1404',
) {
  const typeorm = app.get(TypeORMService);
  const twoFactor = app.get<MockTwoFactorProvider>(TWO_FACTOR_PROVIDER);

  const loginRes = await request(app.getHttpServer())
    .post('/auth/staff/login')
    .send({ username, password });

  if (loginRes.status !== 200) {
    return { loginRes, verifyRes: null, accessToken: null as string | null };
  }

  const user = await typeorm.user.findUniqueOrThrow({ where: { username } });
  const code = twoFactor.getLastCode(user.id);
  if (!code) throw new Error(`No 2FA code recorded for ${username}`);

  const verifyRes = await request(app.getHttpServer())
    .post('/auth/staff/login/verify')
    .send({ challengeId: loginRes.body.data.challengeId, code });

  return {
    loginRes,
    verifyRes,
    accessToken: verifyRes.body?.data?.accessToken as string | undefined,
  };
}
