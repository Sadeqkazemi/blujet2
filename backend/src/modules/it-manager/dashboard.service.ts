import { Injectable } from '@nestjs/common';
import * as os from 'node:os';
import { TypeORMService } from '../../typeorm/typeorm.service';

@Injectable()
export class ItDashboardService {
  constructor(private readonly typeorm: TypeORMService) {}

  async get() {
    const [
      activeEmployees,
      activeSessions,
      internalServices,
      lastBackup,
      recentEvents,
    ] = await Promise.all([
      this.typeorm.user.count({ where: { role: 'EMPLOYEE', isActive: true } }),
      this.typeorm.refreshToken.count({
        where: { revokedAt: null, expiresAt: { gt: new Date() } },
      }),
      this.typeorm.internalService.findMany(),
      this.typeorm.backupRecord.findFirst({ orderBy: { startedAt: 'desc' } }),
      this.typeorm.auditLog.findMany({
        where: {
          category: { in: ['SYSTEM', 'ACCOUNT', 'ACCESS', 'SECURITY'] },
        },
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),
    ]);
    const external = await this.typeorm.externalServiceConfig.findMany();

    const servicesUp =
      internalServices.filter((s) => s.enabled).length +
      external.filter((s) => s.enabled).length;
    const servicesTotal = internalServices.length + external.length;

    return {
      kpis: {
        activeEmployees,
        activeSessions,
        servicesUp,
        servicesTotal,
        lastBackupStatus: lastBackup?.status ?? null,
        lastBackupAt: lastBackup?.startedAt ?? null,
      },
      serviceHealth: [
        ...internalServices.map((s) => ({
          name: s.nameFa,
          uptimePct: s.uptimePct,
          enabled: s.enabled,
        })),
        ...external.map((s) => ({
          name: s.nameFa,
          uptimePct: s.lastTestOk ? 100 : s.lastTestOk === false ? 0 : null,
          enabled: s.enabled,
        })),
      ],
      // Real host metrics — never synthetic/random numbers.
      resources: {
        memoryUsedPct:
          Math.round(((os.totalmem() - os.freemem()) / os.totalmem()) * 1000) /
          10,
        loadAvg1m: os.loadavg()[0],
        cpuCount: os.cpus().length,
        uptimeSeconds: os.uptime(),
      },
      recentEvents: recentEvents.map((e) => ({
        id: e.id,
        text: e.detail,
        category: e.category,
        createdAt: e.createdAt,
      })),
    };
  }
}
