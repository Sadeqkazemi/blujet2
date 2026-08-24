import { validate } from 'class-validator';
import { BookingPassengerDto } from './create-booking.dto';

function passenger(identity: Partial<BookingPassengerDto> = {}) {
  return Object.assign(new BookingPassengerDto(), {
    fullName: 'ALI REZAEI',
    passengerType: 'ADULT',
    birthDate: '1990-01-01',
    seatCode: '1A',
    ...identity,
  });
}

describe('BookingPassengerDto identity validation', () => {
  it('requires either national ID or passport for guest passenger data', async () => {
    const errors = await validate(passenger());
    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['nationalId', 'passportNo']),
    );
  });

  it('accepts a passport when national ID is not supplied', async () => {
    const errors = await validate(passenger({ passportNo: 'A1234567' }));
    expect(errors).toHaveLength(0);
  });
});
