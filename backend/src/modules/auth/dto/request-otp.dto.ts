import { ApiProperty } from '@nestjs/swagger';
import { Matches } from 'class-validator';

export class RequestOtpDto {
  @ApiProperty({ example: '09121234567', description: 'شماره موبایل مشتری' })
  @Matches(/^09\d{9}$/, { message: 'شماره موبایل معتبر نیست.' })
  phone: string;
}
