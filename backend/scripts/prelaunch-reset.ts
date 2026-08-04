/**
 * Destructive pre-launch reset: clears passengers, bookings, flights,
 * refunds, agency applications, and customer USER accounts while keeping
 * staff/seed catalog (airports, aircraft seat maps, staff users, settings).
 *
 * Usage (dev/test only):
 *   cd backend && npm run prelaunch:reset
 */
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { dataSourceOptions } from '../src/database/data-source.options';

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('prelaunch-reset refused: NODE_ENV=production');
  }

  const ds = new DataSource(dataSourceOptions);
  await ds.initialize();

  try {
    await ds.query(`
      TRUNCATE TABLE
        "pay_idempotency_records",
        "payment_reconciliations",
        "ledger_entries",
        "club_points_entries",
        "wallet_entries",
        "promo_redemptions",
        "price_locks",
        "refund_requests",
        "passengers",
        "saved_passengers",
        "saved_flights",
        "saved_bank_accounts",
        "seat_locks",
        "bookings",
        "agency_allotments",
        "cabin_fares",
        "fare_rules",
        "fare_pricing_proposals",
        "flight_instances",
        "schedules",
        "flights",
        "agency_webservice_requests",
        "agency_api_keys",
        "agency_documents",
        "agency_messages",
        "agency_invoices",
        "agency_credit_requests",
        "agency_credit_lines",
        "agency_profiles",
        "agency_membership_requests",
        "agency_request_otps",
        "customer_identity_verifications",
        "customer_referrals",
        "club_card_requests",
        "club_members",
        "support_tickets",
        "contact_messages"
      RESTART IDENTITY CASCADE
    `);

    await ds.query(`
      DELETE FROM "refresh_tokens"
      WHERE "userId" IN (
        SELECT id FROM "users" WHERE role IN ('USER', 'AGENCY')
      )
    `);
    await ds.query(`
      DELETE FROM "two_factor_challenges"
      WHERE "userId" IN (
        SELECT id FROM "users" WHERE role IN ('USER', 'AGENCY')
      )
    `);
    await ds.query(`
      DELETE FROM "employee_permissions"
      WHERE "userId" IN (
        SELECT id FROM "users"
        WHERE role = 'EMPLOYEE' AND username LIKE 'emp.prelaunch.%'
      )
    `);
    await ds.query(`
      DELETE FROM "users"
      WHERE role IN ('USER', 'AGENCY')
         OR (role = 'EMPLOYEE' AND username LIKE 'emp.prelaunch.%')
    `);

    // eslint-disable-next-line no-console
    console.log(
      'Prelaunch reset complete: passengers/flights/bookings/agency apps cleared. Staff + airports kept.',
    );
  } finally {
    await ds.destroy();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
