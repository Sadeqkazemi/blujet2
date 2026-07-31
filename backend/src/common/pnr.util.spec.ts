import { generatePnr, generateUniquePnr } from './pnr.util';

describe('pnr.util (unit)', () => {
  it('generates a BJ-prefixed 8-character code', () => {
    const pnr = generatePnr();
    expect(pnr).toMatch(/^BJ[A-F0-9]{6}$/);
  });

  it('generateUniquePnr retries when a collision occurs', async () => {
    let calls = 0;
    const typeorm = {
      booking: {
        findUnique: jest.fn(async () => {
          calls++;
          return calls === 1 ? { id: 'existing' } : null;
        }),
      },
    };

    const pnr = await generateUniquePnr(typeorm);
    expect(pnr).toMatch(/^BJ[A-F0-9]{6}$/);
    expect(typeorm.booking.findUnique).toHaveBeenCalledTimes(2);
  });
});
