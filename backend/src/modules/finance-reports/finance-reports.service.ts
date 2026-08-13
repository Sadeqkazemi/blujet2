import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ErrorCode } from '../../common/errors';
import {
  FinanceExportFormat,
  FinanceReportQueryDto,
  FinanceReportScope,
  FinanceFlightSearchQueryDto,
} from './dto/finance-report-query.dto';

type RawPartner = {
  id: string;
  name: string;
  totalIrr: string;
  agencyOutstandingIrr: string;
  agencySalesIrr: string;
  soldSeats: string;
};

type RawFlight = {
  flightInstanceId: string;
  flightNo: string;
  departureAt: Date | string;
  originCode: string;
  destCode: string;
  originCityFa: string | null;
  destCityFa: string | null;
  capacity: string;
  soldSeats: string;
  totalIrr: string;
  agencyCount: string;
  agencySeats: string;
};

const PAID_BOOKING_STATUSES = ['PAID', 'TICKETED'];

function bigintString(
  value: string | number | bigint | null | undefined,
): string {
  return String(value ?? '0');
}

function escapeCsv(value: string | number): string {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function escapeXml(value: string | number): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

@Injectable()
export class FinanceReportsService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  private assertRange(query: FinanceReportQueryDto) {
    if ((query.from && !query.to) || (!query.from && query.to)) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'ابتدا و انتهای بازه باید با هم ارسال شوند.',
      });
    }
    if (query.from && query.to && new Date(query.from) >= new Date(query.to)) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'انتهای بازه باید بعد از ابتدای آن باشد.',
      });
    }
  }

  private applyRange(
    qb: ReturnType<DataSource['createQueryBuilder']>,
    query: FinanceReportQueryDto,
  ) {
    if (query.from && query.to) {
      qb.andWhere('fi."departureAt" >= :from AND fi."departureAt" < :to', {
        from: query.from,
        to: query.to,
      });
    }
    if (query.flightInstanceId) {
      qb.andWhere('fi.id = :flightInstanceId', {
        flightInstanceId: query.flightInstanceId,
      });
    }
  }

  async report(query: FinanceReportQueryDto) {
    this.assertRange(query);
    if (query.scope === FinanceReportScope.CUSTOMERS)
      return this.customerReport(query);
    return this.partnerReport(query);
  }

  private async partnerReport(query: FinanceReportQueryDto) {
    const channel =
      query.scope === FinanceReportScope.AGENCIES ? 'AGENCY' : 'CHARTER';
    const qb = this.dataSource
      .createQueryBuilder()
      .select('COALESCE(ap."userId", :fallbackId)', 'id')
      .addSelect('COALESCE(u."fullName", :fallbackName)', 'name')
      .addSelect(
        'COALESCE(SUM(b."priceIrr" + b."taxIrr" + b."extrasIrr"), 0)',
        'totalIrr',
      )
      .addSelect(
        `COALESCE((SELECT GREATEST(SUM(le."signedAmountIrr"), 0) FROM ledger_entries le WHERE le."agencyId" = ap."userId" AND le.type IN ('SALE','SETTLEMENT')), 0)`,
        'agencyOutstandingIrr',
      )
      .addSelect(
        `COALESCE((SELECT SUM(ABS(le."signedAmountIrr")) FROM ledger_entries le WHERE le."agencyId" = ap."userId" AND le.type = 'SALE'), 0)`,
        'agencySalesIrr',
      )
      .addSelect(
        'COALESCE(SUM((SELECT COUNT(*) FROM passengers p WHERE p."bookingId" = b.id AND p."deletedAt" IS NULL AND p."occupiesSeat" = true)), 0)',
        'soldSeats',
      )
      .from('bookings', 'b')
      .innerJoin('flight_instances', 'fi', 'fi.id = b."flightInstanceId"')
      .leftJoin('agency_profiles', 'ap', 'ap."userId" = b."agencyId"')
      .leftJoin('users', 'u', 'u.id = ap."userId"')
      .where('b.channel = :channel', { channel })
      .andWhere('b.status IN (:...statuses)', {
        statuses: PAID_BOOKING_STATUSES,
      })
      .andWhere('b."deletedAt" IS NULL')
      .setParameters({
        fallbackId: channel,
        fallbackName: channel === 'CHARTER' ? 'فروش چارتر' : 'فروش آژانسی',
      })
      .groupBy('ap."userId"')
      .addGroupBy('u."fullName"')
      .orderBy('"totalIrr"', 'DESC');
    this.applyRange(qb, query);
    const raw = await qb.getRawMany<RawPartner>();
    const rows = raw.map((row) => {
      const total = BigInt(bigintString(row.totalIrr));
      const agencySales = BigInt(bigintString(row.agencySalesIrr));
      const agencyOutstanding = BigInt(bigintString(row.agencyOutstandingIrr));
      const outstanding =
        row.id === channel || agencySales === 0n
          ? 0n
          : (total * agencyOutstanding) / agencySales;
      const paid = total > outstanding ? total - outstanding : 0n;
      return {
        id: row.id,
        name: row.name,
        totalIrr: total.toString(),
        paidIrr: paid.toString(),
        outstandingIrr: outstanding.toString(),
        soldSeats: Number(row.soldSeats),
      };
    });
    return {
      kind: 'partners' as const,
      scope: query.scope,
      period: query.period,
      rows,
      summary: {
        totalIrr: rows
          .reduce((sum, row) => sum + BigInt(row.totalIrr), 0n)
          .toString(),
        paidIrr: rows
          .reduce((sum, row) => sum + BigInt(row.paidIrr), 0n)
          .toString(),
      },
    };
  }

  private async customerReport(query: FinanceReportQueryDto) {
    const qb = this.flightBaseQuery();
    this.applyRange(qb, query);
    const raw = await qb
      .orderBy('fi."departureAt"', 'DESC')
      .limit(200)
      .getRawMany<RawFlight>();
    const rows = raw.map((row) => this.toFlight(row));
    return {
      kind: 'customers' as const,
      scope: query.scope,
      period: query.period,
      rows,
      summary: {
        totalIrr: rows
          .reduce((sum, row) => sum + BigInt(row.totalIrr), 0n)
          .toString(),
        soldSeats: rows.reduce((sum, row) => sum + row.soldSeats, 0),
      },
    };
  }

  private flightBaseQuery() {
    return this.dataSource
      .createQueryBuilder()
      .select('fi.id', 'flightInstanceId')
      .addSelect('f."flightNo"', 'flightNo')
      .addSelect('fi."departureAt"', 'departureAt')
      .addSelect('r."originCode"', 'originCode')
      .addSelect('r."destCode"', 'destCode')
      .addSelect('oa."cityFa"', 'originCityFa')
      .addSelect('da."cityFa"', 'destCityFa')
      .addSelect('fi.capacity', 'capacity')
      .addSelect(
        `(SELECT COUNT(*) FROM passengers p INNER JOIN bookings b ON b.id = p."bookingId" WHERE b."flightInstanceId" = fi.id AND b.status IN ('PAID','TICKETED') AND b."deletedAt" IS NULL AND p."deletedAt" IS NULL AND p."occupiesSeat" = true)`,
        'soldSeats',
      )
      .addSelect(
        `(SELECT COALESCE(SUM(b."priceIrr" + b."taxIrr" + b."extrasIrr"), 0) FROM bookings b WHERE b."flightInstanceId" = fi.id AND b.status IN ('PAID','TICKETED') AND b."deletedAt" IS NULL)`,
        'totalIrr',
      )
      .addSelect(
        `(SELECT COUNT(DISTINCT b."agencyId") FROM bookings b WHERE b."flightInstanceId" = fi.id AND b.status IN ('PAID','TICKETED') AND b."agencyId" IS NOT NULL AND b."deletedAt" IS NULL)`,
        'agencyCount',
      )
      .addSelect(
        `(SELECT COUNT(*) FROM passengers p INNER JOIN bookings b ON b.id = p."bookingId" WHERE b."flightInstanceId" = fi.id AND b.status IN ('PAID','TICKETED') AND b.channel = 'AGENCY' AND b."deletedAt" IS NULL AND p."deletedAt" IS NULL AND p."occupiesSeat" = true)`,
        'agencySeats',
      )
      .from('flight_instances', 'fi')
      .innerJoin('flights', 'f', 'f.id = fi."flightId"')
      .innerJoin('routes', 'r', 'r.id = f."routeId"')
      .leftJoin('airports', 'oa', 'oa.code = r."originCode"')
      .leftJoin('airports', 'da', 'da.code = r."destCode"')
      .where('fi."departureAt" <= NOW()')
      .groupBy('fi.id')
      .addGroupBy('f."flightNo"')
      .addGroupBy('r."originCode"')
      .addGroupBy('r."destCode"')
      .addGroupBy('oa."cityFa"')
      .addGroupBy('da."cityFa"');
  }

  private toFlight(row: RawFlight) {
    return {
      flightInstanceId: row.flightInstanceId,
      flightNo: row.flightNo,
      departureAt: new Date(row.departureAt).toISOString(),
      originCode: row.originCode,
      destCode: row.destCode,
      originCityFa: row.originCityFa ?? row.originCode,
      destCityFa: row.destCityFa ?? row.destCode,
      capacity: Number(row.capacity),
      soldSeats: Number(row.soldSeats),
      unsoldSeats: Math.max(0, Number(row.capacity) - Number(row.soldSeats)),
      totalIrr: bigintString(row.totalIrr),
      agencyCount: Number(row.agencyCount),
      agencySeats: Number(row.agencySeats),
    };
  }

  async searchFlights(query: FinanceFlightSearchQueryDto) {
    const qb = this.flightBaseQuery();
    if (query.q?.trim()) {
      qb.andWhere(
        `(f."flightNo" ILIKE :q OR r."originCode" ILIKE :q OR r."destCode" ILIKE :q OR oa."cityFa" ILIKE :q OR da."cityFa" ILIKE :q)`,
        { q: `%${query.q.trim()}%` },
      );
    }
    if (query.from && query.to) {
      qb.andWhere('fi."departureAt" >= :from AND fi."departureAt" < :to', {
        from: query.from,
        to: query.to,
      });
    }
    const rows = await qb
      .orderBy('fi."departureAt"', 'DESC')
      .limit(60)
      .getRawMany<RawFlight>();
    return { rows: rows.map((row) => this.toFlight(row)) };
  }

  async flightDetail(flightInstanceId: string) {
    const summaryRaw = await this.flightBaseQuery()
      .andWhere('fi.id = :flightInstanceId', { flightInstanceId })
      .getRawOne<RawFlight>();
    if (!summaryRaw) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'پرواز یافت نشد.',
      });
    }
    const agencies = await this.dataSource
      .createQueryBuilder()
      .select('ap."userId"', 'agencyId')
      .addSelect('u."fullName"', 'agencyName')
      .addSelect(
        'COALESCE(SUM((SELECT COUNT(*) FROM passengers p WHERE p."bookingId" = b.id AND p."deletedAt" IS NULL AND p."occupiesSeat" = true)), 0)',
        'soldSeats',
      )
      .addSelect(
        'COALESCE(SUM(b."priceIrr" + b."taxIrr" + b."extrasIrr"), 0)',
        'salesIrr',
      )
      .addSelect(
        `COALESCE((SELECT GREATEST(SUM(le."signedAmountIrr"), 0) FROM ledger_entries le WHERE le."agencyId" = ap."userId" AND le.type IN ('SALE','SETTLEMENT')), 0)`,
        'agencyOutstandingIrr',
      )
      .addSelect(
        `COALESCE((SELECT SUM(ABS(le."signedAmountIrr")) FROM ledger_entries le WHERE le."agencyId" = ap."userId" AND le.type = 'SALE'), 0)`,
        'agencySalesIrr',
      )
      .from('bookings', 'b')
      .innerJoin('agency_profiles', 'ap', 'ap."userId" = b."agencyId"')
      .innerJoin('users', 'u', 'u.id = ap."userId"')
      .where('b."flightInstanceId" = :flightInstanceId', { flightInstanceId })
      .andWhere('b.status IN (:...statuses)', {
        statuses: PAID_BOOKING_STATUSES,
      })
      .groupBy('ap."userId"')
      .addGroupBy('u."fullName"')
      .orderBy('"salesIrr"', 'DESC')
      .getRawMany<{
        agencyId: string;
        agencyName: string;
        soldSeats: string;
        salesIrr: string;
        agencyOutstandingIrr: string;
        agencySalesIrr: string;
      }>();
    return {
      summary: this.toFlight(summaryRaw),
      agencies: agencies.map((row) => {
        const sales = BigInt(bigintString(row.salesIrr));
        const agencySales = BigInt(bigintString(row.agencySalesIrr));
        const agencyOutstanding = BigInt(
          bigintString(row.agencyOutstandingIrr),
        );
        const outstanding =
          agencySales === 0n ? 0n : (sales * agencyOutstanding) / agencySales;
        const paid = sales > outstanding ? sales - outstanding : 0n;
        return {
          ...row,
          soldSeats: Number(row.soldSeats),
          salesIrr: sales.toString(),
          paidIrr: paid.toString(),
          outstandingIrr: outstanding.toString(),
        };
      }),
    };
  }

  async export(query: FinanceReportQueryDto, format: FinanceExportFormat) {
    const result = await this.report(query);
    const partner = result.kind === 'partners';
    const headers = partner
      ? [
          'نام',
          'فروش کل (ریال)',
          'پرداخت‌شده (ریال)',
          'مانده (ریال)',
          'صندلی فروخته‌شده',
        ]
      : [
          'شماره پرواز',
          'تاریخ',
          'مسیر',
          'فروش (ریال)',
          'صندلی فروخته‌شده',
          'صندلی فروش‌نرفته',
        ];
    const rows = partner
      ? result.rows.map((row) => [
          row.name,
          row.totalIrr,
          row.paidIrr,
          row.outstandingIrr,
          row.soldSeats,
        ])
      : result.rows.map((row) => [
          row.flightNo,
          row.departureAt,
          `${row.originCode}-${row.destCode}`,
          row.totalIrr,
          row.soldSeats,
          row.unsoldSeats,
        ]);
    if (format === FinanceExportFormat.CSV) {
      return {
        body: `\ufeff${[headers, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\r\n')}`,
        contentType: 'text/csv; charset=utf-8',
        extension: 'csv',
      };
    }
    const xmlRows = [headers, ...rows]
      .map(
        (row) =>
          `<Row>${row.map((cell) => `<Cell><Data ss:Type="String">${escapeXml(cell)}</Data></Cell>`).join('')}</Row>`,
      )
      .join('');
    return {
      body: `<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Finance"><Table>${xmlRows}</Table></Worksheet></Workbook>`,
      contentType: 'application/vnd.ms-excel; charset=utf-8',
      extension: 'xls',
    };
  }
}
