import { enumerateSeats } from './seat-layout';

describe('enumerateSeats', () => {
  it('applies MD-80 column letters and excluded rear seats', () => {
    const seats = enumerateSeats({
      businessRowStart: 3,
      businessRowEnd: 6,
      businessColsLeft: ['A', 'B'],
      businessColsRight: ['E', 'F'],
      economyRowStart: 7,
      economyRowEnd: 32,
      economyColsLeft: ['A', 'B'],
      economyColsRight: ['D', 'E', 'F'],
      excludedSeatCodes: ['28A', '28B', '29A', '29B', '30A', '30B'],
    });

    expect(seats).toHaveLength(140);
    expect(seats.find((s) => s.seatCode === '3E')?.cabin).toBe('BUSINESS');
    expect(seats.find((s) => s.seatCode === '7D')?.cabin).toBe('ECONOMY');
    expect(seats.find((s) => s.seatCode === '3C')).toBeUndefined();
    expect(seats.find((s) => s.seatCode === '7C')).toBeUndefined();
    expect(seats.find((s) => s.seatCode === '28A')).toBeUndefined();
    expect(seats.find((s) => s.seatCode === '28D')).toBeDefined();
    expect(seats.find((s) => s.seatCode === '31A')).toBeDefined();
  });
});
