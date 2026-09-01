import type { MigrationInterface, QueryRunner } from 'typeorm';

export class DcsCore1790432000000 implements MigrationInterface {
  name = 'DcsCore1790432000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."BaggageStatus" AS ENUM('ACCEPTED', 'LOADED', 'OFFLOADED', 'DELIVERED')`,
    );
    await queryRunner.query(
      `CREATE SEQUENCE "boarding_pass_number_seq" AS bigint MINVALUE 1 NO CYCLE`,
    );
    await queryRunner.query(
      `CREATE SEQUENCE "baggage_tag_number_seq" AS bigint MINVALUE 1 NO CYCLE`,
    );
    await queryRunner.query(`
      CREATE TABLE "dcs_passenger_operations" (
        "id" text NOT NULL,
        "flightCouponId" text NOT NULL,
        "boardingPassNo" text NOT NULL,
        "seatCode" text NOT NULL,
        "gate" text,
        "checkedInAt" TIMESTAMP(3) NOT NULL,
        "checkedInById" text NOT NULL,
        "boardedAt" TIMESTAMP(3),
        "boardedById" text,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "dcs_passenger_operations_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "dcs_passenger_operations_flightCouponId_fkey" FOREIGN KEY ("flightCouponId") REFERENCES "flight_coupons"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "dcs_passenger_operations_checkedInById_fkey" FOREIGN KEY ("checkedInById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
        CONSTRAINT "dcs_passenger_operations_boardedById_fkey" FOREIGN KEY ("boardedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "dcs_passenger_operations_flightCouponId_key" ON "dcs_passenger_operations" ("flightCouponId")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "dcs_passenger_operations_boardingPassNo_key" ON "dcs_passenger_operations" ("boardingPassNo")`,
    );
    await queryRunner.query(`
      CREATE TABLE "baggage_items" (
        "id" text NOT NULL,
        "flightCouponId" text NOT NULL,
        "tagNo" text NOT NULL,
        "weightGrams" integer NOT NULL,
        "status" "public"."BaggageStatus" NOT NULL DEFAULT 'ACCEPTED',
        "acceptedAt" TIMESTAMP(3) NOT NULL,
        "acceptedById" text NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "baggage_items_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "baggage_items_weightGrams_check" CHECK ("weightGrams" > 0 AND "weightGrams" <= 100000),
        CONSTRAINT "baggage_items_flightCouponId_fkey" FOREIGN KEY ("flightCouponId") REFERENCES "flight_coupons"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "baggage_items_acceptedById_fkey" FOREIGN KEY ("acceptedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "baggage_items_tagNo_key" ON "baggage_items" ("tagNo")`,
    );
    await queryRunner.query(
      `CREATE INDEX "baggage_items_flightCouponId_status_idx" ON "baggage_items" ("flightCouponId", "status")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "baggage_items"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "dcs_passenger_operations"`);
    await queryRunner.query(`DROP SEQUENCE IF EXISTS "baggage_tag_number_seq"`);
    await queryRunner.query(`DROP SEQUENCE IF EXISTS "boarding_pass_number_seq"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."BaggageStatus"`);
  }
}
