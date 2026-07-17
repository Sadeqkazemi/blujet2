import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';

export class UpdateCreditDto {
  @ApiProperty({ example: 1_800_000_000, description: 'سقف اعتبار به ریال' })
  @IsInt()
  @Min(0)
  // Money columns are Int32 for now (PLAN.md pre-launch debt) — reject
  // out-of-range values with a 400 instead of letting Postgres 500.
  @Max(2_147_483_647)
  limitIrr: number;
}
