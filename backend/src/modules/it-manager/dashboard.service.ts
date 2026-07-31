import { Injectable } from '@nestjs/common';
import * as os from 'node:os';
import { statfs } from 'node:fs/promises';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ItDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  private async diskUsedPct(): Promise<number | null> {
    try {
      const stats = await statfs('/');
      if (!stats.blocks) return null;
      const used = stats.blocks - stats.bfree;
      return Math.round((used / stats.blocks) * 1000) / 10;
    } catch {
      return null;
    }
  }

  async get() {
    const [
      activeSessions,
      internalServices,
      lastBackup,
      recentEvents,
      securityAlerts,
    ] = await Promise.all([
      this.prisma.refreshToken.count({
        where: { revokedAt: null, expiresAt: { gt: new Date() } },
      }),
      this.prisma.internalService.findMany(),
      this.prisma.backupRecord.findFirst({ orderBy: { startedAt: 'desc' } }),
      this.prisma.auditLog.findMany({
        where: {
          category: { in: ['SYSTEM', 'ACCOUNT', 'ACCESS', 'SECURITY'] },
        },
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),
      this.prisma.auditLog.count({
        where: {
          category: 'SECURITY',
          createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
      }),
    ]);
    const external = await this.prisma.externalServiceConfig.findMany();
    const diskUsedPct = await this.diskUsedPct();

    const servicesUp =
      internalServices.filter((s) => s.enabled).length +
      external.filter((s) => s.enabled).length;
    const servicesTotal = internalServices.length + external.length;

    const uptime30dPct =
      internalServices.length > 0
        ? Math.round(
            (internalServices.reduce((sum, s) => sum + s.uptimePct, 0) /
              internalServices.length) *
              100,
          ) / 100
        : 0;

    const cpuCount = os.cpus().length;
    const loadAvg1m = os.loadavg()[0];
    const cpuUsedPct = Math.min(
      100,
      Math.round(
        ((loadAvg1m / Math.max(cpuCount, 1)) * 100 + Number.EPSILON) * 10,
      ) / 10,
    );
    const memoryUsedPct =
      Math.round(((os.totalmem() - os.freemem()) / os.totalmem()) * 1000) / 10;

    const allInternalHealthy = internalServices.every((s) => s.enabled);

    return {
      kpis: {
        servicesUp,
        servicesTotal,
        uptime30dPct,
        activeSessions,
        securityAlerts,
        allServicesHealthy: allInternalHealthy,
        lastBackupStatus: lastBackup?.status ?? null,
        lastBackupAt: lastBackup?.startedAt ?? null,
      },
      serviceHealth: internalServices.slice(0, 6).map((s) => ({
        name: s.nameFa,
        uptimePct: s.uptimePct,
        enabled: s.enabled,
      })),
      resources: {
        cpuUsedPct,
        memoryUsedPct,
        diskUsedPct,
        loadAvg1m,
        cpuCount,
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
