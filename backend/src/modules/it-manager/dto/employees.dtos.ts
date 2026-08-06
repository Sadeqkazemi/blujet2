import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

const REFERRAL_SCOPES = ['MANAGERS_ONLY', 'ALL_STAFF'] as const;

export class ListEmployeesQueryDto {
  @ApiPropertyOptional({ description: 'فیلتر واحد سازمانی' })
  @IsOptional()
  @IsString()
  dept?: string;

  @ApiPropertyOptional({ description: 'جستجو در نام یا نام کاربری' })
  @IsOptional()
  @IsString()
  q?: string;
}

export class CreateEmployeeDto {
  @ApiProperty({ example: 'رضا کاظمی' })
  @IsString()
  @MinLength(1)
  fullName: string;

  @ApiProperty({ example: 'reza.kazemi' })
  @IsString()
  @MinLength(2)
  username: string;

  // Phase 68: omit to create the account passwordless — the owner
  // chooses their own password + registers their mobile via
  // «راه‌اندازی اولین ورود» on first login instead.
  @ApiPropertyOptional({ description: 'رمز عبور اولیه — حداقل ۶ کاراکتر' })
  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;

  @ApiProperty({
    example: 'commercial',
    description: 'واحد سازمانی — commercial|sales|finance|it یا نام سفارشی',
  })
  @IsString()
  dept: string;

  @ApiPropertyOptional({ example: 'کارشناس' })
  @IsOptional()
  @IsString()
  rank?: string;

  @ApiPropertyOptional({ enum: REFERRAL_SCOPES })
  @IsOptional()
  @IsIn(REFERRAL_SCOPES)
  referralScope?: (typeof REFERRAL_SCOPES)[number];

  @ApiPropertyOptional({ type: [String], example: ['ag_list', 'fl_view'] })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  permissionKeys?: string[];
}

export class SetEmployeeStatusDto {
  @ApiProperty({ example: false })
  @IsBoolean()
  isActive: boolean;
}

export class SetEmployeePermissionDto {
  @ApiProperty({ example: 'ag_list' })
  @IsString()
  permissionKey: string;

  @ApiProperty({ example: true })
  @IsBoolean()
  grant: boolean;
}
