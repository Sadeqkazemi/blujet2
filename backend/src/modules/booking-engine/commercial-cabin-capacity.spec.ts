import { commercialCabinCapacity } from './commercial-cabin-capacity';

describe('commercialCabinCapacity', () => {
  it('uses the commercial manager fare allocations as the sellable cabin cap', () => {
    expect(commercialCabinCapacity(140, [20, 30])).toBe(50);
  });

  it('never exceeds the configured physical cabin capacity', () => {
    expect(commercialCabinCapacity(40, [30, 30])).toBe(40);
  });

  it('keeps the physical capacity when no fare class was defined', () => {
    expect(commercialCabinCapacity(124, [])).toBe(124);
  });
});
