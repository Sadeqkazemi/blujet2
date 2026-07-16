import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional } from 'class-validator';

const STATUSES = ['ACTIVE', 'SUSPENDED'] as const;

export class UpdateApiKeyDto {
  @ApiPropertyOptional({ enum: STATUSES })
  @IsOptional()
  @IsIn(STATUSES)
  status?: (typeof STATUSES)[number];

  @ApiPropertyOptional({
    description: 'true برای صدور مجدد کلید — کلید قبلی بلافاصله باطل می‌شود',
  })
  @IsOptional()
  @IsBoolean()
  regenerate?: boolean;
}
