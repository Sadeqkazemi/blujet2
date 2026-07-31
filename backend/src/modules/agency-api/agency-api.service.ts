import { Injectable } from '@nestjs/common';
import { AgencyBookingService } from '../agencies/agency-booking.service';
import { SearchService } from '../booking-engine/search.service';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import type {
  CreateAgencyBookingDto,
  IssueAgencyBookingDto,
} from '../agencies/dto/create-agency-booking.dto';
import type { AgencyApiRequestContext } from './agency-api-key.guard';

@Injectable()
export class AgencyApiService {
  constructor(
    private readonly search: SearchService,
    private readonly agencyBookings: AgencyBookingService,
  ) {}

  async searchFlights(
    _ctx: AgencyApiRequestContext,
    origin: string,
    dest: string,
    date: string,
  ) {
    return this.search.search(origin, dest, date);
  }

  async seatMap(flightInstanceId: string) {
    return this.search.seatMap(flightInstanceId);
  }

  async createBooking(
    actor: AuthenticatedUser,
    dto: CreateAgencyBookingDto,
    idempotencyKey?: string,
  ) {
    return this.agencyBookings.createBooking(actor, dto, idempotencyKey);
  }

  async getBooking(actor: AuthenticatedUser, bookingId: string) {
    return this.agencyBookings.getById(actor, bookingId);
  }

  async issueBooking(
    actor: AuthenticatedUser,
    bookingId: string,
    dto: IssueAgencyBookingDto,
  ) {
    return this.agencyBookings.issue(actor, bookingId, {
      confirmedPriceIrr: dto.confirmedPriceIrr,
    });
  }
}
