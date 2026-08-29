import 'dotenv/config';
import 'reflect-metadata';
import { DataSource, In, IsNull } from 'typeorm';
import { normalizeIranPhone } from '../common/normalize-iran-phone';
import { assertUatSandboxWriteAllowed } from '../common/uat-shared-password';
import { dataSourceOptions } from './data-source.options';
import { AuditLog } from './entities/audit-log.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { User } from './entities/user.entity';
import {
  TEMPORARY_PHONE_LOGIN_ACCOUNTS,
  getTemporaryPanelAccessState,
} from './temporary-panel-accounts';

const CONFIRMATION = 'RECONCILE_TEMPORARY_PHONE_LOGINS_V1';
const TRUSTED_PROVENANCE_SOURCES = [
  'temporary-panel-account-bootstrap',
  'temporary-panel-access-extension-v1',
  'temporary-panel-access-extension-v2',
  'temporary-panel-access-extension-v3',
] as const;

/** Before the dedicated UAT phone identities existed, using one of their
 * reserved numbers in the public OTP flow could create a passwordless USER
 * shell. Keep that historical row (and every relation pointing at it), but
 * allow the reserved phone to be released only when the row still has the
 * exact minimal shape produced by AuthService.requestOtp(). */
function isLegacyOtpShadowOwner(user: User, normalizedPhone: string): boolean {
  return (
    user.phone === normalizedPhone &&
    user.role === 'USER' &&
    user.username === null &&
    user.passwordHash === null &&
    user.email === null &&
    user.fullName === normalizedPhone &&
    user.twoFactorEnabled === false &&
    user.twoFactorSecret === null &&
    user.temporaryPasswordOnlyUntil === null &&
    user.isActive === true &&
    user.deletedAt === null &&
    user.isSuperAdmin === false &&
    user.panelPermissions === null &&
    user.createdById === null &&
    user.dept === null &&
    user.mustChangePassword === false &&
    user.rank === null &&
    user.referralScope === null &&
    user.nationalIdEnc === null &&
    user.nationalIdHash === null &&
    user.passportNoEnc === null &&
    user.birthDate === null &&
    user.addressEnc === null &&
    user.emailVerifiedAt === null &&
    user.referralCode === null
  );
}

