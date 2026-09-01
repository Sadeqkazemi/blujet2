import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class RmsRecommendationDto {
  @ApiProperty({ enum: ['SYSTEM', 'AGENCY'] })
  @IsIn(['SYSTEM', 'AGENCY'])
  channel!: 'SYSTEM' | 'AGENCY';

  @ApiProperty({ required: false, description: 'نرخ مشاهده‌شده رقیب به ریال' })
  @IsOptional()
  @IsString()
  competitorPriceIrr?: string;
}
