export const UAT_PURGE_FLAG = '--execute-purge';
export const UAT_PURGE_CONFIRMATION = 'PURGE_BLUJET_UAT_DEMO_DATA';

/**
 * Reference/configuration data required for an empty but usable UAT system.
 * Every entity table not listed here is treated as operational data and purged.
 */
export const UAT_PRESERVED_TABLES = new Set([
  'aircraft_seat_maps',
  'airports',
  'careers_settings',
  'club_tier_rules',
  'external_service_configs',
  'panel_access_flags',
  'permissions',
  'refund_penalty_rules',
  'security_policy',
  'survey_settings',
  'system_settings',
]);

/**
 * Tables that can't be blanket-preserved (real production agencies also
 * have rows here) or blanket-purged (a UAT temp agency account's own
 * profile/credit-line row must survive, same as its `users` row does) —
 * purged per-row by the same protected-user rule as `users`, in FK-safe
 * order (child before parent, both before the `users` DELETE).
 */
export const UAT_ROW_FILTERED_TABLES: ReadonlyArray<{
  table: string;
  userIdColumn: string;
}> = [
  { table: 'agency_credit_lines', userIdColumn: 'agencyId' },
  { table: 'agency_profiles', userIdColumn: 'userId' },
];

export function isUatAccessAccount(
  username: string | null,
  isSuperAdmin: boolean,
): boolean {
  if (isSuperAdmin) return true;
  const normalized = username?.trim().toLowerCase() ?? '';
  return normalized.startsWith('uat.') || normalized.startsWith('panel.');
}

export function operationalTables(entityTableNames: string[]): string[] {
  const rowFiltered = new Set(
    UAT_ROW_FILTERED_TABLES.map(({ table }) => table),
  );
  return [...new Set(entityTableNames)]
    .filter(
      (table) =>
        table !== 'users' &&
        !UAT_PRESERVED_TABLES.has(table) &&
        !rowFiltered.has(table),
    )
    .sort();
}
