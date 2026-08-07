import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * COMFORT physical seat-map columns + nullable competitor price on proposals.
 * Additive / reversible; does not delete existing seat-map or pricing data.
 */
export class ComfortSeatMapAndNullableCompetitor1786348800000 implements MigrationInterface {
  name = 'ComfortSeatMapAndNullableCompetitor1786348800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "aircraft_seat_maps" ADD COLUMN IF NOT EXISTS "comfortRowStart" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "aircraft_seat_maps" ADD COLUMN IF NOT EXISTS "comfortRowEnd" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "aircraft_seat_maps" ADD COLUMN IF NOT EXISTS "comfortColsLeft" text[]`,
    );
    await queryRunner.query(
      `ALTER TABLE "aircraft_seat_maps" ADD COLUMN IF NOT EXISTS "comfortColsRight" text[]`,
    );

    // Carve comfort rows 7–10 out of economy for Airbus A320 (keeps total seats).
    await queryRunner.query(`
      UPDATE "aircraft_seat_maps"
      SET
        "comfortRowStart" = 7,
        "comfortRowEnd" = 10,
        "comfortColsLeft" = "economyColsLeft",
        "comfortColsRight" = "economyColsRight",
        "economyRowStart" = 11
      WHERE "aircraftType" = 'Airbus A320'
        AND "comfortRowStart" IS NULL
        AND "economyRowStart" = 7
    `);

    await queryRunner.query(
      `ALTER TABLE "fare_pricing_proposals" ALTER COLUMN "competitorPriceIrr" DROP NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "fare_pricing_proposals"
      SET "competitorPriceIrr" = COALESCE("competitorPriceIrr", "basePriceIrr")
      WHERE "competitorPriceIrr" IS NULL
    `);
    await queryRunner.query(
      `ALTER TABLE "fare_pricing_proposals" ALTER COLUMN "competitorPriceIrr" SET NOT NULL`,
    );

    await queryRunner.query(`
      UPDATE "aircraft_seat_maps"
      SET
        "economyRowStart" = COALESCE("comfortRowStart", "economyRowStart"),
        "comfortRowStart" = NULL,
        "comfortRowEnd" = NULL,
        "comfortColsLeft" = NULL,
        "comfortColsRight" = NULL
      WHERE "aircraftType" = 'Airbus A320'
        AND "comfortRowStart" IS NOT NULL
    `);

    await queryRunner.query(
      `ALTER TABLE "aircraft_seat_maps" DROP COLUMN IF EXISTS "comfortColsRight"`,
    );
    await queryRunner.query(
      `ALTER TABLE "aircraft_seat_maps" DROP COLUMN IF EXISTS "comfortColsLeft"`,
    );
    await queryRunner.query(
      `ALTER TABLE "aircraft_seat_maps" DROP COLUMN IF EXISTS "comfortRowEnd"`,
    );
    await queryRunner.query(
      `ALTER TABLE "aircraft_seat_maps" DROP COLUMN IF EXISTS "comfortRowStart"`,
    );
  }
}
