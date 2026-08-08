import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import {
  IsIrrAmount,
  MinIrrAmount,
  TransformToIrr,
} from '../../../common/dto/irr.decorator';
import type { Irr } from '../../../common/money';
import { CabinClass } from '../../../database/enums';

const CABIN_CLASSES = Object.values(CabinClass);

export class CreateCharterCommitmentDto {
  @ApiProperty({ enum: CABIN_CLASSES })
  @IsIn(CABIN_CLASSES)
  cabin!: CabinClass;

  @ApiProperty({ example: 20 })
  @IsInt()
  @Min(1)
  @Max(1000)
  seats!: number;

  @ApiProperty({ type: String, example: '500000000' })
  @IsIrrAmount()
  @MinIrrAmount(1n)
  @TransformToIrr()
  amountIrr!: Irr;

  @ApiPropertyOptional({ description: 'شروع بازه تعهد (UTC ISO)' })
  @IsOptional()
  @IsISO8601()
  periodStart?: string;

  @ApiPropertyOptional({ description: 'پایان بازه تعهد (UTC ISO)' })
  @IsOptional()
  @IsISO8601()
  periodEnd?: string;

  @ApiPropertyOptional({
    description: 'کلید idempotency برای جلوگیری از ثبت تکراری',
  })
  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}

export class CreateAgencySeatCommitmentDto extends CreateCharterCommitmentDto {
  @ApiProperty({ description: 'شناسه کاربری آژانس (AgencyProfile.userId)' })
  @IsString()
  agencyId!: string;
}
