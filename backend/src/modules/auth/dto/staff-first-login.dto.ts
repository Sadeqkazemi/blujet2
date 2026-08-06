import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Length, Matches, MinLength } from 'class-validator';
import { toLatinDigits } from '../../../common/normalize-iran-phone';
import { IsStrongPassword } from '../../../common/validators/strong-password.validator';

export class RequestStaffFirstLoginOtpDto {
  @ApiProperty({ example: 'itadmin', description: 'Staff username' })
  @IsString()
  @MinLength(1)
  username: string;

  @ApiProperty({ example: '09121234567', description: 'شماره موبایل' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? toLatinDigits(value).replace(/\s/g, '') : value,
  )
  @Matches(/^09\d{9}$/, { message: 'شماره موبایل معتبر نیست.' })
  mobile: string;
}

export class VerifyStaffFirstLoginOtpDto {
  @ApiProperty({ description: 'Challenge id returned by the otp/request call' })
  @IsString()
  challengeId: string;

  @ApiProperty({ example: '482913', description: '6-digit one-time code' })
  @IsString()
  @Length(6, 6)
  code: string;

  @ApiProperty({
    description:
      'رمز عبور جدید — حداقل ۸ کاراکتر با حروف بزرگ/کوچک، عدد و نماد',
    minLength: 8,
    example: 'Blujet@1404',
  })
  @IsString()
  @MinLength(8)
  @IsStrongPassword()
  newPassword: string;

  @ApiProperty({
    example: '09121234567',
    description: 'شماره موبایل (باید با درخواست OTP یکسان باشد)',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? toLatinDigits(value).replace(/\s/g, '') : value,
  )
  @Matches(/^09\d{9}$/, { message: 'شماره موبایل معتبر نیست.' })
  mobile: string;
}
