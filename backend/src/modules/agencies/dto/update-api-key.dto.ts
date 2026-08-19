import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';

const STATUSES = ['ACTIVE', 'SUSPENDED', 'REVOKED'] as const;

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
    description:
      'وقتی regenerate=true یا status=REVOKED — از POST /auth/step-up/request',
  })
  @ValidateIf(
    (o: UpdateApiKeyDto) => o.regenerate === true || o.status === 'REVOKED',
  )
  @IsString()
  stepUpChallengeId?: string;

  @ApiPropertyOptional({ example: '482913' })
  @ValidateIf(
    (o: UpdateApiKeyDto) => o.regenerate === true || o.status === 'REVOKED',
  )
  @IsString()
  stepUpCode?: string;
}
