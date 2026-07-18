import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class SubmitRefundDto {
  @ApiProperty()
  @IsString()
  bookingId: string;

  @ApiProperty({
    example: 'IR820170000000332211009900',
    description: '۲۴ رقم شبا',
  })
  @IsString()
  @Length(26, 26)
  iban: string;
}
