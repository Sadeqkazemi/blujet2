import 'dotenv/config';
import 'reflect-metadata';
import { DataSource, In, IsNull } from 'typeorm';
import { assertUatSandboxWriteAllowed } from '../common/uat-shared-password';
import { AuditLog } from './entities/audit-log.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { User } from './entities/user.entity';
import {
  TEMPORARY_PANEL_ACCOUNTS,
  TEMPORARY_PHONE_LOGIN_ACCOUNTS,
  createTemporaryPanelV4Expiry,
  getTemporaryPanelAccessState,
} from './temporary-panel-accounts';

const SOURCE = 'temporary-panel-access-extension-v4';
const CONFIRMATION = 'EXTEND_TEMPORARY_PANEL_ACCESS_7_DAYS_V4';
const ACCOUNTS = [
  ...TEMPORARY_PANEL_ACCOUNTS,
  ...TEMPORARY_PHONE_LOGIN_ACCOUNTS,
];
const TRUSTED_SOURCES = [
  'temporary-panel-account-bootstrap',
  'temporary-panel-access-extension-v1',
  'temporary-panel-access-extension-v2',
  'temporary-panel-access-extension-v3',
];

function assertV4WriteAllowed(): void {
  if (process.env.NODE_ENV !== 'production') {
    throw new Error('Extension v4 refused: NODE_ENV must equal production.');
  }
  assertUatSandboxWriteAllowed();
  if (process.env.TEMP_PANEL_EXTENSION_CONFIRM !== CONFIRMATION) {
    throw new Error(
      `Extension v4 refused: confirmation must equal ${CONFIRMATION}.`,
    );
  }
}

export async function extendTemporaryPanelAccessV4(
  dataSource: DataSource,
  now = new Date(),
) {
  assertV4WriteAllowed();

  return dataSource.transaction(async (manager) => {
    const users = await manager.getRepository(User).find({
      where: { username: In(ACCOUNTS.map(({ username }) => username)) },
      order: { username: 'ASC' },
      lock: { mode: 'pessimistic_write' },
    });
    if (users.length !== ACCOUNTS.length) {
      throw new Error('Extension v4 refused: missing reserved UAT accounts.');
    }
    const audits = manager.getRepository(AuditLog);
    const previousGrants = await audits
      .createQueryBuilder('audit')
      .where('audit.entityType = :type', { type: 'User' })
      .andWhere('audit.entityId IN (:...ids)', {
        ids: users.map(({ id }) => id),
      })
      .andWhere("audit.metadata ->> 'source' = :source", { source: SOURCE })
      .getMany();
    if (previousGrants.length > 0) {
      if (
        new Set(previousGrants.map(({ entityId }) => entityId)).size !==
        ACCOUNTS.length
      ) {
        throw new Error(
          'Extension v4 refused: inconsistent prior grant audit.',
        );
      }
      return {
        version: 4,
        status: 'already_applied',
        accounts: users.map((user) => ({
          username: user.username,
          expiresAt: user.temporaryPasswordOnlyUntil?.toISOString() ?? null,
        })),
      };
    }

    const expiresAt = createTemporaryPanelV4Expiry(now);
    // Validate the entire grant before changing any identity.
    for (const user of users) {
      const expected = ACCOUNTS.find(
        ({ username }) => username === user.username,
      );
      const provenance = await audits
        .createQueryBuilder('audit')
        .where('audit.entityType = :type', { type: 'User' })
        .andWhere('audit.entityId = :id', { id: user.id })
        .andWhere("audit.metadata ->> 'source' IN (:...sources)", {
          sources: TRUSTED_SOURCES,
        })
        .getCount();
      if (
        !expected ||
        user.role !== expected.role ||
        !user.passwordHash ||
        user.isSuperAdmin ||
        provenance < 1 ||
        ('phone' in expected && !user.phone) ||
        (user.temporaryPasswordOnlyUntil &&
          user.temporaryPasswordOnlyUntil > expiresAt) ||
        getTemporaryPanelAccessState(
          {
            ...user,
            twoFactorEnabled: false,
            temporaryPasswordOnlyUntil: expiresAt,
          },
          now,
        ) !== 'ACTIVE'
      ) {
        throw new Error(
          `Extension v4 refused: ineligible reserved identity ${user.username}.`,
        );
      }
    }

    const renewed: Array<{
      username: string;
      previousExpiresAt: string | null;
      expiresAt: string;
    }> = [];
    for (const user of users) {
      const previousExpiresAt =
        user.temporaryPasswordOnlyUntil?.toISOString() ?? null;
      const restoredState = {
        active: !user.isActive,
        deleted: user.deletedAt !== null,
        twoFactor: user.twoFactorEnabled || user.twoFactorSecret !== null,
        mustChangePassword: user.mustChangePassword,
      };
      user.temporaryPasswordOnlyUntil = expiresAt;
      user.isActive = true;
      user.deletedAt = null;
      user.twoFactorEnabled = false;
      user.twoFactorSecret = null;
      user.mustChangePassword = false;
      user.updatedAt = now;
      await manager.getRepository(User).save(user);
      await audits.save(
        audits.create({
          actorId: user.id,
          actorRole: user.role,
          category: 'SECURITY',
          action: 'Temporary UAT access renewed by owner (v4)',
          detail:
            'Reserved UAT access renewed for seven days under owner approval on 2026-09-20.',
          entityType: 'User',
          entityId: user.id,
          requestId: null,
          metadata: {
            source: SOURCE,
            previousExpiresAt,
            expiresAt: expiresAt.toISOString(),
            restoredState,
          },
        }),
      );
      renewed.push({
        username: user.username!,
        previousExpiresAt,
        expiresAt: expiresAt.toISOString(),
      });
    }
    await manager.getRepository(RefreshToken).update(
      {
        userId: In(users.map(({ id }) => id)),
        revokedAt: IsNull(),
      },
      { revokedAt: now },
    );
    return {
      version: 4,
      status: 'extended',
      extendedAt: now.toISOString(),
      accounts: renewed,
    };
  });
}

async function main(): Promise<void> {
  if (!process.argv.includes('--execute')) {
    process.stdout.write(
      `${JSON.stringify(
        {
          mode: 'DRY_RUN',
          version: 4,
          extensionDays: 7,
          usernames: ACCOUNTS.map(({ username }) => username),
        },
        null,
        2,
      )}\n`,
    );
    return;
  }
  assertV4WriteAllowed();
  const { dataSourceOptions } = await import('./data-source.options.js');
  const dataSource = new DataSource(dataSourceOptions);
  await dataSource.initialize();
  try {
    process.stdout.write(
      `${JSON.stringify(await extendTemporaryPanelAccessV4(dataSource), null, 2)}\n`,
    );
  } finally {
    await dataSource.destroy();
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
