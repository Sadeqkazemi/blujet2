import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsIn, ValidateNested } from 'class-validator';
import { BookingPassengerDto } from '../../booking-engine/dto/create-booking.dto';

export class CreateAllotmentBookingDto {
  @ApiProperty({ enum: ['ECONOMY', 'COMFORT', 'BUSINESS'] })
  @IsIn(['ECONOMY', 'COMFORT', 'BUSINESS'])
  cabin: 'ECONOMY' | 'COMFORT' | 'BUSINESS';

  @ApiProperty({ type: [BookingPassengerDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BookingPassengerDto)
  passengers: BookingPassengerDto[];
}
