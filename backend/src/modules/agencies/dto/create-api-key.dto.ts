import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString } from 'class-validator';

const SCOPES = ['FULL', 'SEARCH_BOOK', 'SEARCH_ONLY'] as const;

export class CreateApiKeyDto {
  @ApiProperty({ enum: SCOPES, example: 'SEARCH_BOOK' })
  @IsIn(SCOPES)
  scope: (typeof SCOPES)[number];

  @ApiProperty({
    description: 'از POST /auth/step-up/request (scope: API_KEY_ROTATE)',
  })
  @IsString()
  stepUpChallengeId: string;

  @ApiProperty({ example: '482913' })
  @IsString()
  stepUpCode: string;
}
