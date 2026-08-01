import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Matches } from 'class-validator';
import { toLatinDigits } from '../../common/normalize-iran-phone';

export class CustomerPasswordLoginDto {
  @ApiProperty({ example: '09121234567', description: 'شماره موبایل مشتری' })
  @Transform(({ value }) =>
    typeof value === 'string' ? toLatinDigits(value).replace(/\s/g, '') : value,
  )
  @Matches(/^09\d{9}$/, { message: 'شماره موبایل معتبر نیست.' })
  phone: string;

  @ApiProperty({ description: 'رمز عبور حساب' })
  @IsString()
  password: string;
}
