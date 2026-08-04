import { describe, expect, it } from 'vitest';
import { deriveUsernameFromEmail, rolePermissionPreset } from './admin-permissions';

describe('admin-permissions', () => {
  it('derives username from email local part', () => {
    expect(deriveUsernameFromEmail('z.karimi@blujet.example')).toBe('z.karimi');
    expect(deriveUsernameFromEmail('ab@x.co')).toMatch(/^admin\./);
  });

  it('presets IT manager permissions per design', () => {
    const perms = rolePermissionPreset('IT_MANAGER');
    expect(perms.support).toBe(true);
    expect(perms.admins).toBe(true);
    expect(perms.settings).toBe(true);
    expect(perms.flights).toBe(false);
  });

  it('presets finance manager permissions per design', () => {
    const perms = rolePermissionPreset('FINANCE_MANAGER');
    expect(perms.finance).toBe(true);
    expect(perms.reports).toBe(true);
    expect(perms.flights).toBe(false);
  });
});
