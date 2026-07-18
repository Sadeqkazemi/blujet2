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

export class CreateBookingDto {
  @ApiProperty()
  @IsString()
  flightInstanceId: string;

  @ApiProperty({ enum: ['ECONOMY', 'BUSINESS'] })
  @IsIn(['ECONOMY', 'BUSINESS'])
  cabin: 'ECONOMY' | 'BUSINESS';

  @ApiProperty({ type: [BookingPassengerDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BookingPassengerDto)
  passengers: BookingPassengerDto[];
}
