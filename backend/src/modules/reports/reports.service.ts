import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { hashPii } from '../../common/pii-crypto';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /** جستجوی مسافر — name contains OR exact national-ID via the deterministic
   * hash (never decrypting rows to search, per the PII rules). */
  async passengers(q?: string) {
    const query = (q ?? '').trim();

    const where = query
      ? {
          OR: [
            { fullName: { contains: query } },
            ...(/^\d{10}$/.test(query)
              ? [{ nationalIdHash: hashPii(query) }]
              : []),
          ],
        }
      : // No query → nothing but the quick-search names.
        { id: 'never-matches' };

    const [matches, quick] = await Promise.all([
      this.prisma.passenger.findMany({
        where,
        take: 5,
        orderBy: { booking: { createdAt: 'desc' } },
        include: {
          booking: {
            include: {
              flightInstance: {
                include: { flight: { include: { route: true } } },
              },
            },
          },
        },
      }),
      this.prisma.passenger.findMany({
        take: 3,
        orderBy: { booking: { createdAt: 'desc' } },
        select: { fullName: true },
        distinct: ['fullName'],
      }),
    ]);

    return {
      results: matches.map((p) => ({
        id: p.id,
        fullName: p.fullName,
        seatCode: p.seatCode,
        pnr: p.booking.pnr,
        status: p.booking.status,
        priceIrr: p.booking.priceIrr,
        flightNo: p.booking.flightInstance.flight.flightNo,
        originCode: p.booking.flightInstance.flight.route.originCode,
        destCode: p.booking.flightInstance.flight.route.destCode,
        departureAt: p.booking.flightInstance.departureAt.toISOString(),
      })),
      quickNames: quick.map((p) => p.fullName),
    };
  }

  /** گزارش عملکرد کارمندان — real audit rows by EMPLOYEE actors, grouped for
   * the per-employee tabs; the IT-notice banner rows come from recent
   * ACCOUNT-category entries (employees created/edited by the IT manager). */
  async staff() {
    const employees = await this.prisma.user.findMany({
      where: { role: 'EMPLOYEE', deletedAt: null },
      select: { id: true, fullName: true, dept: true, rank: true },
      orderBy: { fullName: 'asc' },
    });

    const reports = await this.prisma.auditLog.findMany({
      where: { actorId: { in: employees.map((e) => e.id) } },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        actorId: true,
        category: true,
        action: true,
        detail: true,
        createdAt: true,
      },
    });

    const notices = await this.prisma.auditLog.findMany({
      where: {
        category: 'ACCOUNT',
        actorRole: 'IT_MANAGER',
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 3_600_000) },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, detail: true, createdAt: true },
    });

    return {
      employees,
      reports: reports.map((r) => ({
        id: r.id,
        employeeId: r.actorId,
        category: r.category,
        action: r.action,
        detail: r.detail,
        at: r.createdAt.toISOString(),
      })),
      notices: notices.map((n) => ({
        id: n.id,
        text: n.detail,
        at: n.createdAt.toISOString(),
      })),
    };
  }
}
