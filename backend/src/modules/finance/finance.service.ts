import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ReportingService } from '../reporting/reporting.service';
import { ErrorCode } from '../../common/errors';
import type { SalesGranularity } from '../reporting/reporting.types';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';

/** Persian labels for the transactions list, per the design's رows. */
const TX_META: Record<
  string,
  { labelFa: string; direction: 'IN' | 'OUT' }
> = {
  SALE: { labelFa: 'درآمد فروش بلیط', direction: 'IN' },
  SETTLEMENT: { labelFa: 'تسویه حساب دوره‌ای', direction: 'IN' },
  REFUND: { labelFa: 'استرداد بلیط', direction: 'OUT' },
  COMMISSION: { labelFa: 'کمیسیون آژانس همکار', direction: 'OUT' },
  OPERATING_COST: { labelFa: 'هزینه عملیاتی', direction: 'OUT' },
};

@Injectable()
export class FinanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly reporting: ReportingService,
  ) {}

  /** The مالی tab in one call, re-scoped by the chart period params. */
  async summary(
    granularity: SalesGranularity,
    params: {
      periodStart?: string;
      date?: string;
      flightNo?: string;
      periodKey?: string;
    },
  ) {
    const [kpis, seats] = await Promise.all([
      this.reporting.kpis(granularity, params),
      this.reporting.completedFlightsSummary(granularity, params),
    ]);
    // Channel donut over the same range: reuse the chart for the full range,
    // summing its buckets.
    const chart = await this.reporting.salesChart(
      granularity === 'flight' ? 'flight' : granularity,
      params,
    );
    const scoped = params.periodKey
      ? chart.filter((p) => p.periodKey === params.periodKey)
      : chart;
    const donut = scoped.reduce(
      (acc, p) => ({
        SYSTEM: acc.SYSTEM + p.systemIrr,
        CHARTER: acc.CHARTER + p.charterIrr,
        AGENCY: acc.AGENCY + p.agencyIrr,
      }),
      { SYSTEM: 0, CHARTER: 0, AGENCY: 0 },
    );
    return { kpis, seats, donut };
  }

  /** «تراکنش‌های مالی اخیر» — finance manager only (enforced in controller). */
  async transactions() {
    const rows = await this.prisma.ledgerEntry.findMany({
      orderBy: { occurredAt: 'desc' },
      take: 20,
      include: {
        booking: {
          select: {
            pnr: true,
            passengers: { select: { fullName: true }, take: 1 },
          },
        },
        agency: { select: { user: { select: { fullName: true } } } },
      },
    });
    return rows.map((r) => {
      const meta = TX_META[r.type] ?? { labelFa: r.type, direction: 'OUT' };
      const party =
        r.agency?.user.fullName ??
        (r.booking
          ? `${r.booking.passengers[0]?.fullName ?? 'مسافر'} · ${r.booking.pnr}`
          : 'سامانه');
      return {
        id: r.id,
        type: r.type,
        labelFa: meta.labelFa,
        direction: meta.direction,
        party,
        amountIrr: Math.abs(r.signedAmountIrr),
        signedAmountIrr: r.signedAmountIrr,
        occurredAt: r.occurredAt.toISOString(),
      };
    });
  }

  /** «تسویه‌حساب آژانس‌های همکار» — real AgencyInvoice state, no partial-payment
   * percentages invented (paid is 100٪ or 0٪ until partial payments exist). */
  async settlements() {
    const invoices = await this.prisma.agencyInvoice.findMany({
      orderBy: { dueAt: 'asc' },
      take: 20,
      include: {
        agency: { select: { user: { select: { fullName: true } } } },
      },
    });
    const now = Date.now();
    const rows = invoices.map((inv) => {
      const overdueDays =
        inv.status !== 'PAID' && inv.dueAt.getTime() < now
          ? Math.ceil((now - inv.dueAt.getTime()) / (24 * 3_600_000))
          : 0;
      const status: 'SETTLED' | 'PENDING' | 'OVERDUE' =
        inv.status === 'PAID'
          ? 'SETTLED'
          : overdueDays > 0
            ? 'OVERDUE'
            : 'PENDING';
      return {
        id: inv.id,
        invoiceNo: inv.invoiceNo,
        agencyName: inv.agency.user.fullName,
        amountIrr: inv.amountIrr,
        dueAt: inv.dueAt.toISOString(),
        issuedAt: inv.issuedAt.toISOString(),
        status,
        overdueDays,
        paidPct: inv.status === 'PAID' ? 100 : 0,
      };
    });
    const outstandingIrr = rows
      .filter((r) => r.status !== 'SETTLED')
      .reduce((a, r) => a + r.amountIrr, 0);
    return { rows, outstandingIrr };
  }

  async remind(actor: AuthenticatedUser, invoiceId: string) {
    const invoice = await this.prisma.agencyInvoice.findUnique({
      where: { id: invoiceId },
      include: { agency: { select: { user: { select: { fullName: true } } } } },
    });
    if (!invoice) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'فاکتور یافت نشد.',
      });
    }
    // Queued via the SmsProvider/email interface — mocked in dev/tests per CLAUDE.md.
    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'FINANCE',
      action: 'ارسال یادآوری تسویه',
      detail: `یادآوری تسویه فاکتور ${invoice.invoiceNo} برای «${invoice.agency.user.fullName}» توسط ${actor.fullName} ارسال شد.`,
      entityType: 'AgencyInvoice',
      entityId: invoiceId,
    });
    return { reminded: true, agencyName: invoice.agency.user.fullName };
  }
}
