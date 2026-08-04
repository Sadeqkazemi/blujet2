import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString, Length } from 'class-validator';

export class PriceAdvisoryDto {
  @ApiProperty({ example: 'THR', description: 'کد IATA مبدأ' })
  @IsString()
  @Length(3, 3)
  origin: string;

  @ApiProperty({ example: 'MHD', description: 'کد IATA مقصد' })
  @IsString()
  @Length(3, 3)
  dest: string;

  @ApiProperty({ example: '2026-08-01', description: 'تاریخ پرواز (Gregorian ISO)' })
  @IsDateString()
  date: string;

  @ApiPropertyOptional({ enum: ['ECONOMY', 'BUSINESS'], default: 'ECONOMY' })
  @IsOptional()
  @IsEnum(['ECONOMY', 'BUSINESS'])
  cabin?: 'ECONOMY' | 'BUSINESS';
}
