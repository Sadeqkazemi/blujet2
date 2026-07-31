BEGIN;

-- AddColumn
ALTER TABLE "refund_requests" ADD COLUMN "trackingCode" TEXT;

-- Existing rows get deterministic, collision-free short display codes.
WITH ranked AS (
  SELECT "id", ROW_NUMBER() OVER (ORDER BY "createdAt", "id") AS rn
  FROM "refund_requests"
)
UPDATE "refund_requests" AS r
SET "trackingCode" = 'RF-' || LPAD(ranked.rn::TEXT, 8, '0')
FROM ranked
WHERE r."id" = ranked."id";

-- MakeColumnRequired
ALTER TABLE "refund_requests" ALTER COLUMN "trackingCode" SET NOT NULL;

-- One display code and one refund request per booking. The latter is also
-- the database-level concurrency guard for simultaneous submissions.
CREATE UNIQUE INDEX "refund_requests_trackingCode_key"
  ON "refund_requests"("trackingCode");
CREATE UNIQUE INDEX "refund_requests_bookingId_key"
  ON "refund_requests"("bookingId");

COMMIT;
