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
  FinanceSalesQueryDto,
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

type RawSale = {
  bookingId: string;
  pnr: string;
  bookedAt: Date | string;
  bookingStatus: string;
  channel: string;
  flightInstanceId: string;
  flightNo: string;
  originCode: string;
  destCode: string;
  departureAt: Date | string;
  arrivalAt: Date | string;
  cabin: string;
  fareClassCode: string | null;
  passengerCount: string;
  baseFareIrr: string;
  taxIrr: string;
  extrasIrr: string;
  totalIrr: string;
  agencyId: string | null;
  agencyName: string | null;
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

function escapePdfText(value: string | number): string {
  return String(value)
    .replace(/[^\x20-\x7e]/g, '?')
    .replace(/([\\()])/g, '\\$1');
}

/** Dependency-free, standards-compliant one-page PDF used for summary exports.
 * Detailed Unicode data remains available in CSV/Excel; the final branded PDF
 * layout will replace this renderer when product supplies its template. */
function buildSummaryPdf(lines: (string | number)[]): Buffer {
  const commands = [
    'BT',
    '/F1 14 Tf',
    '50 790 Td',
    ...lines
      .flatMap((line, index) => [
        index === 0 ? '' : '0 -22 Td',
        `(${escapePdfText(line)}) Tj`,
      ])
      .filter(Boolean),
    'ET',
  ].join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(commands, 'ascii')} >>\nstream\n${commands}\nendstream`,
  ];
  let body = '%PDF-1.4\n';
  const offsets = [0];
  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(Buffer.byteLength(body, 'ascii'));
    body += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(body, 'ascii');
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  body += offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`)
    .join('');
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(body, 'ascii');
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

  private assertPairedRange(from?: string, to?: string, label = 'بازه') {
    if ((from && !to) || (!from && to)) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: `ابتدا و انتهای ${label} باید با هم ارسال شوند.`,
      });
    }
    if (from && to && new Date(from) >= new Date(to)) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: `انتهای ${label} باید بعد از ابتدای آن باشد.`,
      });
    }
  }

  private paymentStatusFor(bookingStatus: string) {
    if (bookingStatus === 'REFUNDED') return 'REFUNDED';
    if (['PAID', 'TICKETED', 'FLOWN', 'NO_SHOW'].includes(bookingStatus))
      return 'PAID';
    if (['CANCELLED', 'EXPIRED'].includes(bookingStatus)) return 'CANCELLED';
    return 'PENDING';
  }

  async salesReport(query: FinanceSalesQueryDto) {
    this.assertPairedRange(query.bookedFrom, query.bookedTo, 'تاریخ رزرو');
    this.assertPairedRange(query.flightFrom, query.flightTo, 'تاریخ پرواز');
    const qb = this.dataSource
      .createQueryBuilder()
      .select('b.id', 'bookingId')
      .addSelect('b.pnr', 'pnr')
      .addSelect('b."createdAt"', 'bookedAt')
      .addSelect('b.status', 'bookingStatus')
      .addSelect('b.channel', 'channel')
      .addSelect('fi.id', 'flightInstanceId')
      .addSelect('f."flightNo"', 'flightNo')
      .addSelect('r."originCode"', 'originCode')
      .addSelect('r."destCode"', 'destCode')
      .addSelect('fi."departureAt"', 'departureAt')
      .addSelect('fi."arrivalAt"', 'arrivalAt')
      .addSelect('b.cabin', 'cabin')
      .addSelect('b."fareClassCode"', 'fareClassCode')
      .addSelect(
        '(SELECT COUNT(*) FROM passengers p WHERE p."bookingId" = b.id AND p."deletedAt" IS NULL)',
        'passengerCount',
      )
      .addSelect('b."priceIrr"', 'baseFareIrr')
      .addSelect('b."taxIrr"', 'taxIrr')
      .addSelect('b."extrasIrr"', 'extrasIrr')
      .addSelect('(b."priceIrr" + b."taxIrr" + b."extrasIrr")', 'totalIrr')
      .addSelect('b."agencyId"', 'agencyId')
      .addSelect('u."fullName"', 'agencyName')
      .from('bookings', 'b')
      .innerJoin('flight_instances', 'fi', 'fi.id = b."flightInstanceId"')
      .innerJoin('flights', 'f', 'f.id = fi."flightId"')
      .innerJoin('routes', 'r', 'r.id = f."routeId"')
      .leftJoin('users', 'u', 'u.id = b."agencyId"')
      .where('b."deletedAt" IS NULL');

    if (query.bookedFrom && query.bookedTo) {
      qb.andWhere(
        'b."createdAt" >= :bookedFrom AND b."createdAt" < :bookedTo',
        {
          bookedFrom: query.bookedFrom,
          bookedTo: query.bookedTo,
        },
      );
    }
    if (query.flightFrom && query.flightTo) {
      qb.andWhere(
        'fi."departureAt" >= :flightFrom AND fi."departureAt" < :flightTo',
        {
          flightFrom: query.flightFrom,
          flightTo: query.flightTo,
        },
      );
    }
    if (query.bookingStatus)
      qb.andWhere('b.status = :bookingStatus', {
        bookingStatus: query.bookingStatus,
      });
    if (query.originCode)
      qb.andWhere('UPPER(r."originCode") = :originCode', {
        originCode: query.originCode.trim().toUpperCase(),
      });
    if (query.destCode)
      qb.andWhere('UPPER(r."destCode") = :destCode', {
        destCode: query.destCode.trim().toUpperCase(),
      });
    if (query.cabin) qb.andWhere('b.cabin = :cabin', { cabin: query.cabin });
    if (query.channel)
      qb.andWhere('b.channel = :channel', { channel: query.channel });
    if (query.agencyId)
      qb.andWhere('b."agencyId" = :agencyId', { agencyId: query.agencyId });
    if (query.paymentStatus) {
      const statusMap = {
        PAID: ['PAID', 'TICKETED', 'FLOWN', 'NO_SHOW'],
        REFUNDED: ['REFUNDED'],
        CANCELLED: ['CANCELLED', 'EXPIRED'],
        PENDING: ['DRAFT', 'HELD'],
      } as const;
      qb.andWhere('b.status IN (:...paymentBookingStatuses)', {
        paymentBookingStatuses: statusMap[query.paymentStatus],
      });
    }

    const raw = await qb
      .orderBy('b."createdAt"', 'DESC')
      .limit(query.limit ?? 250)
      .getRawMany<RawSale>();
    const rows = raw.map((row) => ({
      bookingId: row.bookingId,
      pnr: row.pnr,
      bookedAt: new Date(row.bookedAt).toISOString(),
      bookingStatus: row.bookingStatus,
      paymentStatus: this.paymentStatusFor(row.bookingStatus),
      channel: row.channel,
      flightInstanceId: row.flightInstanceId,
      flightNo: row.flightNo,
      originCode: row.originCode,
      destCode: row.destCode,
      departureAt: new Date(row.departureAt).toISOString(),
      arrivalAt: new Date(row.arrivalAt).toISOString(),
      cabin: row.cabin,
      fareClassCode: row.fareClassCode,
      passengerCount: Number(row.passengerCount),
      baseFareIrr: bigintString(row.baseFareIrr),
      taxIrr: bigintString(row.taxIrr),
      extrasIrr: bigintString(row.extrasIrr),
      totalIrr: bigintString(row.totalIrr),
      agencyId: row.agencyId,
      agencyName: row.agencyName,
    }));
    const grossIrr = rows.reduce((sum, row) => sum + BigInt(row.totalIrr), 0n);
    const paidRows = rows.filter((row) => row.paymentStatus === 'PAID');
    const netRevenueIrr = paidRows.reduce(
      (sum, row) => sum + BigInt(row.totalIrr),
      0n,
    );
    return {
      rows,
      summary: {
        orderCount: rows.length,
        passengerCount: rows.reduce((sum, row) => sum + row.passengerCount, 0),
        grossIrr: grossIrr.toString(),
        netRevenueIrr: netRevenueIrr.toString(),
        averageOrderIrr: rows.length
          ? (grossIrr / BigInt(rows.length)).toString()
          : '0',
      },
    };
  }

  async salesExport(query: FinanceSalesQueryDto, format: FinanceExportFormat) {
    const result = await this.salesReport({
      ...query,
      limit: query.limit ?? 1000,
    });
    const headers = [
      'Booking ID',
      'PNR',
      'Booked At',
      'Booking Status',
      'Payment Status',
      'Channel',
      'Flight',
      'Origin',
      'Destination',
      'Departure',
      'Arrival',
      'Cabin',
      'Fare Class',
      'Passengers',
      'Base Fare IRR',
      'Tax IRR',
      'Ancillary IRR',
      'Grand Total IRR',
      'Agency',
    ];
    const rows = result.rows.map((row) => [
      row.bookingId,
      row.pnr,
      row.bookedAt,
      row.bookingStatus,
      row.paymentStatus,
      row.channel,
      row.flightNo,
      row.originCode,
      row.destCode,
      row.departureAt,
      row.arrivalAt,
      row.cabin,
      row.fareClassCode ?? '',
      row.passengerCount,
      row.baseFareIrr,
      row.taxIrr,
      row.extrasIrr,
      row.totalIrr,
      row.agencyName ?? '',
    ]);
    if (format === FinanceExportFormat.PDF) {
      return {
        body: buildSummaryPdf([
          'Blujet Detailed Sales Summary',
          `Orders: ${result.summary.orderCount}`,
          `Passengers: ${result.summary.passengerCount}`,
          `Gross IRR: ${result.summary.grossIrr}`,
          `Net revenue IRR: ${result.summary.netRevenueIrr}`,
          `Average order IRR: ${result.summary.averageOrderIrr}`,
          `Generated: ${new Date().toISOString()}`,
        ]),
        contentType: 'application/pdf',
        extension: 'pdf',
      };
    }
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
      body: `<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Sales"><Table>${xmlRows}</Table></Worksheet></Workbook>`,
      contentType: 'application/vnd.ms-excel; charset=utf-8',
      extension: 'xls',
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
    if (format === FinanceExportFormat.PDF) {
      const total = result.summary.totalIrr;
      const secondary = partner
        ? `Paid IRR: ${result.summary.paidIrr}`
        : `Sold seats: ${result.summary.soldSeats}`;
      return {
        body: buildSummaryPdf([
          'Blujet Finance Report',
          `Scope: ${query.scope}`,
          `Period: ${query.period}`,
          `Rows: ${rows.length}`,
          `Total IRR: ${total}`,
          secondary,
          `Generated: ${new Date().toISOString()}`,
        ]),
        contentType: 'application/pdf',
        extension: 'pdf',
      };
    }
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
