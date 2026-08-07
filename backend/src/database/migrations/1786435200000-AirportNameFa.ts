import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * «شهرهای پروازی» design requires a دیزاین named-airport column
 * (نام فرودگاه) alongside the city name and IATA code — separate from the
 * previous fabricated "فرودگاه {cityFa}" string the UI used to compute.
 * Backfills existing rows with that same fallback so the column can be
 * NOT NULL immediately.
 */
export class AirportNameFa1786435200000 implements MigrationInterface {
  name = 'AirportNameFa1786435200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "airports" ADD COLUMN IF NOT EXISTS "airportNameFa" text`,
    );
    await queryRunner.query(
      `UPDATE "airports" SET "airportNameFa" = 'فرودگاه ' || "cityFa" WHERE "airportNameFa" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "airports" ALTER COLUMN "airportNameFa" SET NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "airports" DROP COLUMN IF EXISTS "airportNameFa"`,
    );
  }
}
