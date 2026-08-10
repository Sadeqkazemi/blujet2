export const MANAGER_PANEL_PERMISSION_KEYS = [
  'flights',
  'agencies',
  'reports',
  'finance',
  'refunds',
  'club',
  'content',
  'support',
  'admins',
  'settings',
] as const;

export type ManagerPanelPermissionKey =
  (typeof MANAGER_PANEL_PERMISSION_KEYS)[number];

const NAV_PERMISSION_BY_KEY: Readonly<
  Record<string, ManagerPanelPermissionKey>
> = {
  flights: 'flights',
  flightops: 'flights',
  aircraft: 'flights',
  pricing: 'flights',
  webservice: 'flights',
  agencies: 'agencies',
  reports: 'reports',
  staff: 'reports',
  mgrreports: 'reports',
  finance: 'finance',
  refund: 'refunds',
  club: 'club',
  clubrules: 'club',
  vip: 'club',
  media: 'content',
  jobapps: 'content',
  tickets: 'support',
  admins: 'admins',
  users: 'admins',
  panels: 'admins',
  settings: 'settings',
};

export function permissionForNavKey(
  navKey: string,
): ManagerPanelPermissionKey | null {
  return NAV_PERMISSION_BY_KEY[navKey] ?? null;
}

export function permissionForRequestPath(
  rawPath: string,
): ManagerPanelPermissionKey | null {
  const path = rawPath.split('?')[0].replace(/^\/api(?=\/)/, '');
  if (/^\/admins(?:\/|$)/.test(path)) return 'admins';
  if (/^\/agencies(?:\/|$)/.test(path)) return 'agencies';
  if (
    /^\/(?:flightops|flights|pricing|webservice\/pricing)(?:\/|$)/.test(path)
  ) {
    return 'flights';
  }
  if (/^\/(?:passenger-reports|reporting|staff-reports)(?:\/|$)/.test(path)) {
    return 'reports';
  }
  if (/^\/reconciliation(?:\/|$)/.test(path)) return 'finance';
  if (/^\/refunds(?:\/|$)/.test(path)) return 'refunds';
  if (/^\/club(?:\/|$)/.test(path)) return 'club';
  if (/^\/(?:site-content\/admin|blog\/admin|careers)(?:\/|$)/.test(path)) {
    return 'content';
  }
  if (/^\/(?:manager-messages|support-tickets)(?:\/|$)/.test(path)) {
    return 'support';
  }
  if (/^\/it\/(?:employees|permissions)(?:\/|$)/.test(path)) return 'admins';
  if (/^\/it\/(?:services|security|backups)(?:\/|$)/.test(path))
    return 'settings';
  if (/^\/settings(?:\/|$)/.test(path)) return 'settings';
  return null;
}
