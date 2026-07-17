import { ApiProperty } from '@nestjs/swagger';
import { IsISO8601, IsInt, Max, Min } from 'class-validator';

export class IssueInvoiceDto {
  @ApiProperty({ example: 800_000_000, description: 'مبلغ فاکتور به ریال' })
  @IsInt()
  @Min(1)
  // Money columns are Int32 for now (PLAN.md pre-launch debt) — reject
  // out-of-range values with a 400 instead of letting Postgres 500.
  @Max(2_147_483_647)
  amountIrr: number;

  @ApiProperty({ example: '2026-08-05T00:00:00.000Z' })
  @IsISO8601()
  dueAt: string;
}
