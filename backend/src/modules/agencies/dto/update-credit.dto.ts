import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class UpdateCreditDto {
  @ApiProperty({ example: 1_800_000_000, description: 'سقف اعتبار به ریال' })
  @IsInt()
  @Min(0)
  limitIrr: number;
}
