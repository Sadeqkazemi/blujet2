import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsOptional, IsString, MinLength } from 'class-validator';

export class LockSeatDto {
  @ApiProperty({ example: '12D' })
  @IsString()
  @MinLength(2)
  seatCode: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  passengerName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  passengerNationalId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  passengerMobile?: string;
}

export class ChangeSeatDto {
  @ApiProperty({ example: '14A' })
  @IsString()
  @MinLength(2)
  seatCode: string;
}

export class SearchFlightsQueryDto {
  @ApiProperty({ example: 'تهران' })
  @IsString()
  origin: string;

  @ApiProperty({ example: 'دبی' })
  @IsString()
  dest: string;

  @ApiProperty({ description: 'ISO date' })
  @IsISO8601()
  date: string;
}

export class IssuePnrDto {
  @ApiProperty()
  @IsString()
  flightInstanceId: string;

  @ApiProperty({ example: '12D' })
  @IsString()
  @MinLength(2)
  seatCode: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  passengerName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  passengerNationalId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  passengerMobile?: string;
}

export class ListPnrQueryDto {
  @ApiPropertyOptional({ description: 'جستجو در کد PNR یا نام مسافر' })
  @IsOptional()
  @IsString()
  q?: string;
}
