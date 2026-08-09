import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ScheduleTemplatePreviewDto {
  @ApiProperty({ example: 'uuid-origin-airport' })
  @IsString()
  @MinLength(1)
  originAirportId!: string;

  @ApiProperty({ example: 'uuid-dest-airport' })
  @IsString()
  @MinLength(1)
  destinationAirportId!: string;

  @ApiProperty({ example: 'BJ410' })
  @Matches(/^[A-Z0-9]{2,8}$/)
  flightNoBase!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  aircraftDefinitionId!: string;

  @ApiProperty({ example: '07:30', description: 'Local time at origin airport' })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  departureTime!: string;

  @ApiProperty({ example: 95 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(24 * 60)
  durationMinutes!: number;

  @ApiProperty({ example: '2026-09-01' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  startDate!: string;

  @ApiProperty({ example: '2026-09-30' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  endDate!: string;

  @ApiProperty({
    example: [1, 3, 5],
    description: 'ISO weekdays 1=Mon … 7=Sun',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(7)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(7, { each: true })
  weekdays!: number[];

  @ApiProperty({ example: '38000000', description: 'IRR integer string' })
  @Matches(/^\d+$/)
  agencyPriceIrr!: string;

  @ApiProperty({ example: '42000000', description: 'IRR integer string' })
  @Matches(/^\d+$/)
  legalCeilingIrr!: string;
}

export class CreateScheduleTemplateDto extends ScheduleTemplatePreviewDto {
  @ApiProperty({
    example: 'sched-idem-2026-09-thr-mhd-1',
    description: 'Client idempotency key (unique)',
  })
  @IsString()
  @MinLength(8)
  idempotencyKey!: string;
}

export class ListScheduleTemplatesQueryDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}
