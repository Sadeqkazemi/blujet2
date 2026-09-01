import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { CabinClass } from '../../../database/enums';
import { BookingPassengerDto } from '../../booking-engine/dto/create-booking.dto';

const CABIN_CLASSES = Object.values(CabinClass);

export class PartnerFlightSearchDto {
  @ApiProperty({ example: 'THR' })
  @IsString()
  @Length(3, 3)
  origin: string;

  @ApiProperty({ example: 'MHD' })
  @IsString()
  @Length(3, 3)
  destination: string;

  @ApiProperty({ example: '2026-08-15' })
  @IsDateString()
  date: string;
}

export class PartnerBookDto {
  @ApiProperty({ description: 'شناسه سهمیه فعال متعلق به آژانس' })
  @IsString()
  allotmentId: string;

  @ApiProperty({ enum: CABIN_CLASSES })
  @IsIn(CABIN_CLASSES)
  cabin: CabinClass;

  @ApiProperty({ type: [BookingPassengerDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BookingPassengerDto)
  passengers: BookingPassengerDto[];
}

export class PartnerBookingReferenceDto {
  @ApiProperty({ description: 'شناسه رزرو یا PNR' })
  @IsString()
  bookingReference: string;
}

export class DistributionAirShoppingDto extends PartnerFlightSearchDto {
  @ApiProperty({ enum: CABIN_CLASSES, required: false })
  @IsOptional()
  @IsIn(CABIN_CLASSES)
  cabin?: CabinClass;

  @ApiProperty({ example: 1, minimum: 1, maximum: 9 })
  @IsInt()
  @Min(1)
  @Max(9)
  passengerCount!: number;
}

export class DistributionOfferPriceDto {
  @ApiProperty({ description: 'شناسه امضاشده پیشنهاد' })
  @IsString()
  offerId!: string;
}

export class DistributionOrderCreateDto extends PartnerBookDto {
  @ApiProperty({ description: 'شناسه امضاشده و معتبر پیشنهاد' })
  @IsString()
  offerId!: string;
}
