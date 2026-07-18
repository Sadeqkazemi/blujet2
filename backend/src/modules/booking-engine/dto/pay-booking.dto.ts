import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional } from 'class-validator';

export class PayBookingDto {
  @ApiProperty({
    required: false,
    description:
      'Client-confirmed price from the checkout screen. Required to complete payment when the price changed since booking creation (re-price guard) — CLAUDE.md: "if the price changed, show the new price and require explicit user confirmation before charging."',
  })
  @IsOptional()
  @IsInt()
  confirmedPriceIrr?: number;
}
