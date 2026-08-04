import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { BookingPassengerDto } from './create-booking.dto';

export class ConnectionLegDto {
  @ApiProperty()
  @IsString()
  flightInstanceId: string;

  @ApiProperty({ type: [BookingPassengerDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BookingPassengerDto)
  passengers: BookingPassengerDto[];
}

export class CreateConnectionBookingDto {
  @ApiProperty({ enum: ['ECONOMY', 'BUSINESS'] })
  @IsIn(['ECONOMY', 'BUSINESS'])
  cabin: 'ECONOMY' | 'BUSINESS';

  @ApiProperty({
    type: [ConnectionLegDto],
    description: 'Exactly two legs for a 1-stop connection.',
  })
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(2)
  @ValidateNested({ each: true })
  @Type(() => ConnectionLegDto)
  legs: ConnectionLegDto[];
}

export class PayItineraryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  confirmedPriceIrr?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  promoCode?: string;

  @ApiProperty({ enum: ['GATEWAY', 'WALLET', 'POINTS'], required: false })
  @IsOptional()
  @IsIn(['GATEWAY', 'WALLET', 'POINTS'])
  paymentMethod?: 'GATEWAY' | 'WALLET' | 'POINTS';
}
