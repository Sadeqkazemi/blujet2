import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateLoanApplicationDto {
  @ApiProperty({ example: '500000000', description: 'IRR integer string' })
  @Matches(/^\d+$/)
  requestedAmountIrr!: string;

  @ApiProperty({ example: 'loan-idem-user-1' })
  @IsString()
  @MinLength(8)
  idempotencyKey!: string;
}

export class ListLoansQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}
