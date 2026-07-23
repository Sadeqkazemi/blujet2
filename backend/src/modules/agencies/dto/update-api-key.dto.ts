import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';

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

  @ApiPropertyOptional({
    description: 'فقط وقتی regenerate=true — از POST /auth/step-up/request',
  })
  @ValidateIf((o: UpdateApiKeyDto) => o.regenerate === true)
  @IsString()
  stepUpChallengeId?: string;

  @ApiPropertyOptional({ example: '482913' })
  @ValidateIf((o: UpdateApiKeyDto) => o.regenerate === true)
  @IsString()
  stepUpCode?: string;
}
