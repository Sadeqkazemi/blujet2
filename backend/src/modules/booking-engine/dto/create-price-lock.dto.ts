import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString } from 'class-validator';

export class CreatePriceLockDto {
  @ApiProperty()
  @IsString()
  flightInstanceId: string;

  @ApiProperty({ enum: ['ECONOMY', 'COMFORT', 'BUSINESS'] })
  @IsIn(['ECONOMY', 'COMFORT', 'BUSINESS'])
  cabin: 'ECONOMY' | 'COMFORT' | 'BUSINESS';
}
