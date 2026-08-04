import { canTransition, transitionBookingStatus } from './booking-state.util';

describe('booking-state.util', () => {
  it('allows HELD → PAID → TICKETED', () => {
    expect(canTransition('HELD', 'PAID')).toBe(true);
    expect(canTransition('PAID', 'TICKETED')).toBe(true);
  });

  it('rejects illegal transitions', () => {
    expect(canTransition('HELD', 'TICKETED')).toBe(false);
    expect(canTransition('TICKETED', 'HELD')).toBe(false);
  });

  it('transitionBookingStatus returns false when no row matched', async () => {
    const tx = {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    };
    const ok = await transitionBookingStatus(tx, 'id-1', 'HELD', 'PAID');
    expect(ok).toBe(false);
  });
});
