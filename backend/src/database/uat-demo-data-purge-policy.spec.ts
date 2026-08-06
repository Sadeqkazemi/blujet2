import {
  isUatAccessAccount,
  operationalTables,
  UAT_PRESERVED_TABLES,
  UAT_ROW_FILTERED_TABLES,
} from './uat-demo-data-purge-policy';

describe('UAT demo data purge policy', () => {
  it('preserves only explicit UAT access accounts and the super admin', () => {
    expect(isUatAccessAccount('uat.it', false)).toBe(true);
    expect(isUatAccessAccount('PANEL.finance', false)).toBe(true);
    expect(isUatAccessAccount(null, true)).toBe(true);
    expect(isUatAccessAccount('itadmin', false)).toBe(false);
    expect(isUatAccessAccount(null, false)).toBe(false);
  });

  it('purges operational tables while retaining users and required reference data', () => {
    const result = operationalTables([
      'users',
      'flights',
      'flight_instances',
      'passengers',
      'bookings',
      'club_members',
      'club_points_entries',
      'club_card_requests',
      'wallet_entries',
      'agency_profiles',
      'agency_credit_lines',
      'airports',
      'permissions',
      'system_settings',
      'flights',
    ]);

    expect(result).toEqual([
      'bookings',
      'club_card_requests',
      'club_members',
      'club_points_entries',
      'flight_instances',
      'flights',
      'passengers',
      'wallet_entries',
    ]);
    expect(UAT_PRESERVED_TABLES.has('airports')).toBe(true);
    expect(UAT_PRESERVED_TABLES.has('bookings')).toBe(false);
  });

  it('excludes agency_profiles/agency_credit_lines from blanket purge — a UAT temp agency needs its own profile row to survive', () => {
    expect(UAT_ROW_FILTERED_TABLES.map(({ table }) => table).sort()).toEqual([
      'agency_credit_lines',
      'agency_profiles',
    ]);
    // Child (agency_credit_lines, FK -> agency_profiles) must be listed
    // before its parent so the purge script deletes in FK-safe order.
    expect(UAT_ROW_FILTERED_TABLES[0].table).toBe('agency_credit_lines');
    expect(UAT_ROW_FILTERED_TABLES[1].table).toBe('agency_profiles');
  });
});
