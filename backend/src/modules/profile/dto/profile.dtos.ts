import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsOptional,
  IsString,
  Length,
  MinLength,
} from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'نگار رضایی' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  fullName?: string;

  @ApiPropertyOptional({ example: '0012345679' })
  @IsOptional()
  @IsString()
  nationalId?: string;

  @ApiPropertyOptional({ example: '1370-05-12' })
  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @ApiPropertyOptional({ example: 'A12345678' })
  @IsOptional()
  @IsString()
  @MinLength(4)
  passportNo?: string;
}

export class VerifyEmailDto {
  @ApiProperty({ description: 'از POST /my/profile/email/verify-request' })
  @IsString()
  challengeId: string;

  @ApiProperty({ example: '482913' })
  @IsString()
  @Length(6, 6)
  code: string;
}
