import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsISO8601,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

const TIERS = ['SILVER', 'GOLD', 'PLATINUM'] as const;

export class ListMembersQueryDto {
  @ApiPropertyOptional({ enum: TIERS, description: 'فیلتر سطح عضویت' })
  @IsOptional()
  @IsIn(TIERS)
  level?: (typeof TIERS)[number];

  @ApiPropertyOptional({
    description: 'جستجو در نام، ایمیل، شماره کارت یا کد ملی (تطبیق دقیق)',
  })
  @IsOptional()
  @IsString()
  q?: string;
}

export class CreateMemberDto {
  @ApiProperty({ example: 'نگار رضایی' })
  @IsString()
  @MinLength(1)
  fullName: string;

  @ApiProperty({ example: 'negar@email.example' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({
    description: 'تاریخ تولد (ISO — از تقویم شمسی تبدیل می‌شود)',
  })
  @IsOptional()
  @IsISO8601()
  birthDate?: string;

  @ApiProperty({ description: 'کد ملی — با چک‌سام رسمی اعتبارسنجی می‌شود' })
  @IsString()
  nationalId: string;

  @ApiProperty({ enum: TIERS })
  @IsIn(TIERS)
  level: (typeof TIERS)[number];

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  points?: number;
}

export class UpdateLevelDto {
  @ApiProperty({ enum: TIERS })
  @IsIn(TIERS)
  level: (typeof TIERS)[number];
}
