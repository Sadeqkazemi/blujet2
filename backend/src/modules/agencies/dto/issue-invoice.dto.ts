import { ApiProperty } from '@nestjs/swagger';
import { IsISO8601, IsInt, Min } from 'class-validator';

export class IssueInvoiceDto {
  @ApiProperty({ example: 800_000_000, description: 'مبلغ فاکتور به ریال' })
  @IsInt()
  @Min(1)
  amountIrr: number;

  @ApiProperty({ example: '2026-08-05T00:00:00.000Z' })
  @IsISO8601()
  dueAt: string;
}
