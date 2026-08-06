import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class StaffLookupDto {
  @ApiProperty({ example: 'itadmin', description: 'Staff username' })
  @IsString()
  @MinLength(1)
  username: string;
}
