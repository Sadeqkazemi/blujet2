import type { PanelNavItem } from '../types/panels';

const COMMERCIAL_NAV_ORDER = [
  'dashboard',
  'agencies',
  'routes',
  'flights',
  'services',
  'aircraft',
  'reports',
  'staff',
  'clubrules',
  'webservice',
  'finance',
  'cartable',
] as const;

/**
 * The approved commercial handoff adds «خدمات». The travel-cost API already
 * authorizes COMMERCIAL_MANAGER, while older panel-nav responses do not yet
 * advertise the tab. Keep that compatibility shim in the frontend-only branch
 * until the backend navigation contract is approved separately.
 */
export function commercialNavWithServices(items: PanelNavItem[]): PanelNavItem[] {
  const next = items.some((item) => item.key === 'services')
    ? items
    : [...items, { key: 'services', labelFa: 'خدمات', implemented: true }];
  const order = new Map<string, number>(COMMERCIAL_NAV_ORDER.map((key, index) => [key, index]));
  return [...next].sort(
    (a, b) => (order.get(a.key) ?? Number.MAX_SAFE_INTEGER) - (order.get(b.key) ?? Number.MAX_SAFE_INTEGER),
  );
}
