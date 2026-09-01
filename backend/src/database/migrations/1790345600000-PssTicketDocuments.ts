import type { MigrationInterface, QueryRunner } from 'typeorm';

export class PssTicketDocuments1790345600000 implements MigrationInterface {
  name = 'PssTicketDocuments1790345600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."TicketDocumentStatus" AS ENUM('ISSUED', 'VOID', 'REFUNDED', 'EXCHANGED')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."FlightCouponStatus" AS ENUM('OPEN', 'CHECKED_IN', 'BOARDED', 'FLOWN', 'REFUNDED', 'VOID', 'EXCHANGED')`,
    );
    await queryRunner.query(
      `CREATE SEQUENCE "ticket_document_number_seq" AS bigint MINVALUE 1 MAXVALUE 9999999999 NO CYCLE`,
    );
    await queryRunner.query(`
      CREATE TABLE "ticket_documents" (
        "id" text NOT NULL,
        "documentNo" text NOT NULL,
        "passengerId" text NOT NULL,
        "bookingId" text NOT NULL,
        "status" "public"."TicketDocumentStatus" NOT NULL DEFAULT 'ISSUED',
        "issuedAt" TIMESTAMP(3) NOT NULL,
        "originalIssueAt" TIMESTAMP(3) NOT NULL,
        "currency" text NOT NULL DEFAULT 'IRR',
        "totalFareIrr" bigint NOT NULL DEFAULT 0,
        "totalTaxIrr" bigint NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "ticket_documents_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "ticket_documents_passengerId_fkey" FOREIGN KEY ("passengerId") REFERENCES "passengers"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "ticket_documents_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ticket_documents_documentNo_key" ON "ticket_documents" ("documentNo")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ticket_documents_passengerId_key" ON "ticket_documents" ("passengerId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ticket_documents_bookingId_idx" ON "ticket_documents" ("bookingId")`,
    );
    await queryRunner.query(`
      CREATE TABLE "flight_coupons" (
        "id" text NOT NULL,
        "ticketDocumentId" text NOT NULL,
        "flightInstanceId" text NOT NULL,
        "sequenceNo" integer NOT NULL,
        "status" "public"."FlightCouponStatus" NOT NULL DEFAULT 'OPEN',
        "flightNo" text NOT NULL,
        "originCode" text NOT NULL,
        "destCode" text NOT NULL,
        "departureAt" TIMESTAMP(3) NOT NULL,
        "cabin" "public"."CabinClass" NOT NULL,
        "fareClassCode" text,
        "fareIrr" bigint NOT NULL DEFAULT 0,
        "taxIrr" bigint NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "flight_coupons_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "flight_coupons_document_sequence_key" UNIQUE ("ticketDocumentId", "sequenceNo"),
        CONSTRAINT "flight_coupons_document_flight_key" UNIQUE ("ticketDocumentId", "flightInstanceId"),
        CONSTRAINT "flight_coupons_ticketDocumentId_fkey" FOREIGN KEY ("ticketDocumentId") REFERENCES "ticket_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "flight_coupons_flightInstanceId_fkey" FOREIGN KEY ("flightInstanceId") REFERENCES "flight_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "flight_coupons_ticketDocumentId_idx" ON "flight_coupons" ("ticketDocumentId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "flight_coupons_flightInstanceId_status_idx" ON "flight_coupons" ("flightInstanceId", "status")`,
    );

    await queryRunner.query(`
      INSERT INTO "ticket_documents" (
        "id", "documentNo", "passengerId", "bookingId", "status",
        "issuedAt", "originalIssueAt", "currency", "totalFareIrr", "totalTaxIrr"
      )
      SELECT
        'td-' || p.id,
        p."ticketNo",
        p.id,
        p."bookingId",
        CASE WHEN b.status = 'REFUNDED' THEN 'REFUNDED' ELSE 'ISSUED' END::"public"."TicketDocumentStatus",
        COALESCE(p."ticketIssuedAt", b."createdAt"),
        COALESCE(p."ticketIssuedAt", b."createdAt"),
        'IRR',
        p."fareIrr",
        p."taxIrr"
      FROM passengers p
      INNER JOIN bookings b ON b.id = p."bookingId"
      WHERE p."ticketNo" IS NOT NULL
      ON CONFLICT ("passengerId") DO NOTHING
    `);
    await queryRunner.query(`
      INSERT INTO "flight_coupons" (
        "id", "ticketDocumentId", "flightInstanceId", "sequenceNo", "status",
        "flightNo", "originCode", "destCode", "departureAt", "cabin",
        "fareClassCode", "fareIrr", "taxIrr"
      )
      SELECT
        'fc-' || p.id,
        td.id,
        b."flightInstanceId",
        1,
        CASE
          WHEN b.status = 'REFUNDED' THEN 'REFUNDED'
          WHEN b.status IN ('FLOWN', 'NO_SHOW') THEN 'FLOWN'
          ELSE 'OPEN'
        END::"public"."FlightCouponStatus",
        f."flightNo",
        r."originCode",
        r."destCode",
        fi."departureAt",
        b.cabin,
        b."fareClassCode",
        p."fareIrr",
        p."taxIrr"
      FROM "ticket_documents" td
      INNER JOIN passengers p ON p.id = td."passengerId"
      INNER JOIN bookings b ON b.id = td."bookingId"
      INNER JOIN flight_instances fi ON fi.id = b."flightInstanceId"
      INNER JOIN flights f ON f.id = fi."flightId"
      INNER JOIN routes r ON r.id = f."routeId"
      ON CONFLICT ("ticketDocumentId", "flightInstanceId") DO NOTHING
    `);
    await queryRunner.query(`
      SELECT setval(
        'ticket_document_number_seq',
        GREATEST(COUNT(*) + 1, 1),
        false
      )
      FROM passengers
      WHERE "ticketNo" IS NOT NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "flight_coupons"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "ticket_documents"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."FlightCouponStatus"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."TicketDocumentStatus"`);
    await queryRunner.query(`DROP SEQUENCE IF EXISTS "ticket_document_number_seq"`);
  }
}
