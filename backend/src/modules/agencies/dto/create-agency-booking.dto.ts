import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { BookingPassengerDto } from '../../booking-engine/dto/create-booking.dto';

export class CreateAgencyBookingDto {
  @ApiProperty()
  @IsString()
  flightInstanceId: string;

  @ApiProperty({ enum: ['ECONOMY', 'BUSINESS'] })
  @IsIn(['ECONOMY', 'BUSINESS'])
  cabin: 'ECONOMY' | 'BUSINESS';

  @ApiProperty({
    required: false,
    description: 'سهمیه مشخص؛ در صورت عدم ارسال، اولین سهمیه فعال با ظرفیت کافی انتخاب می‌شود.',
  })
  @IsOptional()
  @IsString()
  allotmentId?: string;

  @ApiProperty({ type: [BookingPassengerDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BookingPassengerDto)
  passengers: BookingPassengerDto[];
}

export class IssueAgencyBookingDto {
  @ApiProperty({
    required: false,
    description: 'قیمت تأییدشده پس از re-price — الزامی وقتی قیمت تغییر کرده باشد.',
  })
  @IsOptional()
  confirmedPriceIrr?: number;
}
