import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import {
  IsIrrAmount,
  MinIrrAmount,
  TransformToIrr,
} from '../../../common/dto/irr.decorator';
import type { Irr } from '../../../common/money';

export class PostInboxMessageDto {
  @ApiProperty({ example: 'سلام، فردا تسویه انجام می‌شود.' })
  @IsString()
  @MinLength(1)
  body: string;
}

export class RequestCreditIncreaseDto {
  @ApiProperty({
    example: '2000000000',
    type: String,
    description: 'سقف اعتبار درخواستی به ریال (رشته یا عدد صحیح)',
  })
  @IsIrrAmount()
  @MinIrrAmount(1n)
  @TransformToIrr()
  requestedLimitIrr: Irr;

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

const WEBSERVICE_SCOPES = ['FULL', 'SEARCH_BOOK'] as const;
const WEBSERVICE_MONTHS = [1, 3, 12] as const;

export class RequestWebserviceDto {
  @ApiProperty({
    enum: WEBSERVICE_SCOPES,
    example: 'SEARCH_BOOK',
    description: 'جستجو و رزرو یا فروش کامل (صدور بلیط)',
  })
  @IsIn(WEBSERVICE_SCOPES)
  scope: (typeof WEBSERVICE_SCOPES)[number];

  @ApiProperty({
    enum: WEBSERVICE_MONTHS,
    example: 1,
    description: 'مدت اشتراک به ماه',
  })
  @IsIn(WEBSERVICE_MONTHS)
  months: (typeof WEBSERVICE_MONTHS)[number];

  @ApiPropertyOptional({ example: 'برای اتصال سیستم رزرواسیون داخلی' })
  @IsOptional()
  @IsString()
  note?: string;
}
