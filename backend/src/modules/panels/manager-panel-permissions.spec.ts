import {
  permissionForNavKey,
  permissionForRequestPath,
} from './manager-panel-permissions';

describe('manager panel permission mapping', () => {
  it('maps related nav items to the same coarse permission', () => {
    expect(permissionForNavKey('flightops')).toBe('flights');
    expect(permissionForNavKey('mgrreports')).toBe('reports');
    expect(permissionForNavKey('dashboard')).toBeNull();
  });

  it('normalizes API-prefixed request paths', () => {
    expect(permissionForRequestPath('/api/admins/a1/permissions')).toBe(
      'admins',
    );
    expect(permissionForRequestPath('/api/flights/123?mode=edit')).toBe(
      'flights',
    );
    expect(permissionForRequestPath('/api/notifications')).toBeNull();
  });
});
