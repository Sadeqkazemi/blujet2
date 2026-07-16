import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class CreateMessageDto {
  @ApiProperty({ example: 'سلام، لطفاً فاکتور را تسویه بفرمایید.' })
  @IsString()
  @MinLength(1)
  body: string;
}
