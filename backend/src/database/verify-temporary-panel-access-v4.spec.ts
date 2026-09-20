import { User } from './entities/user.entity';
import * as argon2 from 'argon2';
import type { Repository } from 'typeorm';
import {
  diagnoseTemporaryPanelLogin,
  verifyTemporaryPanelLogin,
} from './verify-temporary-panel-access-v4';

describe('live UAT access verification', () => {
  const password = 'synthetic-secret-not-for-output';
  const token = 'synthetic-token-not-for-output';
  const user = Object.assign(new User(), {
    id: 'uat-id',
    username: 'uat.it',
    role: 'IT_MANAGER',
    phone: '+989000000001',
    temporaryPasswordOnlyUntil: new Date('2026-09-27T14:00:00Z'),
  });
  afterEach(() => jest.restoreAllMocks());

  it('distinguishes a phone collision from password drift without disclosing account data', async () => {
    const passwordHash = await argon2.hash(password);
    const customer = Object.assign(new User(), user, {
      role: 'USER',
      phone: '09000000002',
      passwordHash,
    });
    const findOneBy = jest.fn().mockResolvedValue({ id: 'other-private-id' });
    const result = await diagnoseTemporaryPanelLogin(customer, password, {
      findOneBy,
    } as unknown as Repository<User>);
    expect(result).toEqual({
      username: customer.username,
      passwordMatches: true,
      phoneIsCanonical: false,
      phoneLookupMatches: false,
    });
    expect(findOneBy).toHaveBeenCalledWith({ phone: '+989000000002' });
    expect(JSON.stringify(result)).not.toContain('private');
    expect(JSON.stringify(result)).not.toContain(password);
  });

  it('identifies password drift when the canonical phone belongs to the correct user', async () => {
    const passwordHash = await argon2.hash('different-synthetic-password');
    const customer = Object.assign(new User(), user, {
      role: 'USER',
      phone: '+989000000002',
      passwordHash,
    });
    const findOneBy = jest.fn().mockResolvedValue({ id: customer.id });
    expect(
      await diagnoseTemporaryPanelLogin(customer, password, {
        findOneBy,
      } as unknown as Repository<User>),
    ).toMatchObject({
      passwordMatches: false,
      phoneIsCanonical: true,
      phoneLookupMatches: true,
    });
  });

  it.each([
    ['IT_MANAGER', 'staff/login'],
    ['AGENCY', 'agency/login'],
    ['USER', 'customer/login-password'],
  ])(
    'verifies %s through its real login surface without exposing credentials',
    async (role, route) => {
      const loginUser = Object.assign(new User(), user, { role });
      const fetchMock = jest
        .spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({ success: true, data: { accessToken: token } }),
            { headers: { 'set-cookie': 'blujet_refresh=secret; HttpOnly' } },
          ),
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({ success: true, data: { id: user.id, role } }),
          ),
        )
        .mockResolvedValueOnce(new Response(JSON.stringify({ success: true })));
      const result = await verifyTemporaryPanelLogin(loginUser, password);
      expect(fetchMock.mock.calls[0][0]).toBe(
        `http://127.0.0.1:3000/auth/${route}`,
      );
      expect(fetchMock.mock.calls[2][0]).toBe(
        'http://127.0.0.1:3000/auth/logout',
      );
      expect(result.loginVerified).toBe(true);
      expect(JSON.stringify(result)).not.toContain(password);
      expect(JSON.stringify(result)).not.toContain(token);
    },
  );

  it('fails closed on login rejection', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(null, { status: 403 }));
    await expect(verifyTemporaryPanelLogin(user, password)).rejects.toThrow(
      'login HTTP 403',
    );
  });

  it('rejects a different identity and still revokes its verification session', async () => {
    const fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ success: true, data: { accessToken: token } }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: { id: 'other', role: user.role },
          }),
        ),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true })));
    await expect(verifyTemporaryPanelLogin(user, password)).rejects.toThrow(
      'identity/role mismatch',
    );
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
