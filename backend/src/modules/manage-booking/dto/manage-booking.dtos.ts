import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, MinLength } from 'class-validator';

export class LookupBookingDto {
  @ApiProperty({ example: 'BJ4X2K', description: 'کد رزرو (PNR)' })
  @IsString()
  @MinLength(4)
  pnr: string;

  @ApiProperty({ example: 'رضایی', description: 'نام خانوادگی مسافر' })
  @IsString()
  @MinLength(1)
  lastName: string;
}

export class SubmitAnonymousRefundDto {
  @ApiProperty({ example: 'BJ4X2K', description: 'کد رزرو (PNR)' })
  @IsString()
  @MinLength(4)
  pnr: string;

  @ApiProperty({ example: 'رضایی', description: 'نام خانوادگی مسافر' })
  @IsString()
  @MinLength(1)
  lastName: string;

  @ApiProperty({
    example: 'IR820170000000332211009900',
    description: '۲۶ کاراکتر شبا',
  })
  @IsString()
  @Length(26, 26)
  iban: string;
}
