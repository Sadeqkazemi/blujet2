import 'dotenv/config';
import 'reflect-metadata';
import * as argon2 from 'argon2';
import { DataSource, In } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';
import { User } from './entities/user.entity';
import { dataSourceOptions } from './data-source.options';
import {
  TEMPORARY_PANEL_ACCOUNTS,
  createTemporaryPanelExpiry,
  generateTemporaryPanelPassword,
} from './temporary-panel-accounts';

const CONFIRMATION = 'CREATE_7_DAY_PANEL_TEST_ACCOUNTS';

async function main(): Promise<void> {
  if (!process.argv.includes('--execute')) {
    process.stdout.write(
      `${JSON.stringify({ mode: 'DRY_RUN', accounts: TEMPORARY_PANEL_ACCOUNTS }, null, 2)}\n`,
    );
    return;
  }
  if (process.env.NODE_ENV !== 'production') {
    throw new Error('Bootstrap refused: NODE_ENV must equal production.');
  }
  if (process.env.TEMP_PANEL_BOOTSTRAP_CONFIRM !== CONFIRMATION) {
    throw new Error(
      `Bootstrap refused: TEMP_PANEL_BOOTSTRAP_CONFIRM must equal ${CONFIRMATION}.`,
    );
  }

  const createdAt = new Date();
  const expiresAt = createTemporaryPanelExpiry(createdAt);
  const credentials = TEMPORARY_PANEL_ACCOUNTS.map((account) => ({
    ...account,
    password: generateTemporaryPanelPassword(),
  }));
  const dataSource = new DataSource(dataSourceOptions);
  await dataSource.initialize();

  try {
    await dataSource.transaction(async (manager) => {
      const userRepository = manager.getRepository(User);
      const existing = await userRepository.find({
        where: {
          username: In(credentials.map(({ username }) => username)),
        },
        select: { username: true },
      });
      if (existing.length > 0) {
        throw new Error(
          `Bootstrap refused: temporary usernames already exist (${existing
            .map(({ username }) => username)
            .join(', ')}). Existing accounts were not changed.`,
        );
      }

      for (const credential of credentials) {
        const user = await userRepository.save(
          userRepository.create({
            role: credential.role,
            phone: null,
            username: credential.username,
            passwordHash: await argon2.hash(credential.password),
            email: null,
            fullName: credential.fullName,
            twoFactorEnabled: false,
            twoFactorSecret: null,
            temporaryPasswordOnlyUntil: expiresAt,
            isActive: true,
            deletedAt: null,
            createdAt,
            updatedAt: createdAt,
            createdById: null,
            dept: null,
            lastLoginAt: null,
            mustChangePassword: false,
            rank: null,
            referralScope: null,
            nationalIdEnc: null,
            nationalIdHash: null,
            passportNoEnc: null,
            birthDate: null,
            emailVerifiedAt: null,
            preferredLocale: 'FA',
            referralCode: null,
          }),
        );
        await manager.getRepository(AuditLog).save(
          manager.getRepository(AuditLog).create({
            actorId: user.id,
            actorRole: user.role,
            category: 'SECURITY',
            action: 'ایجاد دسترسی آزمایشی موقت پنل',
            detail: `حساب ${user.username} فقط برای UAT و تا ${expiresAt.toISOString()} ایجاد شد.`,
            entityType: 'User',
            entityId: user.id,
            metadata: {
              source: 'temporary-panel-account-bootstrap',
              expiresAt: expiresAt.toISOString(),
            },
            requestId: null,
          }),
        );
      }
    });

    process.stdout.write(
      `${JSON.stringify(
        {
          createdAt: createdAt.toISOString(),
          expiresAt: expiresAt.toISOString(),
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
