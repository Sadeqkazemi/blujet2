import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class TopupWalletDto {
  @ApiProperty({ example: 5_000_000 })
  @IsInt()
  @Min(10_000)
  amountIrr: number;
}
