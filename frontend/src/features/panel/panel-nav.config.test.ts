import { describe, expect, it } from 'vitest';
import { fallbackNavForRole, resolvePanelNav } from './panel-nav.config';

describe('panel-nav.config', () => {
  it('returns BOARD_CHAIR tabs from fallback', () => {
    const nav = fallbackNavForRole('BOARD_CHAIR');
    expect(nav.map((i) => i.key)).toEqual([
      'dashboard',
      'admins',
      'finance',
      'cartable',
      'settings',
      'club',
      'survey',
      'reservation',
      'mgrreports',
    ]);
    expect(nav.every((i) => i.implemented)).toBe(true);
  });

  it('uses fallback when API nav is empty', () => {
    const nav = resolvePanelNav([], 'BOARD_CHAIR');
    expect(nav?.find((i) => i.key === 'admins')?.labelFa).toBe('مدیران');
  });

  it('prefers API nav when non-empty', () => {
    const api = [{ key: 'dashboard', labelFa: 'داشبورد', implemented: true }];
    expect(resolvePanelNav(api, 'BOARD_CHAIR')).toEqual(api);
  });

  it('returns null while loading', () => {
    expect(resolvePanelNav(null, 'BOARD_CHAIR')).toBeNull();
  });
});
