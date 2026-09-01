import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CheckInCouponDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d{1,3}[A-Z]{1,3}$/)
  seatCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(12)
  gate?: string;
}

export class AcceptBaggageDto {
  @IsInt()
  @Min(1)
  @Max(100_000)
  weightGrams!: number;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Z0-9-]{6,24}$/)
  tagNo?: string;
}

export class BoardCouponDto {
  @IsOptional()
  @IsString()
  @MaxLength(12)
  gate?: string;
}
