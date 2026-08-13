import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export enum FinanceReportScope {
  AGENCIES = 'AGENCIES',
  CHARTERS = 'CHARTERS',
  CUSTOMERS = 'CUSTOMERS',
}

export enum FinanceReportPeriod {
  FLIGHT = 'flight',
  DAY = 'day',
  MONTH = 'month',
  Q3 = 'q3',
  Q6 = 'q6',
  YEAR = 'year',
}

export enum FinanceExportFormat {
  CSV = 'csv',
  EXCEL = 'excel',
}

export class FinanceReportQueryDto {
  @ApiProperty({ enum: FinanceReportScope })
  @IsEnum(FinanceReportScope)
  scope!: FinanceReportScope;

  @ApiProperty({ enum: FinanceReportPeriod })
  @IsEnum(FinanceReportPeriod)
  period!: FinanceReportPeriod;

  @ApiPropertyOptional({
    description: 'Inclusive ISO-8601 start of the selected Jalali period',
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    description: 'Exclusive ISO-8601 end of the selected Jalali period',
  })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  flightInstanceId?: string;
}

export class FinanceReportExportQueryDto extends FinanceReportQueryDto {
  @ApiProperty({ enum: FinanceExportFormat })
  @IsEnum(FinanceExportFormat)
  format!: FinanceExportFormat;
}

export class FinanceFlightSearchQueryDto {
  @ApiPropertyOptional({ maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  q?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  to?: string;
}
