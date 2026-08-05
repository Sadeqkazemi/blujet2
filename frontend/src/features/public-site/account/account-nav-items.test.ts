import { describe, expect, it } from 'vitest';
import {
  ACCOUNT_NAV_ITEMS,
  mobileAccountNavItems,
  sidebarAccountNavItems,
} from './account-nav-items';

describe('account-nav-items', () => {
  it('exposes the same panel sections in the desktop sidebar as in the mobile menu', () => {
    const sidebarKeys = sidebarAccountNavItems().map((i) => i.key);
    const mobileKeys = mobileAccountNavItems().map((i) => i.key);
    expect(sidebarKeys).toEqual(mobileKeys);
    expect(sidebarKeys).toContain('trips');
    expect(sidebarKeys).toContain('wallet');
    expect(sidebarKeys).toContain('security');
    expect(sidebarKeys).toContain('referral');
  });

  it('marks every nav item for both surfaces', () => {
    expect(ACCOUNT_NAV_ITEMS.every((i) => i.showInSidebar && i.showInMobileMenu)).toBe(true);
  });
});
