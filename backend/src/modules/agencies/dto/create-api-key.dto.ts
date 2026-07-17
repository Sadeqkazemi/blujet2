import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

const SCOPES = ['FULL', 'SEARCH_BOOK', 'SEARCH_ONLY'] as const;

export class CreateApiKeyDto {
  @ApiProperty({ enum: SCOPES, example: 'SEARCH_BOOK' })
  @IsIn(SCOPES)
  scope: (typeof SCOPES)[number];
}
