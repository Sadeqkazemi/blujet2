import { Injectable } from '@nestjs/common';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';

const execFileAsync = promisify(execFile);
const BACKUP_DIR =
  process.env.BACKUP_DIR ?? path.join(process.cwd(), 'backups');

async function runPgDump(databaseUrl: string, filePath: string): Promise<void> {
  await execFileAsync(
    'pg_dump',
    [
      `--dbname=${databaseUrl}`,
      '-f',
      filePath,
      '--no-owner',
      '--no-privileges',
    ],
    { timeout: 5 * 60 * 1000 },
  );
}

@Injectable()
export class BackupsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list() {
    return this.prisma.backupRecord.findMany({
      orderBy: { startedAt: 'desc' },
    });
  }

  /** Real pg_dump — a missing binary or unreachable DB is a real FAILED row,
   * never a fabricated SUCCESS. Restore is intentionally not wired here
   * (see docs/API.md's Phase 8 note); this only creates dumps. */
  async create(actor: AuthenticatedUser) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const fileName = `blujet-${new Date().toISOString().replace(/[:.]/g, '-')}.sql`;
    const filePath = path.join(BACKUP_DIR, fileName);

    const record = await this.prisma.backupRecord.create({
      data: { fileName, status: 'RUNNING', triggeredById: actor.id },
    });

    const databaseUrl = process.env.DATABASE_URL ?? '';
    try {
      await runPgDump(databaseUrl, filePath);
      const sizeBytes = fs.statSync(filePath).size;
      const updated = await this.prisma.backupRecord.update({
        where: { id: record.id },
        data: { status: 'SUCCESS', completedAt: new Date(), sizeBytes },
      });
      await this.audit.record({
        actorId: actor.id,
        actorRole: actor.role,
        category: 'SYSTEM',
        action: 'ایجاد نسخه پشتیبان',
        detail: `${actor.fullName} یک نسخه پشتیبان جدید ایجاد کرد (${fileName}).`,
        entityType: 'BackupRecord',
        entityId: record.id,
      });
      return updated;
    } catch (err) {
      const updated = await this.prisma.backupRecord.update({
        where: { id: record.id },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          errorMessage: err instanceof Error ? err.message : 'خطای نامشخص',
        },
      });
      await this.audit.record({
        actorId: actor.id,
        actorRole: actor.role,
        category: 'SYSTEM',
        action: 'خطا در ایجاد نسخه پشتیبان',
        detail: `تلاش ${actor.fullName} برای ایجاد نسخه پشتیبان ناموفق بود.`,
        entityType: 'BackupRecord',
        entityId: record.id,
      });
      return updated;
    }
  }

  /** Static — describes the server-side cron already documented in
   * docs/RUNBOOK.md / scripts/backup-db.sh; this phase does not add a
   * second, competing scheduler. */
  schedule() {
    return {
      databaseBackup: 'هر ۶ ساعت',
      fileBackup: 'روزانه ۰۳:۰۰',
      retentionDays: 30,
      cloudStorage: 'متصل',
    };
  }
}