async function main(): Promise<void> {
  const expectedAccounts = TEMPORARY_PHONE_LOGIN_ACCOUNTS.map((account) => ({
    ...account,
    normalizedPhone: normalizeIranPhone(account.phone),
  }));

  if (!process.argv.includes('--execute')) {
    process.stdout.write(
      `${JSON.stringify(
        {
          mode: 'DRY_RUN',
          version: 1,
          accounts: expectedAccounts.map(
            ({ username, role, normalizedPhone }) => ({
              username,
              role,
              normalizedPhone,
            }),
          ),
        },
        null,
        2,
      )}\n`,
    );
    return;
  }
  if (process.env.NODE_ENV !== 'production') {
    throw new Error(
      'Phone-login reconciliation refused: NODE_ENV must equal production.',
    );
  }
  if (process.env.TEMP_PHONE_LOGIN_RECONCILE_CONFIRM !== CONFIRMATION) {
    throw new Error(
      `Phone-login reconciliation refused: TEMP_PHONE_LOGIN_RECONCILE_CONFIRM must equal ${CONFIRMATION}.`,
    );
  }
  assertUatSandboxWriteAllowed();

  const dataSource = new DataSource(dataSourceOptions);
  await dataSource.initialize();
  try {
    const result = await dataSource.transaction(async (manager) => {
      const userRepository = manager.getRepository(User);
      const users = await userRepository.find({
        where: {
          username: In(expectedAccounts.map(({ username }) => username)),
        },
      });
      if (users.length !== expectedAccounts.length) {
        const found = new Set(users.map(({ username }) => username));
        const missing = expectedAccounts
          .map(({ username }) => username)
          .filter((username) => !found.has(username));
        throw new Error(
          `Phone-login reconciliation refused: missing temporary accounts (${missing.join(', ')}).`,
        );
      }

      const now = new Date();
      const usersByUsername = new Map(
        users.map((user) => [user.username, user] as const),
      );
      const normalizedPhoneOwners = await userRepository.find({
        where: {
          phone: In(
            expectedAccounts.map(({ normalizedPhone }) => normalizedPhone),
          ),
        },
      });
      const expectedUserIds = new Set(users.map(({ id }) => id));
      const conflictingOwners = normalizedPhoneOwners.filter(
        ({ id }) => !expectedUserIds.has(id),
      );
      const normalizedPhones = new Set(
        expectedAccounts.map(({ normalizedPhone }) => normalizedPhone),
      );
      const ineligibleConflictingOwner = conflictingOwners.find(
        (owner) =>
          !owner.phone ||
          !normalizedPhones.has(owner.phone) ||
          !isLegacyOtpShadowOwner(owner, owner.phone),
      );
      if (ineligibleConflictingOwner) {
        throw new Error(
          'Phone-login reconciliation refused: a canonical reserved UAT phone is owned by an ineligible account.',
        );
      }

      for (const account of expectedAccounts) {
        const user = usersByUsername.get(account.username);
        const trustedAuditCount = user
          ? await manager
              .getRepository(AuditLog)
              .createQueryBuilder('audit')
              .where('audit.entityId = :entityId', { entityId: user.id })
              .andWhere('audit.entityType = :entityType', {
                entityType: 'User',
              })
              .andWhere("audit.metadata ->> 'source' IN (:...sources)", {
                sources: TRUSTED_PROVENANCE_SOURCES,
              })
              .getCount()
          : 0;
        if (
          !user ||
          user.role !== account.role ||
          !user.isActive ||
          user.deletedAt !== null ||
          user.passwordHash === null ||
          getTemporaryPanelAccessState(user, now) !== 'ACTIVE' ||
          trustedAuditCount < 1
        ) {
          throw new Error(
            `Phone-login reconciliation refused: ${account.username} is not an eligible active temporary ${account.role} account.`,
          );
        }
      }

      const reconciled = [] as Array<{
        username: string;
        role: string;
        normalizedPhone: string;
        status: 'already_normalized' | 'reconciled';
      }>;

      // Release only the exact passwordless OTP shells validated above. The
      // rows and all of their business/history relations remain intact; only
      // the owner-approved reserved test phone is moved to its dedicated UAT
      // identity. Sessions are revoked below in the same transaction.
      for (const shadowOwner of conflictingOwners) {
        const previousPhone = shadowOwner.phone!;
        shadowOwner.phone = null;
        shadowOwner.updatedAt = now;
        await userRepository.save(shadowOwner);
        await manager.getRepository(AuditLog).save(
          manager.getRepository(AuditLog).create({
            actorId: shadowOwner.id,
            actorRole: shadowOwner.role,
            category: 'SECURITY',
            action: 'Legacy UAT OTP shadow phone released',
            detail:
              'A reserved UAT phone was released from its legacy passwordless OTP shell.',
            entityType: 'User',
            entityId: shadowOwner.id,
            metadata: {
              source: 'temporary-phone-login-reconciliation-v1',
              previousPhone,
              status: 'legacy_otp_shadow_released',
            },
            requestId: null,
          }),
        );
      }
      for (const account of expectedAccounts) {
        const user = usersByUsername.get(account.username)!;
        const status =
          user.phone === account.normalizedPhone
            ? ('already_normalized' as const)
            : ('reconciled' as const);
        const previousPhone = user.phone;
        user.phone = account.normalizedPhone;
        user.updatedAt = now;
        await userRepository.save(user);
        await manager.getRepository(AuditLog).save(
          manager.getRepository(AuditLog).create({
            actorId: user.id,
            actorRole: user.role,
            category: 'SECURITY',
            action: 'Temporary UAT phone login identity reconciled',
            detail: `Canonical phone login identity reconciled for ${user.username}.`,
            entityType: 'User',
            entityId: user.id,
            metadata: {
              source: 'temporary-phone-login-reconciliation-v1',
              previousPhone,
              normalizedPhone: account.normalizedPhone,
              status,
            },
            requestId: null,
          }),
        );
        reconciled.push({
          username: account.username,
          role: account.role,
          normalizedPhone: account.normalizedPhone,
          status,
        });
      }

      await manager.getRepository(RefreshToken).update(
        {
          userId: In([
            ...users.map(({ id }) => id),
            ...conflictingOwners.map(({ id }) => id),
          ]),
          revokedAt: IsNull(),
        },
        { revokedAt: now },
      );

      return {
        version: 1,
        reconciledAt: now.toISOString(),
        releasedLegacyOtpShadowCount: conflictingOwners.length,
        accounts: reconciled,
      };
    });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
