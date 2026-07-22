import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

const LOCK_CLASSIFICATIONS = ['FREE', 'DISCOUNTED', 'PAYABLE'] as const;

export class LockSeatDto {
  @ApiProperty({ example: '12D' })
  @IsString()
  @MinLength(2)
  seatCode: string;

  @ApiProperty({ description: 'دلیل درخواست لاک مدیریتی' })
  @IsString()
  @MinLength(3)
  reason: string;

  @ApiProperty({ enum: LOCK_CLASSIFICATIONS })
  @IsIn(LOCK_CLASSIFICATIONS)
  classification: (typeof LOCK_CLASSIFICATIONS)[number];

  @ApiPropertyOptional({
    description: 'فقط وقتی classification برابر DISCOUNTED است',
  })
  @ValidateIf((o: LockSeatDto) => o.classification === 'DISCOUNTED')
  @IsInt()
  @Min(1)
  @Max(100)
  discountPct?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  passengerName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  passengerNationalId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  passengerMobile?: string;
}

export class RejectLockDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  rejectionReason: string;
}

export class FinalizeLockDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  passengerName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  passengerNationalId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  passengerMobile?: string;
}

export class ChangeSeatDto {
  @ApiProperty({ example: '14A' })
  @IsString()
  @MinLength(2)
  seatCode: string;
}

export class SearchFlightsQueryDto {
  @ApiProperty({ example: 'تهران' })
  @IsString()
  origin: string;

  @ApiProperty({ example: 'دبی' })
  @IsString()
  dest: string;

  @ApiProperty({ description: 'ISO date' })
  @IsISO8601()
  date: string;
}

export class IssuePnrDto {
  @ApiProperty()
  @IsString()
  flightInstanceId: string;

  @ApiProperty({ example: '12D' })
  @IsString()
  @MinLength(2)
  seatCode: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  passengerName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  passengerNationalId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  passengerMobile?: string;
}

export class ListPnrQueryDto {
  @ApiPropertyOptional({ description: 'جستجو در کد PNR یا نام مسافر' })
  @IsOptional()
  @IsString()
  q?: string;
}
