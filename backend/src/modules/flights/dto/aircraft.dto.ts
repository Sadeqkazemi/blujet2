import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { AircraftStatus } from '../../../database/enums';

const AIRCRAFT_STATUSES = Object.values(AircraftStatus);

/** Create/update payload — same row/column band shape as the legacy
 * AircraftSeatMap (see seat-layout.ts's AircraftSeatMapLike), so the
 * service can derive AircraftCabin/AircraftSeat rows AND keep a matching
 * AircraftSeatMap row in sync in one step, without inventing a second,
 * incompatible way to describe a seat layout. */
export class UpsertAircraftDto {
  @ApiProperty({ example: 'A320', description: 'کد یکتای هواپیما' })
  @IsString()
  code!: string;

  @ApiProperty({ example: 'Airbus A320-200' })
  @IsString()
  model!: string;

  @ApiProperty({ example: 'ایرباس A320' })
  @IsString()
  title!: string;

  @ApiPropertyOptional({ enum: AIRCRAFT_STATUSES })
  @IsOptional()
  @IsIn(AIRCRAFT_STATUSES)
  status?: AircraftStatus;

  @ApiProperty({ example: 180 })
  @IsInt()
  @Min(1)
  @Max(1000)
  totalCapacity!: number;

  @ApiProperty({ example: 3 })
  @IsInt()
  @Min(1)
  businessRowStart!: number;

  @ApiProperty({ example: 6 })
  @IsInt()
  @Min(1)
  businessRowEnd!: number;

  @ApiPropertyOptional({ type: [String], example: ['A', 'B'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  businessColsLeft?: string[];

  @ApiPropertyOptional({ type: [String], example: ['C', 'D'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  businessColsRight?: string[];

  @ApiPropertyOptional({ example: 7 })
  @IsOptional()
  @IsInt()
  @Min(1)
  comfortRowStart?: number;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  comfortRowEnd?: number;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  comfortColsLeft?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  comfortColsRight?: string[];

  @ApiPropertyOptional({ example: 1, description: 'ردیف شروع درجه یک' })
  @IsOptional()
  @IsInt()
  @Min(1)
  firstRowStart?: number;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsInt()
  @Min(1)
  firstRowEnd?: number;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  firstColsLeft?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  firstColsRight?: string[];

  @ApiProperty({ example: 11 })
  @IsInt()
  @Min(1)
  economyRowStart!: number;

  @ApiProperty({ example: 32 })
  @IsInt()
  @Min(1)
  economyRowEnd!: number;

  @ApiPropertyOptional({ type: [String], example: ['A', 'B'] })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  economyColsLeft?: string[];

  @ApiPropertyOptional({ type: [String], example: ['C', 'D', 'E'] })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  economyColsRight?: string[];

  @ApiPropertyOptional({
    type: [String],
    description: 'صندلی‌های غیرفعال/مسدود (مثلاً ردیف خروج اضطراری)',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  excludedSeatCodes?: string[];
}
