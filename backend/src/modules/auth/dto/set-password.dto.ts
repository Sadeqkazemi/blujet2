import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class SetPasswordDto {
  @ApiProperty({ description: 'رمز عبور جدید — حداقل ۸ کاراکتر', minLength: 8 })
  @IsString()
  @MinLength(8)
  newPassword: string;
}
