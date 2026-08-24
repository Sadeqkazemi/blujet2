import { ANCILLARY_BUILT_IN_SERVICES } from './ancillary-services.catalog';
import { AncillaryServicesService } from './ancillary-services.service';

describe('AncillaryServicesService fixed checkout mirrors', () => {
  it('recreates a missing SEAT_SELECTION travel-extra row from the permanent built-in', async () => {
    const builtIns = new Map(
      ANCILLARY_BUILT_IN_SERVICES.map((row) => [
        row.key,
        {
          ...row,
          updatedById: null,
        },
      ]),
    );
    const ancillaryRepo = {
      findOneBy: jest.fn(({ key }: { key: string }) =>
        Promise.resolve(builtIns.get(key) ?? null),
      ),
      save: jest.fn((row: object) => Promise.resolve(row)),
      create: jest.fn((row: object) => row),
    };
    const travelExtraRepo = {
      findOneBy: jest.fn(({ code }: { code: string }) =>
        Promise.resolve(code === 'SEAT_SELECTION' ? null : { code }),
      ),
      create: jest.fn((row: object) => row),
      save: jest.fn((row: object) => Promise.resolve(row)),
    };

    const service = new AncillaryServicesService(
      ancillaryRepo as never,
      travelExtraRepo as never,
      { record: jest.fn() } as never,
    );

    await service.ensureBuiltIns();

    expect(travelExtraRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'SEAT_SELECTION',
        billingUnit: 'PER_PASSENGER',
        priceIrr: 800_000n,
        active: true,
        purchaseEnabled: true,
      }),
    );
    expect(travelExtraRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'SEAT_SELECTION' }),
    );
  });
});
