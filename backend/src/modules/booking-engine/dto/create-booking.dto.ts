import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { CabinClass } from '../../../database/enums';

const CABIN_CLASSES = Object.values(CabinClass);

export class BookingPassengerDto {
  @ApiProperty({ example: 'علی رضایی' })
  @IsString()
  fullName: string;

  @ApiProperty({ example: '0012345678', required: false })
  @IsOptional()
  @IsString()
  nationalId?: string;

  @ApiProperty({ example: '09121234567', required: false })
  @IsOptional()
  @IsString()
  mobile?: string;

  @ApiProperty({ example: '4A', description: 'صندلی انتخابی این مسافر' })
  @IsString()
  seatCode: string;
}

export class BookingExtraSelectionDto {
  @ApiProperty({ description: 'شناسه هزینه سفر فعال از کاتالوگ عمومی' })
  @IsUUID()
  id!: string;

  @ApiProperty({ default: 1, description: 'برای بار اضافه: تعداد کیلوگرم' })
  @IsInt()
  @Min(1)
  @Max(50)
  quantity!: number;
}

export class CreateBookingDto {
  @ApiProperty()
  @IsString()
  flightInstanceId: string;

  @ApiProperty({ enum: CABIN_CLASSES })
  @IsIn(CABIN_CLASSES)
  cabin: CabinClass;

  @ApiProperty({ type: [BookingPassengerDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BookingPassengerDto)
  passengers: BookingPassengerDto[];

  @ApiProperty({ required: false, type: [BookingExtraSelectionDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => BookingExtraSelectionDto)
  extras?: BookingExtraSelectionDto[];
}
