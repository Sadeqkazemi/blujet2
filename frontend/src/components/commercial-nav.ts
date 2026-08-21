import type { PanelNavItem } from '../types/panels';

const COMMERCIAL_NAV_ORDER = [
  'dashboard',
  'agencies',
  'routes',
  'flights',
  'services',
  'ancillary-services',
  'reports',
  'staff',
  'clubrules',
  'webservice',
  'finance',
  'cartable',
] as const;

/**
 * Normalize older/newer server contracts to the approved Commercial Manager
 * sidebar: one services entry and no aircraft-definition entry. Both service
 * routes remain implemented, but when the backend advertises its canonical
 * `ancillary-services` item we must not also inject the legacy `services`
 * compatibility item.
 */
export function commercialNavWithServices(items: PanelNavItem[]): PanelNavItem[] {
  const withoutAircraft = items.filter((item) => item.key !== 'aircraft');
  const hasCanonicalServices = withoutAircraft.some((item) => item.key === 'ancillary-services');
  const hasLegacyServices = withoutAircraft.some((item) => item.key === 'services');
  const next = hasCanonicalServices
    ? withoutAircraft.filter((item) => item.key !== 'services')
    : hasLegacyServices
      ? withoutAircraft
      : [...withoutAircraft, { key: 'services', labelFa: 'خدمات', implemented: true }];
  const order = new Map<string, number>(COMMERCIAL_NAV_ORDER.map((key, index) => [key, index]));
  return [...next].sort(
    (a, b) => (order.get(a.key) ?? Number.MAX_SAFE_INTEGER) - (order.get(b.key) ?? Number.MAX_SAFE_INTEGER),
  );
}
