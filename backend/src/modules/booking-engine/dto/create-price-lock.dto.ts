import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString } from 'class-validator';

export class CreatePriceLockDto {
  @ApiProperty()
  @IsString()
  flightInstanceId: string;

  @ApiProperty({ enum: ['ECONOMY', 'BUSINESS'] })
  @IsIn(['ECONOMY', 'BUSINESS'])
  cabin: 'ECONOMY' | 'BUSINESS';
}
