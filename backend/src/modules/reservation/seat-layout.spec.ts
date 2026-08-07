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

  it('enumerates COMFORT seats when comfort rows are configured', () => {
    const seats = enumerateSeats({
      businessRowStart: 3,
      businessRowEnd: 6,
      businessColsLeft: ['A', 'B'],
      businessColsRight: ['C', 'D'],
      comfortRowStart: 7,
      comfortRowEnd: 10,
      comfortColsLeft: ['A', 'B'],
      comfortColsRight: ['C', 'D', 'E'],
      economyRowStart: 11,
      economyRowEnd: 32,
      economyColsLeft: ['A', 'B'],
      economyColsRight: ['C', 'D', 'E'],
    });
    expect(seats.find((s) => s.seatCode === '7A')?.cabin).toBe('COMFORT');
    expect(seats.find((s) => s.seatCode === '11A')?.cabin).toBe('ECONOMY');
    expect(seats.filter((s) => s.cabin === 'COMFORT')).toHaveLength(20);
  });
});
