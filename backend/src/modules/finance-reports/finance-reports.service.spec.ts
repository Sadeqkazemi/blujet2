import { BadRequestException } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import { FinanceReportsService } from './finance-reports.service';
import {
  FinanceExportFormat,
  FinanceReportPeriod,
  FinanceReportScope,
} from './dto/finance-report-query.dto';

describe('FinanceReportsService', () => {
  it('builds CSV from the exact filtered real report result', async () => {
    const service = new FinanceReportsService({} as DataSource);
    jest.spyOn(service, 'report').mockResolvedValue({
      kind: 'partners',
      scope: FinanceReportScope.AGENCIES,
      period: FinanceReportPeriod.MONTH,
      rows: [
        {
          id: 'a1',
          name: 'آژانس سپهر',
          totalIrr: '3100000000',
          paidIrr: '2800000000',
          outstandingIrr: '300000000',
          soldSeats: 12,
        },
      ],
      summary: { totalIrr: '3100000000', paidIrr: '2800000000' },
    });

    const file = await service.export(
      { scope: FinanceReportScope.AGENCIES, period: FinanceReportPeriod.MONTH },
      FinanceExportFormat.CSV,
    );

    expect(file.contentType).toContain('text/csv');
    expect(file.body).toContain('آژانس سپهر');
    expect(file.body).toContain('3100000000,2800000000,300000000,12');
  });

  it('rejects a half-specified date range', async () => {
    const service = new FinanceReportsService({} as DataSource);
    try {
      await service.report({
        scope: FinanceReportScope.CUSTOMERS,
        period: FinanceReportPeriod.DAY,
        from: '2026-08-13T00:00:00.000Z',
      });
      throw new Error('Expected report() to reject.');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      const response = (error as BadRequestException).getResponse() as {
        code: string;
      };
      expect(response.code).toBe('VALIDATION_FAILED');
    }
  });

  it('builds a real PDF file signature for the filtered summary', async () => {
    const service = new FinanceReportsService({} as DataSource);
    jest.spyOn(service, 'report').mockResolvedValue({
      kind: 'partners',
      scope: FinanceReportScope.AGENCIES,
      period: FinanceReportPeriod.MONTH,
      rows: [],
      summary: { totalIrr: '0', paidIrr: '0' },
    });

    const file = await service.export(
      { scope: FinanceReportScope.AGENCIES, period: FinanceReportPeriod.MONTH },
      FinanceExportFormat.PDF,
    );

    expect(file.contentType).toBe('application/pdf');
    expect(Buffer.isBuffer(file.body)).toBe(true);
    expect((file.body as Buffer).subarray(0, 5).toString('ascii')).toBe(
      '%PDF-',
    );
  });

  it('applies detailed booking, route, cabin and channel filters server-side', async () => {
    const qb: Record<string, jest.Mock> = {};
    for (const method of [
      'select',
      'addSelect',
      'from',
      'innerJoin',
      'leftJoin',
      'where',
      'andWhere',
      'orderBy',
      'limit',
    ]) {
      qb[method] = jest.fn().mockReturnValue(qb);
    }
    qb.getRawMany = jest.fn().mockResolvedValue([]);
    const service = new FinanceReportsService({
      createQueryBuilder: jest.fn().mockReturnValue(qb),
    } as unknown as DataSource);

    await service.salesReport({
      bookedFrom: '2026-08-01T00:00:00.000Z',
      bookedTo: '2026-09-01T00:00:00.000Z',
      bookingStatus: 'TICKETED',
      originCode: 'thr',
      destCode: 'mhd',
      cabin: 'BUSINESS',
      channel: 'AGENCY',
    });

    expect(qb.andWhere).toHaveBeenCalledWith('b.status = :bookingStatus', {
      bookingStatus: 'TICKETED',
    });
    expect(qb.andWhere).toHaveBeenCalledWith(
      'UPPER(r."originCode") = :originCode',
      { originCode: 'THR' },
    );
    expect(qb.andWhere).toHaveBeenCalledWith('b.cabin = :cabin', {
      cabin: 'BUSINESS',
    });
    expect(qb.andWhere).toHaveBeenCalledWith('b.channel = :channel', {
      channel: 'AGENCY',
    });
  });

  it('exports the same detailed result as CSV and Excel', async () => {
    const service = new FinanceReportsService({} as DataSource);
    jest.spyOn(service, 'salesReport').mockResolvedValue({
      rows: [
        {
          bookingId: 'b1',
          pnr: 'BJTEST',
          bookedAt: '2026-08-01T00:00:00.000Z',
          bookingStatus: 'TICKETED',
          paymentStatus: 'PAID',
          channel: 'SYSTEM',
          flightInstanceId: 'fi1',
          flightNo: 'XY123',
          originCode: 'THR',
          destCode: 'MHD',
          departureAt: '2026-08-02T08:00:00.000Z',
          arrivalAt: '2026-08-02T09:00:00.000Z',
          cabin: 'ECONOMY',
          fareClassCode: 'Y',
          passengerCount: 1,
          baseFareIrr: '100',
          taxIrr: '10',
          extrasIrr: '5',
          totalIrr: '115',
          agencyId: null,
          agencyName: null,
        },
      ],
      summary: {
        orderCount: 1,
        passengerCount: 1,
        grossIrr: '115',
        netRevenueIrr: '115',
        averageOrderIrr: '115',
      },
    });

    const csv = await service.salesExport({}, FinanceExportFormat.CSV);
    const excel = await service.salesExport({}, FinanceExportFormat.EXCEL);

    expect(csv.body).toContain('BJTEST');
    expect(csv.body).toContain('ECONOMY,Y');
    expect(excel.contentType).toContain('application/vnd.ms-excel');
    expect(excel.body).toContain('BJTEST');
  });
});
