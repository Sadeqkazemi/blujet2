import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

const INT32_MAX = 2_147_483_647;

export class UpsertProposalDto {
  @ApiProperty({ example: 38_500_000, description: 'نرخ پیشنهادی به ریال' })
  @IsInt()
  @Min(1, { message: 'نرخ پیشنهادی را وارد کنید' })
  @Max(INT32_MAX)
  proposedPriceIrr: number;

  @ApiPropertyOptional({
    example: 42_000_000,
    description: 'نرخ قانونی/مصوب به ریال',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(INT32_MAX)
  legalRateIrr?: number;

  @ApiPropertyOptional({ description: 'یادداشت برای مدیر عامل (اختیاری)' })
  @IsOptional()
  @IsString()
  note?: string;
}

export class SetLegalRateDto {
  @ApiProperty({
    example: 42_000_000,
    description: 'نرخ قانونی (مصوب سازمان هواپیمایی) به ریال',
  })
  @IsInt()
  @Min(1, { message: 'نرخ قانونی را وارد کنید' })
  @Max(INT32_MAX)
  legalRateIrr: number;
}

export class RegisterProposalDto {
  @ApiProperty({
    enum: ['PROPOSED', 'AI'],
    description: 'منبع قیمت ثبتی: تأیید بازرگانی یا ثبت با AI',
  })
  @IsIn(['PROPOSED', 'AI'])
  source: 'PROPOSED' | 'AI';
}
