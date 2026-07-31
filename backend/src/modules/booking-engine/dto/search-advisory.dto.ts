import { ApiProperty } from '@nestjs/swagger';
import { IsISO8601, IsString, Length } from 'class-validator';

export class SearchAdvisoryDto {
  @ApiProperty({ example: 'THR' })
  @IsString()
  @Length(3, 3)
  origin!: string;

  @ApiProperty({ example: 'MHD' })
  @IsString()
  @Length(3, 3)
  dest!: string;

  @ApiProperty({ example: '2026-08-01' })
  @IsISO8601({ strict: true })
  date!: string;
}
