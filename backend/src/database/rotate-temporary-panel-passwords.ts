import 'dotenv/config';
import 'reflect-metadata';
import * as argon2 from 'argon2';
import { DataSource, In, IsNull } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { User } from './entities/user.entity';
import { dataSourceOptions } from './data-source.options';
import {
  TEMPORARY_PANEL_ACCOUNTS,
  generateTemporaryPanelPassword,
  getTemporaryPanelAccessState,
} from './temporary-panel-accounts';

const CONFIRMATION = 'ROTATE_TEMPORARY_PANEL_PASSWORDS_ALPHANUMERIC_V1';

async function main(): Promise<void> {
  if (!process.argv.includes('--execute')) {
    process.stdout.write(
      `${JSON.stringify(
        {
          mode: 'DRY_RUN',
          passwordFormat: '16 ASCII letters or digits',
          usernames: TEMPORARY_PANEL_ACCOUNTS.map(({ username }) => username),
        },
        null,
        2,
      )}\n`,
    );
    return;
  }
  if (process.env.NODE_ENV !== 'production') {
    throw new Error('Rotation refused: NODE_ENV must equal production.');
  }
  if (process.env.TEMP_PANEL_ROTATE_CONFIRM !== CONFIRMATION) {
    throw new Error(
      `Rotation refused: TEMP_PANEL_ROTATE_CONFIRM must equal ${CONFIRMATION}.`,
    );
  }

  const credentials = TEMPORARY_PANEL_ACCOUNTS.map((account) => ({
    ...account,
    password: generateTemporaryPanelPassword(),
  }));
  const dataSource = new DataSource(dataSourceOptions);
  await dataSource.initialize();

  try {
    const result = await dataSource.transaction(async (manager) => {
      const userRepository = manager.getRepository(User);
      const users = await userRepository.find({
        where: {
          username: In(credentials.map(({ username }) => username)),
        },
      });
      if (users.length !== credentials.length) {
        throw new Error(
          `Rotation refused: expected ${credentials.length} temporary accounts but found ${users.length}.`,
        );
      }

      const now = new Date();
      const usersByUsername = new Map(
        users.map((user) => [user.username, user] as const),
      );
      for (const credential of credentials) {
        const user = usersByUsername.get(credential.username);
        if (
          !user ||
          user.role !== credential.role ||
          !user.isActive ||
          user.deletedAt !== null ||
          user.passwordHash === null ||
          getTemporaryPanelAccessState(user, now) !== 'ACTIVE'
        ) {
          throw new Error(
            `Rotation refused: ${credential.username} is not an active, unexpired temporary ${credential.role} account.`,
          );
        }
      }

      const expiryTimes = new Set(
        users.map((user) => user.temporaryPasswordOnlyUntil!.getTime()),
      );
      if (expiryTimes.size !== 1) {
        throw new Error(
          'Rotation refused: temporary accounts do not share one expiry.',
        );
      }

      for (const credential of credentials) {
        const user = usersByUsername.get(credential.username)!;
        user.passwordHash = await argon2.hash(credential.password);
        user.updatedAt = now;
        await userRepository.save(user);
        await manager.getRepository(AuditLog).save(
          manager.getRepository(AuditLog).create({
            actorId: user.id,
            actorRole: user.role,
            category: 'SECURITY',
            action: 'Temporary panel password rotated',
            detail: `Password format migrated for ${user.username}; expiry was preserved.`,
            entityType: 'User',
            entityId: user.id,
            metadata: {
              source: 'temporary-panel-password-format-v1-rotation',
              expiresAt: user.temporaryPasswordOnlyUntil!.toISOString(),
            },
            requestId: null,
          }),
        );
      }

      await manager.getRepository(RefreshToken).update(
        {
          userId: In(users.map(({ id }) => id)),
          revokedAt: IsNull(),
        },
        { revokedAt: now },
      );

      return {
        rotatedAt: now.toISOString(),
        expiresAt: users[0].temporaryPasswordOnlyUntil!.toISOString(),
      };
    });

    process.stdout.write(
      `${JSON.stringify(
        {
          ...result,
          loginPath: '/login',
          accounts: credentials.map(
            ({ username, role, fullName, password }) => ({
              username,
              role,
              fullName,
              password,
            }),
          ),
        },
        null,
        2,
      )}\n`,
    );
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
