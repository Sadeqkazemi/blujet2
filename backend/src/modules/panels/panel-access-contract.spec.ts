import { ForbiddenException } from '@nestjs/common';
import { ALL_PANEL_KEYS, PANEL_ACCESS_TOGGLE_RIGHTS } from './panel-nav.config';
import { PanelsService } from './panels.service';

describe('operations panel access contract', () => {
  it('is controllable by CEO and senior manager', () => {
    expect(ALL_PANEL_KEYS).toContain('OPERATIONS');
    expect(PANEL_ACCESS_TOGGLE_RIGHTS.CEO).toContain('OPERATIONS');
    expect(PANEL_ACCESS_TOGGLE_RIGHTS.SENIOR_MANAGER).toContain('OPERATIONS');
  });

  it('returns ACCESS_REVOKED for a disabled operations panel', async () => {
    const panelRepo = {
      findOneBy: jest.fn().mockResolvedValue({ panelKey: 'OPERATIONS', enabled: false }),
    };
    const service = new PanelsService(
      {} as never,
      {} as never,
      panelRepo as never,
      {} as never,
      {} as never,
    );

    await expect(service.assertPanelEnabledForSelf('OPERATIONS_MANAGER')).rejects.toMatchObject<
      Partial<ForbiddenException>
    >({ response: expect.objectContaining({ code: 'ACCESS_REVOKED' }) });
  });

  it('revokes every live operations-manager refresh session when disabled', async () => {
    const userRepo = { find: jest.fn().mockResolvedValue([{ id: 'ops-1' }, { id: 'ops-2' }]) };
    const panelRepo = {
      upsert: jest.fn().mockResolvedValue(undefined),
      findOneByOrFail: jest.fn().mockResolvedValue({ panelKey: 'OPERATIONS', enabled: false }),
    };
    const refreshRepo = { update: jest.fn().mockResolvedValue({ affected: 2 }) };
    const audit = { record: jest.fn().mockResolvedValue(undefined) };
    const service = new PanelsService(
      userRepo as never,
      {} as never,
      panelRepo as never,
      refreshRepo as never,
      audit as never,
    );

    await service.setAccessFlag(
      { id: 'ceo-1', role: 'CEO', fullName: 'مدیر عامل', isSuperAdmin: false },
      'OPERATIONS',
      false,
    );

    expect(userRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { role: 'OPERATIONS_MANAGER' } }),
    );
    expect(refreshRepo.update).toHaveBeenCalledWith(
      expect.objectContaining({ userId: expect.anything(), revokedAt: expect.anything() }),
      expect.objectContaining({ revokedAt: expect.any(Date) }),
    );
  });
});
