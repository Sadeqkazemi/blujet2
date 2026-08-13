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
});
