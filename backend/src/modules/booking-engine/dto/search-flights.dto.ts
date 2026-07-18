import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsString, Length } from 'class-validator';

export class SearchFlightsDto {
  @ApiProperty({ example: 'THR' })
  @IsString()
  @Length(3, 3)
  origin: string;

  @ApiProperty({ example: 'MHD' })
  @IsString()
  @Length(3, 3)
  dest: string;

  @ApiProperty({ example: '2026-08-01' })
  @IsDateString()
  date: string;
}
