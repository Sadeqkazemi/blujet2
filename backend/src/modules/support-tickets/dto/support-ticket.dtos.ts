import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, IsUUID, MinLength } from 'class-validator';

export class SubmitSupportTicketDto {
  @ApiProperty({ example: 'نگار رضایی', description: 'نام و نام خانوادگی' })
  @IsString()
  @MinLength(2)
  requesterName: string;

  @ApiProperty({ example: '09121234567', description: 'شماره تماس' })
  @IsString()
  @MinLength(8)
  requesterPhone: string;

  @ApiProperty({ example: 'مشکل در پرداخت', description: 'موضوع تیکت' })
  @IsString()
  @MinLength(2)
  subject: string;

  @ApiProperty({ example: 'توضیح مشکل...', description: 'متن تیکت' })
  @IsString()
  @MinLength(2)
  body: string;
}

export class ForwardTicketDto {
  @ApiProperty({ description: 'شناسه کارمند/مدیر مقصد ارجاع' })
  @IsUUID()
  targetUserId: string;
}

export class UpdateTicketStatusDto {
  @ApiProperty({ enum: ['OPEN', 'IN_PROGRESS', 'ANSWERED', 'CLOSED'] })
  @IsIn(['OPEN', 'IN_PROGRESS', 'ANSWERED', 'CLOSED'])
  status: 'OPEN' | 'IN_PROGRESS' | 'ANSWERED' | 'CLOSED';
}
