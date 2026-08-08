import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import {
  IsIrrAmount,
  MinIrrAmount,
  TransformToIrr,
} from '../../../common/dto/irr.decorator';
import type { Irr } from '../../../common/money';

export class UpsertProposalDto {
  @ApiProperty({
    example: '38500000',
    type: String,
    description: 'نرخ پیشنهادی به ریال',
  })
  @IsIrrAmount()
  @MinIrrAmount(1n, { message: 'نرخ پیشنهادی را وارد کنید' })
  @TransformToIrr()
  proposedPriceIrr: Irr;

  @ApiPropertyOptional({
    example: '42000000',
    type: String,
    description: 'نرخ قانونی/مصوب به ریال',
  })
  @IsOptional()
  @IsIrrAmount()
  @MinIrrAmount(1n)
  @TransformToIrr()
  legalRateIrr?: Irr;

  @ApiPropertyOptional({ description: 'یادداشت برای مدیر عامل (اختیاری)' })
  @IsOptional()
  @IsString()
  note?: string;
}

export class SetLegalRateDto {
  @ApiProperty({
    example: '42000000',
    type: String,
    description: 'نرخ قانونی (مصوب سازمان هواپیمایی) به ریال',
  })
  @IsIrrAmount()
  @MinIrrAmount(1n, { message: 'نرخ قانونی را وارد کنید' })
  @TransformToIrr()
  legalRateIrr: Irr;
}

export class RegisterProposalDto {
  @ApiProperty({
    enum: ['PROPOSED', 'AI'],
    description: 'منبع قیمت ثبتی: تأیید بازرگانی یا ثبت با AI',
  })
  @IsIn(['PROPOSED', 'AI'])
  source: 'PROPOSED' | 'AI';
}

export class RejectProposalDto {
  @ApiProperty({
    example: 'نرخ پیشنهادی با نرخ قانونی سازگار نیست',
    description: 'دلیل رد — اجباری، پس از trim خالی نباشد',
  })
  @IsString()
  rejectionReason: string;
}
