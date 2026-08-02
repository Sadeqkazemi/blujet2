import { DataSource } from 'typeorm';
import { dataSourceOptions } from '../src/database/data-source.options';

/**
 * Phase 0 spike — Gate A. Boots a standalone TypeORM DataSource (NOT
 * through Nest DI; AppModule is untouched in this phase) against the same
 * e2e Postgres database TypeORM's migrations created, and asserts the
 * schema builder has nothing left to do beyond a documented allowlist of
 * known-benign patterns — i.e. the 4 hand-written entities describe the
 * existing tables byte-for-byte (or provably-equivalent-but-textually-
 * different). This is the same check `typeorm migration:generate` runs
 * internally.
 *
 * Any upQuery NOT matching the allowlist below means an entity's column
 * type/nullability/default/index genuinely doesn't match the live schema
 * and must be fixed before it's trusted as a template for the other 73
 * tables — see docs/features/typeorm-migration-phase-0.md for the full
 * write-up of everything found here.
 */

/** Every entry verified empirically against `pg_attrdef`/`information_schema`
 * (not guessed) before being allowlisted — see the doc above for the
 * investigation behind each one. */
const KNOWN_BENIGN_DIFF_PATTERNS: RegExp[] = [
  // FK constraints TypeORM wants to drop because the target entity
  // (User/FlightInstance/Booking) doesn't exist yet in this 4-entity spike
  // — expected until Phase 2 lands the full 77-entity set with relations.
  /DROP CONSTRAINT ".+_fkey"$/,
  // TypeORM's own PostgresDriver.normalizeDatetimeFunction() always
  // rewrites a precision-less `CURRENT_TIMESTAMP` entity default to
  // "now()", but its schema-introspection path does NOT reciprocally
  // normalize a live "CURRENT_TIMESTAMP" default before comparing —
  // confirmed via `SELECT pg_get_expr(...)` on pg_attrdef directly: the
  // DB's actual default expression is `CURRENT_TIMESTAMP`, functionally
  // identical to `now()` on a `timestamp without time zone` column.
  /ALTER COLUMN "\w+" SET DEFAULT now\(\)$/,
  // Same class of issue for the one enum-array column: entity `default:
  // []` normalizes to the literal '{}' array syntax, while TypeORM's
  // migration wrote `ARRAY[]::"BookingChannel"[]` — both are the same
  // empty array, just different valid Postgres literal spellings.
  /ALTER COLUMN "allowedChannels" SET DEFAULT '\{\}'$/,
];

describe('TypeORM schema parity (Phase 0 spike)', () => {
  let dataSource: DataSource;

  beforeAll(async () => {
    dataSource = new DataSource(dataSourceOptions);
    await dataSource.initialize();
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  it('produces only the documented allowlisted diff against the existing TypeORM-migrated schema', async () => {
    const sqlInMemory = await dataSource.driver.createSchemaBuilder().log();
    const upQueries = sqlInMemory.upQueries.map((q) => q.query);

    const unexpected = upQueries.filter(
      (query) => !KNOWN_BENIGN_DIFF_PATTERNS.some((p) => p.test(query)),
    );

    // Jest's own assertion diff shows the actual queries on failure —
    // no console.log needed (CLAUDE.md forbids it in committed code).
    expect(unexpected).toEqual([]);
  });
});
