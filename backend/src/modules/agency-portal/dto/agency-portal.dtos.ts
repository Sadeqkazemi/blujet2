import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class PostInboxMessageDto {
  @ApiProperty({ example: 'سلام، فردا تسویه انجام می‌شود.' })
  @IsString()
  @MinLength(1)
  body: string;
}

export class RequestCreditIncreaseDto {
  @ApiProperty({
    example: 2_000_000_000,
    description: 'سقف اعتبار درخواستی به ریال',
  })
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  requestedLimitIrr: number;

  @ApiPropertyOptional({ example: 'رشد فروش فصل تابستان' })
  @IsOptional()
  @IsString()
  note?: string;
}

export class UploadDocumentDto {
  @ApiProperty({ enum: ['LICENSE', 'CONTRACT', 'OTHER'], example: 'LICENSE' })
  @IsIn(['LICENSE', 'CONTRACT', 'OTHER'])
  docType: 'LICENSE' | 'CONTRACT' | 'OTHER';
}

export class TestSetPasswordDto {
  @ApiProperty({ example: '+989120000002' })
  @IsString()
  phone: string;

  @ApiProperty({ example: 'E2ePass@123' })
  @IsString()
  @MinLength(6)
  password: string;
}
