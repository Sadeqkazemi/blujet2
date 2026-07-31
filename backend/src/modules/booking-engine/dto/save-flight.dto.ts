import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsUUID } from 'class-validator';

const CABINS = ['ECONOMY', 'BUSINESS'] as const;

export class SaveFlightDto {
  @ApiProperty({ example: '00000000-0000-0000-0000-000000000001' })
  @IsUUID()
  flightInstanceId: string;

  @ApiProperty({ enum: CABINS, example: 'ECONOMY' })
  @IsIn(CABINS)
  cabin: (typeof CABINS)[number];
}
